"use server";

import { aiJSON, isAIConfigured } from "@/lib/ai";
import { db } from "@/lib/db";
import { HUBS, DASHBOARD_APP } from "@/components/nav";
import {
  DISCIPLINES,
  CANDIDATE_AVAILABILITY_ORDER,
  CANDIDATE_RATING_ORDER,
} from "@/lib/domain";

// ---------------------------------------------------------------------------
// Globale "Ask AI"-assistent. Doet drie dingen:
//  1) Navigatie: vragen beantwoorden en je naar de juiste pagina brengen.
//  2) Cijfervragen: lichte data-antwoorden uit een compacte snapshot.
//  3) Kandidaten zoeken: "ik zoek een lasser die nu beschikbaar is" → doorzoekt
//     de database op discipline/beschikbaarheid/plaats en geeft de mensen terug.
// Werkt met of zonder API-sleutel (zonder AI: trefwoord-router + -zoeker).
// ---------------------------------------------------------------------------

export type AssistantCandidate = {
  id: string;
  name: string;
  headline: string | null;
  discipline: string | null;
  availability: string;
  location: string | null;
};

export type AssistantReply = {
  answer: string;
  route: string | null;
  routeLabel: string | null;
  /** Kandidaat-zoekresultaten (bij een zoekvraag). */
  results?: AssistantCandidate[];
};

type RouteEntry = { href: string; label: string; hub: string };

/** Alle bereikbare pagina's uit de navigatie — de bron voor route-suggesties. */
function routeCatalog(): RouteEntry[] {
  const out: RouteEntry[] = [
    { href: DASHBOARD_APP.href, label: DASHBOARD_APP.label, hub: "Analytics" },
  ];
  for (const hub of HUBS) {
    for (const item of hub.items) {
      // Dubbele hrefs overslaan (bv. dashboard-overzicht).
      if (out.some((r) => r.href === item.href)) continue;
      out.push({ href: item.href, label: item.label, hub: hub.label });
    }
  }
  return out;
}

/** Compacte cijfer-snapshot voor eenvoudige data-vragen. */
async function dataSnapshot(): Promise<string> {
  const [candidates, available, welders, openVacancies, newApplications, openInvoices] =
    await Promise.all([
      db.candidate.count(),
      db.candidate.count({ where: { availability: { in: ["BESCHIKBAAR", "BINNENKORT"] } } }),
      db.candidate.count({
        where: { discipline: "LASSEN", availability: { in: ["BESCHIKBAAR", "BINNENKORT"] } },
      }),
      db.vacancy.count({ where: { status: { not: "CONCEPT" } } }),
      db.application.count({ where: { status: "NEW" } }),
      db.invoice.count({ where: { status: { in: ["DRAFT", "SENT", "OVERDUE"] } } }),
    ]);
  return [
    `Kandidaten totaal: ${candidates}`,
    `Kandidaten nu/binnenkort beschikbaar: ${available} (waarvan lassers: ${welders})`,
    `Openstaande vacatures: ${openVacancies}`,
    `Nieuwe sollicitaties: ${newApplications}`,
    `Openstaande facturen: ${openInvoices}`,
  ].join("\n");
}

// --- Kandidaten zoeken -------------------------------------------------------

type Avail = "NOW" | "SOON" | "AVAILABLE" | "ANY";
type CandidateFilters = { discipline: string | null; availability: Avail; location: string | null };

const DISCIPLINE_CODES = new Set(DISCIPLINES.map((d) => d.value));
const AVAIL_FILTER: Record<Avail, string[] | null> = {
  NOW: ["BESCHIKBAAR"],
  SOON: ["BINNENKORT"],
  AVAILABLE: ["BESCHIKBAAR", "BINNENKORT"],
  ANY: null,
};
const DISCIPLINE_NOUN: Record<string, string> = {
  LASSEN: "lassers",
  FITTER: "fitters",
  NDO: "NDO-specialisten",
  QA: "QA-kandidaten",
  QC: "QC-kandidaten",
  OVERIG: "kandidaten",
};

