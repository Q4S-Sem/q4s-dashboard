import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { isAIConfigured, aiJSON } from "./ai";
import { aiFilterVacancy, aiImproveVacancy } from "./recruitment";
import { rematchVacancy } from "./matching";

/** Onbeoordeelde VMS-vacatures waar de pijplijn nog een oordeel over kan vormen:
 *  geen connector, of een connector waar automatisch filteren aan staat. Zonder
 *  dit filter zou de batch blijven hangen op vacatures die nooit een verdict
 *  krijgen (connector met autoFilter uit). Gedeeld door de werkbank en de batch. */
export const PROCESSABLE_VACANCY_WHERE: Prisma.VacancyWhereInput = {
  source: "VMS",
  relevance: "UNKNOWN",
  OR: [{ vmsConnectorId: null }, { vmsConnector: { autoFilter: true } }],
};

// ---------------------------------------------------------------------------
// MSP-intake: de automatische pijplijn voor vacatures die via een MSP/VMS
// (Magnit, Fieldglass, …) binnenkomen. Eén levering doorloopt:
//   levering → AI-relevantiefilter → website-format → LinkedIn-concept →
//   kandidaat-matches (met %) → melding voor de recruiter.
// De echte Magnit-API-key komt later; tot die tijd komt instroom binnen via de
// webhook (/api/msp/webhook), de testlevering (/msp) of handmatig plakken.
// Elke stap is best-effort en werkt óók zonder AI (stappen worden dan eerlijk
// als "overgeslagen" gerapporteerd).
// ---------------------------------------------------------------------------

export type IncomingVacancy = {
  /** Extern ID bij het platform — dedupliceert herhaalde leveringen. */
  externalId?: string | null;
  title: string;
  /** De ruwe vacaturetekst. */
  description: string;
  company?: string | null;
  location?: string | null;
  discipline?: string | null;
  employmentType?: string | null;
  salary?: string | null;
  url?: string | null;
};

export type PipelineStep = {
  key: "filter" | "improve" | "publish" | "post" | "match" | "alert";
  label: string;
  status: "done" | "skipped" | "failed";
  note?: string;
};

export type PipelineResult = {
  vacancyId: string;
  title: string;
  /** null = (nog) niet beoordeeld. */
  relevant: boolean | null;
  steps: PipelineStep[];
  matchCount: number;
  /** Beste matchpercentage (0-100), of null zonder matches. */
  bestScorePct: number | null;
};

function slugify(s: string): string {
  const base = s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "vacature"}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Is er genoeg website-content om te publiceren? (zelfde lat als de vacaturepagina) */
function hasWebsiteContent(v: {
  improvedText: string | null;
  summary: string | null;
  responsibilities: string | null;
  requirements: string | null;
}): boolean {
  return Boolean(v.improvedText || v.summary || v.responsibilities || v.requirements);
}

/** Schrijf een melding voor de recruiters (zichtbaar op /msp + het belletje). */
export async function createAlert(input: {
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
  vacancyId?: string | null;
  vmsConnectorId?: string | null;
}) {
  return db.recruiterAlert.create({
    data: {
      type: input.type,
      title: input.title.slice(0, 300),
      body: input.body?.slice(0, 1000) ?? null,
      href: input.href ?? null,
      vacancyId: input.vacancyId ?? null,
      vmsConnectorId: input.vmsConnectorId ?? null,
    },
  });
}

/**
 * Neem een levering vacatures op voor een connector. Dedupliceert op
 * externalId (zelfde platform) en anders op exacte titel bij die connector.
 * Retourneert de ids van nieuw aangemaakte vacatures.
 */
