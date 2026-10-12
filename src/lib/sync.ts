import { db } from "./db";
import { isAIConfigured, aiSourceVacancies } from "./ai";
import { aiFilterVacancy } from "./recruitment";
import { rematchVacancy } from "./matching";
import { pullConnector, aiRefineMatches, intakeVacancies, createAlert } from "./msp";
import { runAutomations } from "./automation";
import { RECRUITMENT_FIELDS } from "./domain";

// AI runs synchronously inside the request, so bound the per-run work. For real
// scale this should be a background queue; the daily cron + these caps keep it
// well within a single request.
const FILTER_CAP = 25; // alles van de ochtendrun (3 vakgebieden × 6) in één keer beoordelen
const MATCH_CAP = 30;

// Web-speurder: elke run 3 vakgebieden (roteert per dag), zo is de hele niche
// in ±5 dagen rond en blijft elke zoekopdracht gericht.
const WEB_FIELDS_PER_RUN = 3;
const WEB_KEY = "web-speurder";

/** Welke vakgebieden de Web-speurder vandaag afzoekt (roteert per dag). */
export function webFieldsFor(day: number, fields: readonly string[] = RECRUITMENT_FIELDS): string[] {
  const start = (day * WEB_FIELDS_PER_RUN) % fields.length;
  return Array.from({ length: Math.min(WEB_FIELDS_PER_RUN, fields.length) }, (_, i) => fields[(start + i) % fields.length]);
}

export type SyncResult = {
  id: string;
  trigger: string;
  status: string;
  sourced: number;
  filtered: number;
  relevant: number;
  matched: number;
  note: string | null;
};

/**
 * The daily sourcing agent: (1) AI web-search sourcing of public vacancies,
 * (2) AI relevance filter on unjudged vacancies, (3) (re)match candidates to
 * relevant vacancies. Each step is bounded and failure-tolerant. Writes a
 * SyncRun audit row and returns it.
 */