/** Diacritics-ongevoelig vouwen zodat "josé" ook "jose" matcht. */
function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Doorzoek de kandidaten-database op de gevraagde criteria. */
async function searchCandidates(
  f: CandidateFilters,
): Promise<{ results: AssistantCandidate[]; total: number }> {
  const where: {
    discipline?: string;
    availability?: { in: string[] };
    OR?: Array<Record<string, { contains: string }>>;
  } = {};
  if (f.discipline && DISCIPLINE_CODES.has(f.discipline)) where.discipline = f.discipline;
  const av = AVAIL_FILTER[f.availability];
  if (av) where.availability = { in: av };
  const term = f.location?.trim();
  if (term) {
    // Zelfde brede zoekterm als de talentpool (?q), zodat het getoonde aantal
    // exact klopt met de "bekijk alles"-pagina waar we naartoe linken.
    where.OR = [
      { firstName: { contains: term } },
      { lastName: { contains: term } },
      { email: { contains: term } },
      { phone: { contains: term } },
      { headline: { contains: term } },
      { location: { contains: term } },
    ];
  }

  // Sorteer/beperk in de query (beschikbaar eerst), zodat de top-8 ook bij een
  // grote pool de écht best passende kandidaten zijn — niet een willekeurige
  // subset. De precieze rangschikking hieronder verfijnt binnen die set.
  const [rows, total] = await Promise.all([
    db.candidate.findMany({
      where,
      orderBy: [{ availability: "asc" }, { lastName: "asc" }],
      take: 200,
    }),
    db.candidate.count({ where }),
  ]);

  // Nu beschikbaar eerst, dan op beoordeling en tot slot alfabetisch.
  rows.sort((a, b) => {
    const aa = CANDIDATE_AVAILABILITY_ORDER[a.availability] ?? 9;
    const ba = CANDIDATE_AVAILABILITY_ORDER[b.availability] ?? 9;
    if (aa !== ba) return aa - ba;
    const ra = CANDIDATE_RATING_ORDER[a.rating] ?? 9;
    const rb = CANDIDATE_RATING_ORDER[b.rating] ?? 9;
    if (ra !== rb) return ra - rb;
    return a.lastName.localeCompare(b.lastName);
  });

  const results = rows.slice(0, 8).map((c) => ({
    id: c.id,
    name: `${c.firstName} ${c.lastName}`.trim(),
    headline: c.headline,
    discipline: c.discipline,
    availability: c.availability,
    location: c.location,
  }));
  return { results, total };
}

/** Bouw een "bekijk alles"-route naar de gefilterde kandidatenlijst. */
function buildSearchRoute(f: CandidateFilters): { href: string; label: string } {
  const params = new URLSearchParams();
  if (f.discipline && DISCIPLINE_CODES.has(f.discipline)) params.set("discipline", f.discipline);
  if (f.location?.trim()) params.set("q", f.location.trim());

  if (f.availability === "AVAILABLE") {
    const qs = params.toString();
    return {
      href: `/kandidaten/beschikbaar${qs ? `?${qs}` : ""}`,
      label: "Bekijk beschikbare kandidaten",
    };
  }
  if (f.availability === "NOW") params.set("availability", "BESCHIKBAAR");
  else if (f.availability === "SOON") params.set("availability", "BINNENKORT");
  const qs = params.toString();
  return { href: `/kandidaten${qs ? `?${qs}` : ""}`, label: "Bekijk in talentpool" };
}

/** Nette Nederlandse zin bij de zoekresultaten (server-side, dus altijd kloppend). */
function searchAnswer(f: CandidateFilters, total: number, shown: number): string {
  const noun = f.discipline ? DISCIPLINE_NOUN[f.discipline] ?? "kandidaten" : "kandidaten";
  const avail = {
    NOW: " die nu beschikbaar zijn",
    SOON: " die binnenkort beschikbaar zijn",
    AVAILABLE: " die nu of binnenkort beschikbaar zijn",
    ANY: "",
  }[f.availability];
  const loc = f.location?.trim() ? ` in ${f.location.trim()}` : "";
  if (total === 0) {
    return `Ik vond geen ${noun}${avail}${loc}. Pas je zoekopdracht aan of bekijk de talentpool.`;
  }
  const more = total > shown ? ` (de eerste ${shown} hieronder)` : "";
  return `Ik vond ${total} ${noun}${avail}${loc}${more}:`;
}

/** Trefwoord-detectie van een kandidaat-zoekvraag (fallback zonder AI). */
function keywordCandidateFilters(question: string): CandidateFilters | null {
  const s = fold(question);
  const discRules: { code: string; terms: string[] }[] = [
    { code: "LASSEN", terms: ["lasser", "lassen", "welder", "welding", "tig", "mig", "6g"] },
    { code: "FITTER", terms: ["fitter", "pijpfitter", "pipefitter"] },
    { code: "NDO", terms: ["ndo", "ndt", "niet destructief", "niet-destructief"] },
    { code: "QA", terms: ["quality assurance", "kwaliteitsborg"] },
    { code: "QC", terms: ["quality control", "kwaliteitscontrole"] },
  ];
  let discipline: string | null = null;
  for (const r of discRules) {
    if (r.terms.some((t) => s.includes(t))) {
      discipline = r.code;
      break;
    }
  }

  const hasAvail = /(beschikbaar|inzetbaar|\bvrij\b)/.test(s);
  const peopleWord = /(kandida|iemand|\bwie\b|welke|\bzoek\b|\bvind\b|persoon|mensen)/.test(s);
  let availability: Avail = "ANY";
  if (/binnenkort/.test(s)) availability = "SOON";
  else if (hasAvail && /\b(nu|direct|meteen|per direct|vandaag)\b/.test(s)) availability = "NOW";
  else if (hasAvail) availability = "AVAILABLE";

  // Alleen als zoekvraag behandelen bij een duidelijk signaal (discipline of
  // beschikbaarheid), zodat gewone navigatievragen niet gekaapt worden.
  if (!discipline && !hasAvail) return null;
  if (!discipline && !peopleWord && availability === "ANY") return null;
  return { discipline, availability, location: null };
}

