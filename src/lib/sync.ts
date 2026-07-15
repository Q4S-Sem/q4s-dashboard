import { db } from "./db";
import { isAIConfigured, aiSourceVacancies } from "./ai";
import { aiFilterVacancy } from "./recruitment";
import { rematchVacancy } from "./matching";
import { pullConnector, aiRefineMatches } from "./msp";
import { runAutomations } from "./automation";
import { RECRUITMENT_FIELDS } from "./domain";

// AI runs synchronously inside the request, so bound the per-run work. For real
// scale this should be a background queue; the daily cron + these caps keep it
// well within a single request.
const FILTER_CAP = 12;
const MATCH_CAP = 30;

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "vacature"
  );
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
  const run = await db.syncRun.create({ data: { trigger, status: "RUNNING" } });
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

    // 1. AI web-search sourcing (best-effort; finds publicly posted vacancies).
    if (isAIConfigured()) {
      const found = await aiSourceVacancies({ fields: RECRUITMENT_FIELDS, max: 8 });
      for (const f of found) {
        const title = f.title.trim().slice(0, 200);
        if (!title) continue;
        const exists = await db.vacancy.findFirst({ where: { title } });
        if (exists) continue;
        const rawText = [f.summary, f.url].filter(Boolean).join("\n\n") || title;
        await db.vacancy.create({
          data: {
            title,
            rawText,
            location: f.location?.slice(0, 120) || null,
            companyName: f.company?.slice(0, 120) || null,
            source: "VMS",
            relevance: "UNKNOWN",
            status: "CONCEPT",
            slug: `${slugify(title)}-${Math.random().toString(36).slice(2, 8)}`,
          },
        });
        sourced++;
      }
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
    for (const v of unjudged) {
      try {
        const r = await aiFilterVacancy(v.id);
        filtered++;
        if (r === "RELEVANT") relevant++;
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