export async function intakeVacancies(
  connectorId: string,
  items: IncomingVacancy[],
): Promise<{ createdIds: string[]; skipped: number }> {
  const createdIds: string[] = [];
  let skipped = 0;

  for (const raw of items) {
    const title = (raw.title ?? "").trim().slice(0, 200);
    const description = (raw.description ?? "").trim().slice(0, 20000);
    if (!title || !description) {
      skipped++;
      continue;
    }

    const externalId = raw.externalId?.trim().slice(0, 120) || null;
    const dupe = externalId
      ? await db.vacancy.findFirst({ where: { vmsConnectorId: connectorId, externalId } })
      : await db.vacancy.findFirst({ where: { vmsConnectorId: connectorId, title } });
    if (dupe) {
      skipped++;
      continue;
    }

    try {
      const created = await db.vacancy.create({
        data: {
          title,
          rawText: description,
          companyName: raw.company?.trim().slice(0, 120) || null,
          location: raw.location?.trim().slice(0, 120) || null,
          discipline: raw.discipline?.trim().slice(0, 60) || null,
          employmentType: raw.employmentType?.trim().slice(0, 60) || null,
          salary: raw.salary?.trim().slice(0, 120) || null,
          sourceUrl: raw.url?.trim().slice(0, 500) || null,
          externalId,
          source: "VMS",
          vmsConnectorId: connectorId,
          status: "CONCEPT",
          relevance: "UNKNOWN",
          slug: slugify(title),
        },
      });
      createdIds.push(created.id);
    } catch (e) {
      // Unique-constraint (vmsConnectorId, externalId): gelijktijdige levering
      // van hetzelfde item — telt als duplicaat, nooit als fout.
      if ((e as { code?: string })?.code === "P2002") skipped++;
      else throw e;
    }
  }

  return { createdIds, skipped };
}

/** Absolute (of interne) link naar de publieke vacaturepagina. */
function publicVacancyUrl(slug: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/+$/, "");
  return base ? `${base}/vacature/${slug}` : `/vacature/${slug}`;
}

/** Terugval-LinkedIn-post zonder AI: sober en feitelijk. De solliciteer-link
 *  gaat alleen mee als de vacature ook echt live staat (anders 404). */
function fallbackLinkedinPost(v: {
  title: string;
  companyName: string | null;
  location: string | null;
  slug: string;
  published: boolean;
}): string {
  const lines = [
    `Nieuwe opdracht via Q4S: ${v.title}`,
    [v.companyName, v.location].filter(Boolean).join(" — "),
    "",
    ...(v.published
      ? ["Interesse of iemand in je netwerk? Reageer of solliciteer direct:", publicVacancyUrl(v.slug)]
      : ["Interesse of iemand in je netwerk? Stuur ons een bericht."]),
    "",
    "#Q4S #vacature #techniek",
  ];
  return lines.join("\n");
}

const AI_MATCH_CAP = 8;

const REFINE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    matches: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          candidateId: { type: "string" },
          score: { type: "number" },
          reason: { type: "string" },
        },
        required: ["candidateId", "score", "reason"],
      },
    },
  },
  required: ["matches"],
} as const;

/**
 * Verfijn de regel-gebaseerde matches met AI: score 0-100 tegen de eisen van
 * de vacature, met een korte onderbouwing. Best-effort (fast model); bij een
 * fout blijven de regel-scores gewoon staan.
 */
export async function aiRefineMatches(vacancyId: string): Promise<void> {
  if (!isAIConfigured()) return;

  const vacancy = await db.vacancy.findUnique({
    where: { id: vacancyId },
    include: {
      matches: {
        include: { candidate: true },
        orderBy: { score: "desc" },
        take: AI_MATCH_CAP,
      },
    },
  });
  if (!vacancy || vacancy.matches.length === 0) return;

  const eisen = [vacancy.requirements, vacancy.summary, vacancy.rawText]
    .filter(Boolean)
    .join("\n")
    .slice(0, 4000);
  const kandidaten = vacancy.matches
    .map((m) => {
      const c = m.candidate;
      return `- id: ${c.id} | ${c.firstName} ${c.lastName} | discipline: ${c.discipline ?? "?"} | profiel: ${c.headline ?? "-"} | regio: ${c.location ?? "?"}`;
    })
    .join("\n");

  try {
    const result = await aiJSON<{ matches: { candidateId: string; score: number; reason: string }[] }>({
      system:
        "Je bent een technische recruiter bij Q4S. Je scoort hoe goed kandidaten passen bij de eisen van een vacature. Wees streng en realistisch: 90+ alleen bij een duidelijke één-op-één-match, onder 50 als essentiële eisen ontbreken. Onderbouw kort en zakelijk in het Nederlands.",
      prompt: `VACATURE: ${vacancy.title}\n\nEISEN / OMSCHRIJVING:\n${eisen}\n\nKANDIDATEN:\n${kandidaten}\n\nGeef per kandidaat (gebruik exact het aangeleverde id) een score 0-100 en een korte reden.`,
      schema: REFINE_SCHEMA as unknown as Record<string, unknown>,
      schemaName: "match_scores",
      fast: true,
      maxTokens: 1500,
    });

    const known = new Set(vacancy.matches.map((m) => m.candidateId));
    for (const m of result.matches) {
      if (!known.has(m.candidateId) || !Number.isFinite(m.score)) continue;
      const pct = Math.max(0, Math.min(100, Math.round(m.score)));
      await db.vacancyMatch.update({
        where: { vacancyId_candidateId: { vacancyId, candidateId: m.candidateId } },
        data: { score: pct / 100, reason: `AI: ${m.reason}`.slice(0, 500) },
      });
    }
  } catch {
    // AI-verfijning is optioneel — regel-scores blijven staan.
  }
}