export async function runDailySync(
  trigger: "MANUAL" | "CRON",
): Promise<SyncResult> {
  const run = await db.syncRun.create({ data: { trigger, status: "RUNNING", note: "Opstarten…" } });
  // Live voortgang: zolang de run loopt staat de huidige stap in `note`, zodat de
  // MSP-pagina de agents letterlijk ziet werken. Best-effort, mag nooit breken.
  const stap = (tekst: string, extra: Record<string, number> = {}) =>
    db.syncRun.update({ where: { id: run.id }, data: { note: tekst, ...extra } }).catch(() => {});
  let sourced = 0;
  let filtered = 0;
  let relevant = 0;
  let matched = 0;
  let note: string | null = null;

  try {
    // 0. MSP-pull: connectors met een echte API-koppeling (key + URL) worden
    //    dagelijks leeggetrokken; elke nieuwe vacature doorloopt de volledige
    //    intake-pijplijn (filter → site → post → matches → melding).
    const apiConnectors = await db.vmsConnector.findMany({
      where: { status: "CONNECTED", apiKey: { not: null }, apiBaseUrl: { not: null } },
      select: { id: true },
    });
    for (const c of apiConnectors) {
      try {
        const pulled = await pullConnector(c.id);
        if (pulled) sourced += pulled.created;
      } catch {
        // per-connector best-effort — de rest van de sync draait door
      }
    }

    // 1. Web-speurder: zoekt openbare vacatures op het web en zet ze als eigen
    //    bron in de MSP-hub (Opdrachtgevers › Web-speurder). Niets gaat vanzelf
    //    live: de AI-filter beoordeelt, de recruiter beslist.
    let webId: string | null = null;
    if (isAIConfigured()) {
      const vandaag = webFieldsFor(Math.floor(Date.now() / 86_400_000));
      await stap(`Web-speurder zoekt op het web: ${vandaag.join(", ")}`);
      const web = await db.vmsConnector.upsert({
        where: { key: WEB_KEY },
        update: {},
        create: {
          key: WEB_KEY,
          name: "Web-speurder",
          status: "MANUAL",
          priority: 4,
          notes: "Agent die dagelijks openbare vacatures in de Q4S-niche op het web zoekt.",
          // Alleen beoordelen — nooit automatisch publiceren of posten.
          autoPublishSite: false,
          autoDraftPost: false,
        },
      });
      webId = web.id;
      const found = (
        await Promise.all(
          vandaag.map((f) => aiSourceVacancies({ fields: [f], max: 6 })),
        )
      ).flat();
      const { createdIds } = await intakeVacancies(
        web.id,
        found.map((f) => ({
          title: f.title,
          description: [f.summary, f.url && `Bron: ${f.url}`].filter(Boolean).join("\n\n") || f.title,
          company: f.company,
          location: f.location,
          discipline: f.discipline,
          url: f.url,
          externalId: f.url,
        })),
      );
      sourced += createdIds.length;
      await db.vmsConnector.update({ where: { id: web.id }, data: { lastSyncAt: new Date() } });
    } else {
      note =
        "AI niet geconfigureerd: web-search-sourcing en relevantiefilter overgeslagen; alleen CV-matching uitgevoerd.";
    }

    // 2. AI relevance filter on unjudged vacancies (bounded).
    const unjudged = await db.vacancy.findMany({
      where: { relevance: "UNKNOWN" },
      take: FILTER_CAP,
      orderBy: { createdAt: "asc" },
      select: { id: true },
    });
    for (const [i, v] of unjudged.entries()) {
      await stap(`AI-filter beoordeelt vacature ${i + 1} van ${unjudged.length}`, { sourced, filtered, relevant });
      try {
        const r = await aiFilterVacancy(v.id);
        filtered++;
        if (r === "RELEVANT") {
          relevant++;
          // Lead-agent: een bedrijf dat zelf iemand zoekt in onze niche = een
          // acquisitiekans. Melding met wie het is, zodat sales kan bellen.
          const vac = await db.vacancy.findUnique({
            where: { id: v.id },
            select: { title: true, companyName: true, location: true, vmsConnectorId: true, sourceUrl: true },
          });
          if (vac && webId && vac.vmsConnectorId === webId && vac.companyName) {
            await createAlert({
              type: "LEAD",
              title: `Lead: ${vac.companyName} zoekt een ${vac.title}`,
              body: [
                vac.location && `Locatie: ${vac.location}.`,
                "Gevonden door de Web-speurder en past bij de Q4S-niche. Bel ze om onze kandidaten aan te bieden, of schrijf de vacature uit voor de site/LinkedIn.",
                vac.sourceUrl && `Bron: ${vac.sourceUrl}`,
              ]
                .filter(Boolean)
                .join(" "),
              href: `/vacatures/${v.id}`,
              vacancyId: v.id,
              vmsConnectorId: webId,
            });
          }
        }
      } catch {
        // AI off/error — leave as UNKNOWN, continue.
      }
    }

    // 3. (Re)match candidates to relevant vacancies (free/rule-based).
    const rel = await db.vacancy.findMany({
      where: { relevance: "RELEVANT" },
      take: MATCH_CAP,
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    await stap(`Matcher zoekt kandidaten bij ${rel.length} passende vacatures`, { sourced, filtered, relevant });
    for (const v of rel) {
      const n = await rematchVacancy(v.id);
      matched += n;
      // Verfijn met AI-scores (zelfde als de intake-pijplijn) zodat de dagelijkse
      // sync de AI-percentages niet met kale regel-scores overschrijft.
      if (n > 0) await aiRefineMatches(v.id);
    }

    // Automatische acties meelaten lopen (best-effort — mag de sync nooit breken).
    try {
      await runAutomations();
    } catch {
      /* automatiseringen falen stil binnen de sync */
    }

    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "DONE", sourced, filtered, relevant, matched, note, finishedAt: new Date() },
    });
  } catch (e) {
    note = String(e instanceof Error ? e.message : e).slice(0, 200);
    await db.syncRun.update({
      where: { id: run.id },
      data: { status: "ERROR", sourced, filtered, relevant, matched, note, finishedAt: new Date() },
    });
  }

  const final = await db.syncRun.findUnique({ where: { id: run.id } });
  return final as SyncResult;
}