/** Trefwoord-fallback: scoor elke route op woord-overlap + een paar synoniemen. */
function keywordRoute(question: string): RouteEntry | null {
  const q = question.toLowerCase();
  const catalog = routeCatalog();

  // Handmatige synoniemen → href (winnen als ze voorkomen).
  const synonyms: { terms: string[]; href: string }[] = [
    { terms: ["beschikbaar", "inzetbaar", "vrij"], href: "/kandidaten/beschikbaar" },
    { terms: ["kandidaat", "kandidaten", "talentpool", "cv"], href: "/kandidaten" },
    { terms: ["vacature", "vacatures"], href: "/vacatures" },
    { terms: ["sollicitatie", "sollicitaties", "pipeline"], href: "/sollicitaties" },
    { terms: ["crm", "opportunit", "deal"], href: "/crm" },
    { terms: ["opdrachtgever", "klant van", "prospect"], href: "/opdrachtgevers" },
    { terms: ["factuur", "facturen", "verkoop"], href: "/facturen" },
    { terms: ["inkoop", "inkoopfactuur"], href: "/inkoopfacturen" },
    { terms: ["verzend", "versturen", "verzendmap"], href: "/verzenden" },
    { terms: ["uren", "urenregistratie", "timesheet"], href: "/uren" },
    { terms: ["declaratie", "bonnetje", "onkosten"], href: "/declaraties" },
    { terms: ["agenda", "afspraak", "kalender"], href: "/agenda" },
    { terms: ["taak", "taken", "todo"], href: "/agenda/taken" },
    { terms: ["certificaat", "certificering", "vca"], href: "/certificeringen" },
    { terms: ["evaluatie", "beoordeling vcu"], href: "/evaluaties/vcu" },
    { terms: ["medewerker", "personeel"], href: "/medewerkers" },
    { terms: ["gebruiker", "inloggen", "toegang"], href: "/gebruikers" },
    { terms: ["social", "linkedin", "post"], href: "/socials" },
  ];
  for (const s of synonyms) {
    if (s.terms.some((t) => q.includes(t))) {
      const hit = catalog.find((r) => r.href === s.href);
      if (hit) return hit;
    }
  }

  // Anders: woord-overlap met de labels.
  let best: RouteEntry | null = null;
  let bestScore = 0;
  for (const r of catalog) {
    const words = r.label.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
    const score = words.reduce((s, w) => (q.includes(w) ? s + 1 : s), 0);
    if (score > bestScore) {
      bestScore = score;
      best = r;
    }
  }
  return bestScore > 0 ? best : null;
}