/**
 * De intake-pijplijn voor één vacature, gestuurd door de connector-instellingen
 * (auto-filter/-verbeteren/-publiceren/-post/-matchen/-melden). Elke stap is
 * best-effort en wordt eerlijk gerapporteerd. Werkt ook zonder connector
 * (alles aan) en zonder AI (AI-stappen overgeslagen).
 */
export async function runIntakePipeline(vacancyId: string): Promise<PipelineResult> {
  const steps: PipelineStep[] = [];
  const vacancy = await db.vacancy.findUnique({
    where: { id: vacancyId },
    include: { vmsConnector: true, socialPosts: { select: { id: true } } },
  });
  if (!vacancy) {
    return { vacancyId, title: "?", relevant: null, steps, matchCount: 0, bestScorePct: null };
  }

  const c = vacancy.vmsConnector;
  const cfg = {
    autoFilter: c?.autoFilter ?? true,
    autoImprove: c?.autoImprove ?? true,
    autoPublishSite: c?.autoPublishSite ?? true,
    autoDraftPost: c?.autoDraftPost ?? true,
    autoMatch: c?.autoMatch ?? true,
    notifyRecruiter: c?.notifyRecruiter ?? true,
  };
  const ai = isAIConfigured();

  // 1. Relevantiefilter (Q4S-niche).
  let relevance = vacancy.relevance;
  let filterJustRan = false;
  if (relevance !== "UNKNOWN") {
    steps.push({ key: "filter", label: "AI-filter", status: "done", note: "al beoordeeld" });
  } else if (!cfg.autoFilter) {
    steps.push({ key: "filter", label: "AI-filter", status: "skipped", note: "automatisch filteren staat uit" });
  } else if (!ai) {
    steps.push({ key: "filter", label: "AI-filter", status: "skipped", note: "AI niet geconfigureerd" });
  } else {
    try {
      relevance = await aiFilterVacancy(vacancy.id);
      filterJustRan = true;
      steps.push({ key: "filter", label: "AI-filter", status: "done" });
    } catch (e) {
      steps.push({
        key: "filter",
        label: "AI-filter",
        status: "failed",
        note: e instanceof Error ? e.message.slice(0, 120) : "fout",
      });
    }
  }

  const relevant = relevance === "RELEVANT" ? true : relevance === "IRRELEVANT" ? false : null;

  // Niet relevant → contentstappen slaan we over; melden alleen bij een verse beoordeling.
  if (relevant === false) {
    steps.push(
      { key: "improve", label: "Website-format", status: "skipped", note: "niet relevant" },
      { key: "publish", label: "Live op site", status: "skipped", note: "niet relevant" },
      { key: "post", label: "LinkedIn-concept", status: "skipped", note: "niet relevant" },
      { key: "match", label: "Matchen", status: "skipped", note: "niet relevant" },
    );
    if (cfg.notifyRecruiter && filterJustRan) {
      await createAlert({
        type: "VACANCY_IRRELEVANT",
        title: `Buiten de niche: ${vacancy.title}`,
        body: "De AI beoordeelde deze vacature als niet relevant voor Q4S. Controleer op /vacaturehub als je twijfelt.",
        href: `/vacatures/${vacancy.id}`,
        vacancyId: vacancy.id,
        vmsConnectorId: vacancy.vmsConnectorId,
      });
      steps.push({ key: "alert", label: "Melding", status: "done" });
    } else {
      steps.push({
        key: "alert",
        label: "Melding",
        status: "skipped",
        note: cfg.notifyRecruiter ? "geen nieuwe beoordeling" : "meldingen staan uit",
      });
    }
    return { vacancyId: vacancy.id, title: vacancy.title, relevant, steps, matchCount: 0, bestScorePct: null };
  }

  // 2. Website-format (AI-uitschrijven in de vaste sitesecties).
  let content = hasWebsiteContent(vacancy);
  let improvedNow = false;
  const mayImprove = relevant === true; // onbeoordeeld (AI uit) → niet ongevraagd uitschrijven
  if (content) {
    steps.push({ key: "improve", label: "Website-format", status: "done", note: "content al aanwezig" });
  } else if (!cfg.autoImprove || !mayImprove) {
    steps.push({
      key: "improve",
      label: "Website-format",
      status: "skipped",
      note: !cfg.autoImprove ? "automatisch uitschrijven staat uit" : "relevantie nog onbeoordeeld",
    });
  } else if (!ai) {
    steps.push({ key: "improve", label: "Website-format", status: "skipped", note: "AI niet geconfigureerd" });
  } else {
    try {
      await aiImproveVacancy(vacancy.id);
      content = true;
      improvedNow = true;
      steps.push({ key: "improve", label: "Website-format", status: "done" });
    } catch (e) {
      steps.push({
        key: "improve",
        label: "Website-format",
        status: "failed",
        note: e instanceof Error ? e.message.slice(0, 120) : "fout",
      });
    }
  }

  // 3. Publiceren op de website (alleen relevante vacatures mét content).
  // PAUSED = een bewuste keuze van de recruiter — daar blijft de pijplijn vanaf.
  let published = vacancy.status === "PUBLISHED";
  let publishedNow = false;
  if (published) {
    steps.push({ key: "publish", label: "Live op site", status: "done", note: "stond al live" });
  } else if (vacancy.status === "PAUSED") {
    steps.push({
      key: "publish",
      label: "Live op site",
      status: "skipped",
      note: "handmatig gepauzeerd — niet opnieuw gepubliceerd",
    });
  } else if (!cfg.autoPublishSite) {
    steps.push({ key: "publish", label: "Live op site", status: "skipped", note: "automatisch publiceren staat uit" });
  } else if (relevant !== true) {
    steps.push({ key: "publish", label: "Live op site", status: "skipped", note: "relevantie nog onbeoordeeld" });
  } else if (!content) {
    steps.push({ key: "publish", label: "Live op site", status: "skipped", note: "nog geen website-content" });
  } else {
    await db.vacancy.update({
      where: { id: vacancy.id },
      data: { status: "PUBLISHED", publishedAt: vacancy.publishedAt ?? new Date() },
    });
    published = true;
    publishedNow = true;
    steps.push({ key: "publish", label: "Live op site", status: "done" });
  }

  // 4. LinkedIn-concept klaarzetten in de Socials-hub — alleen voor vacatures
  // die als relevant zijn beoordeeld (zelfde lat als publiceren).
  let postCreated = vacancy.socialPosts.length > 0;
  let postCreatedNow = false;
  if (postCreated) {
    steps.push({ key: "post", label: "LinkedIn-concept", status: "done", note: "post bestaat al" });
  } else if (!cfg.autoDraftPost) {
    steps.push({ key: "post", label: "LinkedIn-concept", status: "skipped", note: "automatische post staat uit" });
  } else if (relevant !== true) {
    steps.push({ key: "post", label: "LinkedIn-concept", status: "skipped", note: "relevantie nog onbeoordeeld" });
  } else {
    const fresh = await db.vacancy.findUnique({
      where: { id: vacancy.id },
      select: { linkedinPost: true, title: true, companyName: true, location: true, slug: true },
    });
    const body =
      fresh?.linkedinPost?.trim() ||
      fallbackLinkedinPost({
        title: fresh?.title ?? vacancy.title,
        companyName: fresh?.companyName ?? vacancy.companyName,
        location: fresh?.location ?? vacancy.location,
        slug: fresh?.slug ?? vacancy.slug,
        published,
      });
    await db.socialPost.create({
      data: {
        title: `LinkedIn — ${vacancy.title}`.slice(0, 200),
        platform: "LINKEDIN",
        content: body,
        status: "DRAFT",
        vacancyId: vacancy.id,
        topic: "MSP-intake (automatisch klaargezet)",
      },
    });
    postCreated = true;
    postCreatedNow = true;
    steps.push({
      key: "post",
      label: "LinkedIn-concept",
      status: "done",
      note: fresh?.linkedinPost
        ? undefined
        : published
          ? "zonder AI: sobere terugvaltekst"
          : "zonder AI: terugvaltekst, link volgt na publicatie",
    });
  }

  // 5. Kandidaten matchen met percentage.
  let matchCount = 0;
  let bestScorePct: number | null = null;
  let foundNewMatches = false;
  if (!cfg.autoMatch) {
    steps.push({ key: "match", label: "Matchen", status: "skipped", note: "automatisch matchen staat uit" });
  } else {
    try {
      const priorMatches = await db.vacancyMatch.count({ where: { vacancyId: vacancy.id } });
      await rematchVacancy(vacancy.id);
      matchCount = await db.vacancyMatch.count({ where: { vacancyId: vacancy.id } });
      if (matchCount > 0) await aiRefineMatches(vacancy.id);
      const best = await db.vacancyMatch.findFirst({
        where: { vacancyId: vacancy.id },
        orderBy: { score: "desc" },
        select: { score: true },
      });
      bestScorePct = best ? Math.round(best.score * 100) : null;
      foundNewMatches = matchCount > priorMatches;
      steps.push({
        key: "match",
        label: "Matchen",
        status: "done",
        note: matchCount > 0 ? `${matchCount} match(es), beste ${bestScorePct}%` : "geen matches ≥ drempel",
      });
    } catch (e) {
      steps.push({
        key: "match",
        label: "Matchen",
        status: "failed",
        note: e instanceof Error ? e.message.slice(0, 120) : "fout",
      });
    }
  }

  // 6. Melding voor de recruiter — alleen als er deze run daadwerkelijk iets
  // veranderde (voorkomt melding-spam bij opnieuw verwerken).
  const progressed = filterJustRan || improvedNow || publishedNow || postCreatedNow || foundNewMatches;
  if (cfg.notifyRecruiter && progressed) {
    const parts = [
      vacancy.companyName ? `Bedrijf: ${vacancy.companyName}.` : null,
      publishedNow ? "Nu live op de website." : published ? "Staat live op de website." : null,
      postCreatedNow ? "LinkedIn-concept staat klaar in de Socials-hub." : null,
      matchCount > 0
        ? `${matchCount} kandida${matchCount === 1 ? "at" : "ten"} match${matchCount === 1 ? "t" : "en"} (beste ${bestScorePct}%).`
        : "Nog geen kandidaat-matches gevonden.",
    ].filter(Boolean);
    await createAlert({
      type: matchCount > 0 ? "MATCHES_FOUND" : "VACANCY_RELEVANT",
      title:
        relevant === true
          ? `Relevante vacature verwerkt: ${vacancy.title}`
          : `Vacature binnengekomen (nog onbeoordeeld): ${vacancy.title}`,
      body: parts.join(" "),
      href: `/vacatures/${vacancy.id}`,
      vacancyId: vacancy.id,
      vmsConnectorId: vacancy.vmsConnectorId,
    });
    steps.push({ key: "alert", label: "Melding", status: "done" });
  } else {
    steps.push({
      key: "alert",
      label: "Melding",
      status: "skipped",
      note: cfg.notifyRecruiter ? "geen nieuwe voortgang" : "meldingen staan uit",
    });
  }

  return { vacancyId: vacancy.id, title: vacancy.title, relevant, steps, matchCount, bestScorePct };
}

// --- Testlevering (demo vóórdat de echte API-key er is) ----------------------

const SIMULATED_DELIVERY: Omit<IncomingVacancy, "externalId">[] = [
  {
    title: "2× Pijplasser 6G (TIG) — onderhoudsstop",
    description:
      "Voor een onderhoudsstop bij een petrochemische plant in de Botlek zoeken wij per direct twee pijplassers 6G (TIG/RVS). Geldige lascertificaten en VCA vereist; ploegendienst; duur 6 weken met kans op verlenging.",
    company: "Via Magnit — petrochemie Botlek",
    location: "Botlek, Rotterdam",
    discipline: "LASSEN",
    employmentType: "Fulltime",
    salary: "Marktconform uurtarief",
  },
  {
    title: "NDT Inspector Level 2 UT/MT — offshore wind",
    description:
      "Voor de fabricage van monopiles zoeken wij een NDT Inspector Level 2 (UT en MT). Ervaring met lasnaadinspectie op zware constructies, rapportage in het Engels, GWO-certificaten zijn een pré. Start over 3 weken.",
    company: "Via Magnit — offshore wind fabricage",
    location: "Vlissingen",
    discipline: "NDO",
    employmentType: "Fulltime",
  },
  {
    title: "QA/QC Engineer piping — nieuwbouwproject",
    description:
      "Voor een nieuwbouwproject in de energiesector zoeken wij een QA/QC Engineer piping. Je beoordeelt lasboeken, ITP's en materiaalcertificaten en stuurt de kwaliteitsinspecties aan. HBO werk- en denkniveau, ervaring met NEN-EN 13480.",
    company: "Via Magnit — energiesector",
    location: "Eemshaven",
    discipline: "QA",
    employmentType: "Fulltime",
  },
  {
    title: "Officemanager hoofdkantoor",
    description:
      "Voor ons hoofdkantoor zoeken wij een officemanager voor agenda's, facilitaire zaken en receptie. MBO+, ervaring met MS Office.",
    company: "Via Magnit — zakelijke dienstverlening",
    location: "Utrecht",
    employmentType: "Parttime",
  },
];