export async function askAssistant(question: string): Promise<AssistantReply> {
  const q = (question ?? "").trim();
  if (!q) return { answer: "Stel gerust een vraag over het dashboard.", route: null, routeLabel: null };

  const catalog = routeCatalog();

  // Zonder AI: eerst kijken of het een kandidaat-zoekvraag is, anders navigatie.
  if (!isAIConfigured()) {
    const cf = keywordCandidateFilters(q);
    if (cf) {
      const { results, total } = await searchCandidates(cf);
      const rt = buildSearchRoute(cf);
      return { answer: searchAnswer(cf, total, results.length), route: rt.href, routeLabel: rt.label, results };
    }
    const hit = keywordRoute(q);
    return {
      answer: hit
        ? `Dit vind je onder "${hit.label}" (${hit.hub}). Klik hieronder om er direct heen te gaan.`
        : "Ik kan je naar de juiste module verwijzen — noem bijvoorbeeld facturen, kandidaten, agenda of vacatures.",
      route: hit?.href ?? null,
      routeLabel: hit?.label ?? null,
    };
  }

  const snapshot = await dataSnapshot();
  const routesText = catalog.map((r) => `- ${r.href} — ${r.label} (${r.hub})`).join("\n");
  const disciplinesText = DISCIPLINES.map((d) => `${d.value} (${d.label})`).join(", ");

  const system = `Je bent de ingebouwde assistent van het Q4S Dashboard, een Nederlandse back-office voor technische detachering (QA/QC/lassen/fitters/NDO). Antwoord altijd in het Nederlands, kort en concreet (1-3 zinnen).

Je helpt op drie manieren:
1) NAVIGATIE: uitleggen waar iets staat en de gebruiker naar de juiste pagina sturen (veld "route").
2) CIJFERVRAGEN: eenvoudige aantallen beantwoorden op basis van de snapshot.
3) KANDIDATEN ZOEKEN: als de gebruiker mensen/kandidaten zoekt (bv. "ik zoek een lasser die nu beschikbaar is", "welke fitters zijn er in Rotterdam"), zet dan search.isCandidateSearch = true en vul de filters. Kies dan GEEN route (route = "").

Voor "route": kies ALTIJD exact één 'href' uit de onderstaande lijst (letterlijk overnemen). Verzin nooit een route. Past er niets of is het een kandidaat-zoekvraag, geef dan "" terug.

Voor "search":
- discipline: exact één code of "" (onbekend). Codes: ${disciplinesText}. "lasser/welder/TIG/MIG" = LASSEN, "fitter/pijpfitter" = FITTER, "NDO/NDT" = NDO.
- availability: "NOW" (nu/direct/per direct beschikbaar), "SOON" (binnenkort beschikbaar), "AVAILABLE" (nu óf binnenkort), of "ANY" (maakt niet uit / niet genoemd).
- location: plaats of regio als genoemd, anders "".

Beschikbare pagina's:
${routesText}

Actuele cijfers (snapshot):
${snapshot}`;

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      answer: { type: "string", description: "Kort antwoord in het Nederlands." },
      route: { type: "string", description: "Exacte href uit de lijst, of leeg." },
      routeLabel: { type: "string", description: "Korte knoptekst, bv. de paginanaam." },
      search: {
        type: "object",
        additionalProperties: false,
        properties: {
          isCandidateSearch: { type: "boolean" },
          discipline: { type: "string" },
          availability: { type: "string", enum: ["NOW", "SOON", "AVAILABLE", "ANY"] },
          location: { type: "string" },
        },
        required: ["isCandidateSearch", "discipline", "availability", "location"],
      },
    },
    required: ["answer", "route", "routeLabel", "search"],
  } as const;

  try {
    const res = await aiJSON<{
      answer: string;
      route: string;
      routeLabel: string;
      search: { isCandidateSearch: boolean; discipline: string; availability: string; location: string };
    }>({
      system,
      prompt: q,
      schema: schema as unknown as Record<string, unknown>,
      schemaName: "assistant_reply",
      maxTokens: 600,
      effort: "low",
    });

    // Kandidaat-zoekvraag → database doorzoeken en mensen teruggeven.
    if (res.search?.isCandidateSearch) {
      const avail = (["NOW", "SOON", "AVAILABLE", "ANY"] as const).includes(
        res.search.availability as Avail,
      )
        ? (res.search.availability as Avail)
        : "ANY";
      const filters: CandidateFilters = {
        discipline: res.search.discipline?.trim() || null,
        availability: avail,
        location: res.search.location?.trim() || null,
      };
      const { results, total } = await searchCandidates(filters);
      const rt = buildSearchRoute(filters);
      return { answer: searchAnswer(filters, total, results.length), route: rt.href, routeLabel: rt.label, results };
    }

    // Anders: navigatie/cijfers. Alleen een bestaande route teruggeven.
    const match = catalog.find((r) => r.href === res.route?.trim());
    return {
      answer: res.answer?.trim() || "Ik kon hier geen antwoord op vinden.",
      route: match?.href ?? null,
      routeLabel: match ? res.routeLabel?.trim() || match.label : null,
    };
  } catch {
    // AI-fout → trefwoord-fallback (eerst zoeken, dan navigatie).
    const cf = keywordCandidateFilters(q);
    if (cf) {
      const { results, total } = await searchCandidates(cf);
      const rt = buildSearchRoute(cf);
      return { answer: searchAnswer(cf, total, results.length), route: rt.href, routeLabel: rt.label, results };
    }
    const hit = keywordRoute(q);
    return {
      answer: hit
        ? `Ik kan je in elk geval naar "${hit.label}" (${hit.hub}) brengen.`
        : "Er ging iets mis bij het beantwoorden. Probeer het later opnieuw.",
      route: hit?.href ?? null,
      routeLabel: hit?.label ?? null,
    };
  }
}