/**
 * Simuleer een Magnit-levering: 4 realistische vacatures (waarvan 1 buiten de
 * niche, zodat het filter zichtbaar z'n werk doet) → volledige pijplijn.
 */
export async function simulateMspDelivery(connectorKey = "magnit"): Promise<{
  connectorId: string;
  connectorName: string;
  created: number;
  skipped: number;
  results: PipelineResult[];
}> {
  let connector = await db.vmsConnector.findUnique({ where: { key: connectorKey } });
  if (!connector) {
    connector = await db.vmsConnector.create({
      data: { name: "Magnit", key: connectorKey, status: "MANUAL", priority: 5 },
    });
  }

  // Stabiele externalIds: een tweede klik wordt als duplicaat overgeslagen
  // (net als een echte herlevering van hetzelfde item), i.p.v. duplicaten aan
  // te maken die vervolgens live op de site zouden komen.
  const items: IncomingVacancy[] = SIMULATED_DELIVERY.map((v, i) => ({
    ...v,
    externalId: `SIM-${i + 1}`,
  }));

  const { createdIds, skipped } = await intakeVacancies(connector.id, items);
  await db.vmsConnector.update({ where: { id: connector.id }, data: { lastSyncAt: new Date() } });
  await createAlert({
    type: "SYNC",
    title:
      createdIds.length > 0
        ? `Testlevering via ${connector.name}: ${createdIds.length} vacature(s) ontvangen`
        : `Testlevering via ${connector.name}: geen nieuwe (alle ${skipped} al aanwezig)`,
    body: "Gesimuleerde levering — zo werkt de koppeling straks met de echte API-key.",
    href: "/vacaturehub",
    vmsConnectorId: connector.id,
  });

  const results: PipelineResult[] = [];
  for (const id of createdIds) {
    results.push(await runIntakePipeline(id));
  }

  return {
    connectorId: connector.id,
    connectorName: connector.name,
    created: createdIds.length,
    skipped,
    results,
  };
}

// --- Echte API-pull (stub tot de Magnit-key er is) ---------------------------

type ConnectorWithApi = {
  id: string;
  name: string;
  apiBaseUrl: string | null;
  apiKey: string | null;
};

/** Hoeveel vacatures per pull/webhook-request synchroon door de AI-pijplijn
 *  mogen (de rest blijft als UNKNOWN in de werkbank staan). Gedeeld door pull
 *  en webhook zodat één plek de zwaarte bepaalt. */
export const MSP_PIPELINE_CAP = 10;

/** Blokkeer private/link-local/loopback-hosts (SSRF-verdediging, incl. cloud-metadata). */
export function isBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (h === "localhost" || h.endsWith(".localhost") || h === "metadata.google.internal") return true;
  // IPv6 loopback / unique-local / link-local.
  if (h === "::1" || h === "::" || h.startsWith("fe80:") || h.startsWith("fc") || h.startsWith("fd")) return true;
  // IPv4 private / loopback / link-local ranges.
  const m = h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (m) {
    const [a, b] = [Number(m[1]), Number(m[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 169 && b === 254) return true; // link-local incl. 169.254.169.254 metadata
  }
  return false;
}

/**
 * Bouw de safe fetch-URL voor een MSP-basis-URL. Eist https en weigert
 * private/loopback-hosts. Gooit bij een onveilige of ongeldige URL.
 */
export function buildMspUrl(base: string, path = "/vacancies"): URL {
  const url = new URL(`${base.replace(/\/+$/, "")}${path}`);
  if (url.protocol !== "https:") throw new Error("Alleen https is toegestaan voor de API-basis-URL.");
  if (isBlockedHost(url.hostname)) throw new Error("De API-host is niet toegestaan (privé/loopback).");
  return url;
}

export type FetchResult =
  | { ok: true; items: IncomingVacancy[] }
  | { ok: false; error: string };

/**
 * Haal vacatures op bij het MSP via de API. Generieke REST-aanname
 * (GET <base>/vacancies, Bearer-key, JSON-array); zodra de echte
 * Magnit-documentatie er is hoeft alleen deze mapper aangepast te worden.
 * Retourneert een expliciet resultaat zodat een fout niet als "0 nieuwe"
 * verdwijnt.
 */
export async function fetchMspVacancies(connector: ConnectorWithApi): Promise<FetchResult> {
  if (!connector.apiKey || !connector.apiBaseUrl) {
    return { ok: false, error: "Geen API-key of basis-URL ingesteld." };
  }
  let url: URL;
  try {
    url = buildMspUrl(connector.apiBaseUrl);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Ongeldige API-basis-URL." };
  }
  try {
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${connector.apiKey}`, accept: "application/json" },
      cache: "no-store",
      redirect: "error", // geen redirect naar een andere (mogelijk private) host
    });
    if (!res.ok) return { ok: false, error: `API gaf status ${res.status}.` };
    const data = (await res.json()) as unknown;
    const list = Array.isArray(data)
      ? data
      : Array.isArray((data as { vacancies?: unknown[] })?.vacancies)
        ? (data as { vacancies: unknown[] }).vacancies
        : [];
    const items = list
      .map((raw) => {
        const r = raw as Record<string, unknown>;
        const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);
        return {
          externalId: str(r.externalId) ?? str(r.id) ?? str(r.reference),
          title: str(r.title) ?? str(r.name) ?? "",
          description: str(r.description) ?? str(r.body) ?? str(r.text) ?? "",
          company: str(r.company) ?? str(r.client),
          location: str(r.location) ?? str(r.city),
          discipline: str(r.discipline),
          employmentType: str(r.employmentType),
          salary: str(r.salary) ?? str(r.rate),
          url: str(r.url) ?? str(r.link),
        } satisfies IncomingVacancy;
      })
      .filter((v) => v.title && v.description)
      .slice(0, 25);
    return { ok: true, items };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message.slice(0, 120) : "Kon de API niet bereiken." };
  }
}

export type PullResult = {
  ok: boolean;
  received: number;
  created: number;
  results: PipelineResult[];
  error?: string;
};

/** Pull + intake + pijplijn voor één connector met API-koppeling. `null` alleen
 *  als er geen koppeling is ingesteld. */
export async function pullConnector(connectorId: string): Promise<PullResult | null> {
  const connector = await db.vmsConnector.findUnique({ where: { id: connectorId } });
  if (!connector?.apiKey || !connector.apiBaseUrl) return null;

  const fetched = await fetchMspVacancies(connector);
  if (!fetched.ok) {
    // Fout → lastSyncAt NIET bijwerken, en een zichtbare ERROR-melding maken.
    await createAlert({
      type: "ERROR",
      title: `${connector.name}: API-pull mislukt`,
      body: fetched.error,
      href: "/vacaturehub",
      vmsConnectorId: connector.id,
    });
    return { ok: false, received: 0, created: 0, results: [], error: fetched.error };
  }

  const { createdIds } = await intakeVacancies(connector.id, fetched.items);
  await db.vmsConnector.update({ where: { id: connector.id }, data: { lastSyncAt: new Date() } });

  if (createdIds.length > 0) {
    await createAlert({
      type: "SYNC",
      title: `${connector.name}: ${createdIds.length} nieuwe vacature(s) via de API`,
      href: "/vacaturehub",
      vmsConnectorId: connector.id,
    });
  }

  const results: PipelineResult[] = [];
  for (const id of createdIds.slice(0, MSP_PIPELINE_CAP)) {
    results.push(await runIntakePipeline(id));
  }
  return { ok: true, received: fetched.items.length, created: createdIds.length, results };
}
