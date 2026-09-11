import "server-only";
import { db } from "./db";
import { aiJSON, readyPersonalDataTextProvider } from "./ai";
import { labelFor, DISCIPLINES, CANDIDATE_RATINGS } from "./domain";

// ---------------------------------------------------------------------------
// Kandidaat <-> vacature matching voor de Bedrijfswerkruimte.
//
// Twee lagen:
//  1. AI-ranking (personalData-safe: Anthropic of lokale Ollama, NOOIT DeepSeek)
//     — leest de vacature-eisen + de kandidaatprofielen en geeft een 0..100 score
//     met een korte Nederlandse onderbouwing.
//  2. Gratis, deterministische fallback (discipline + trefwoord- + regio-overlap)
//     zodat de knop OOK werkt zonder AVG-veilige AI-sleutel.
//
// De uitkomst wordt in VacancyMatch bewaard (score 0..1) zodat de kaart de laatste
// ranking toont zonder opnieuw te hoeven draaien.
// ---------------------------------------------------------------------------

const STOP = new Set([
  "de", "het", "een", "en", "van", "voor", "met", "in", "op", "te", "bij", "of",
  "der", "aan", "naar", "per", "als", "die", "dat", "you", "and", "the", "for",
]);

function tokens(s: string | null | undefined): Set<string> {
  if (!s) return new Set();
  return new Set(
    s
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length >= 3 && !STOP.has(w)),
  );
}

export type CandidateMatch = {
  candidateId: string;
  /** 0..1 */
  score: number;
  reason: string;
};

type VacancyRow = {
  id: string;
  title: string;
  rawText: string;
  discipline: string | null;
  location: string | null;
  requirements: string | null;
  summary: string | null;
};

type CandidateRow = {
  id: string;
  firstName: string;
  lastName: string;
  discipline: string | null;
  headline: string | null;
  location: string | null;
  rating: string;
  experienceSummary: string | null;
};

/** Gratis, deterministische score (geen AI): discipline + trefwoord- + regio-overlap. */
function ruleScore(v: VacancyRow, c: CandidateRow): CandidateMatch {
  let s = 0;
  const reasons: string[] = [];

  if (c.discipline && v.discipline && c.discipline === v.discipline) {
    s += 0.7;
    reasons.push(`zelfde discipline (${labelFor(DISCIPLINES, c.discipline)})`);
  }

  const vt = tokens(`${v.title} ${v.requirements ?? ""} ${v.summary ?? ""} ${v.rawText}`);
  const ct = tokens(`${c.headline ?? ""} ${c.discipline ?? ""} ${c.experienceSummary ?? ""}`);
  let overlap = 0;
  for (const w of ct) if (vt.has(w)) overlap++;
  if (overlap > 0) {
    s += Math.min(0.3, 0.06 * overlap);
    reasons.push(`${overlap} overeenkomend(e) trefwoord(en)`);
  }

  const vloc = tokens(v.location);
  const cloc = tokens(c.location);
  if (cloc.size && [...cloc].some((w) => vloc.has(w))) {
    s += 0.1;
    reasons.push("zelfde regio");
  }

  return {
    candidateId: c.id,
    score: Math.min(1, Math.round(s * 100) / 100),
    reason: reasons.join(", ") || "beperkte overeenkomst",
  };
}

/** AI-ranking (AVG-veilig). Gooit als er geen personalData-provider is. */
async function aiRank(v: VacancyRow, candidates: CandidateRow[]): Promise<CandidateMatch[]> {
  const provider = readyPersonalDataTextProvider();
  if (!provider) throw new Error("no-personal-data-provider");

  const vacancyBlock = [
    `Titel: ${v.title}`,
    v.discipline ? `Discipline: ${labelFor(DISCIPLINES, v.discipline)}` : null,
    v.location ? `Locatie: ${v.location}` : null,
    v.summary ? `Samenvatting: ${v.summary}` : null,
    v.requirements ? `Functie-eisen:\n${v.requirements}` : null,
    !v.requirements && v.rawText ? `Vacaturetekst:\n${v.rawText.slice(0, 2000)}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const candidateBlock = candidates
    .map((c) => {
      const parts = [
        `id: ${c.id}`,
        `naam: ${c.firstName} ${c.lastName}`,
        c.discipline ? `discipline: ${labelFor(DISCIPLINES, c.discipline)}` : null,
        c.headline ? `functie: ${c.headline}` : null,
        c.location ? `locatie: ${c.location}` : null,
        `beoordeling: ${labelFor(CANDIDATE_RATINGS, c.rating)}`,
        c.experienceSummary ? `ervaring: ${c.experienceSummary.slice(0, 600)}` : null,
      ].filter(Boolean);
      return `- ${parts.join(" | ")}`;
    })
    .join("\n");

  const schema = {
    type: "object",
    additionalProperties: false,
    properties: {
      matches: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            score: { type: "number", description: "0-100 hoe goed de kandidaat past" },
            reason: { type: "string", description: "korte Nederlandse onderbouwing, max 1 zin" },
          },
          required: ["id", "score", "reason"],
        },
      },
    },
    required: ["matches"],
  };

  const result = await aiJSON<{ matches: { id: string; score: number; reason: string }[] }>({
    system:
      "Je bent een recruitment-matcher voor Q4S, een technisch detacheringsbureau in de staalbouw/industrie. " +
      "Beoordeel per kandidaat hoe goed die past bij de vacature op basis van discipline, ervaring, functie en regio. " +
      "Geef een score 0-100 en een korte Nederlandse onderbouwing. Wees kritisch: alleen echt passende kandidaten scoren hoog.",
    prompt: `VACATURE:\n${vacancyBlock}\n\nKANDIDATEN:\n${candidateBlock}\n\nGeef voor ELKE kandidaat een score en reden.`,
    schema,
    schemaName: "candidate_matches",
    personalData: true,
    provider,
    maxTokens: 2000,
  });

  const byId = new Map(candidates.map((c) => [c.id, c]));
  return result.matches
    .filter((m) => byId.has(m.id))
    .map((m) => ({
      candidateId: m.id,
      score: Math.max(0, Math.min(1, Math.round(m.score) / 100)),
      reason: m.reason?.trim() || "AI-match",
    }));
}

/**
 * Rangschik de talentpool tegen één vacature. Probeert AI (AVG-veilig); valt bij
 * geen sleutel of fout terug op de gratis regel-score. Bewaart de top in
 * VacancyMatch en geeft de gerangschikte lijst terug (hoogste score eerst).
 */
export async function matchVacancy(
  vacancyId: string,
): Promise<{ matches: CandidateMatch[]; usedAI: boolean }> {
  const vacancy = await db.vacancy.findUnique({
    where: { id: vacancyId },
    select: {
      id: true, title: true, rawText: true, discipline: true, location: true,
      requirements: true, summary: true,
    },
  });
  if (!vacancy) return { matches: [], usedAI: false };

  const candidates = await db.candidate.findMany({
    // Niet-inzetbare kandidaten niet voorstellen.
    where: { rating: { not: "NIET_MEER" } },
    select: {
      id: true, firstName: true, lastName: true, discipline: true,
      headline: true, location: true, rating: true, experienceSummary: true,
    },
    take: 200,
  });
  if (candidates.length === 0) return { matches: [], usedAI: false };

  let matches: CandidateMatch[];
  let usedAI = false;
  try {
    matches = await aiRank(vacancy, candidates);
    usedAI = true;
  } catch {
    matches = candidates.map((c) => ruleScore(vacancy, c));
  }

  matches.sort((a, b) => b.score - a.score);

  // Bewaar de matches met een zinvolle score (>= 0.3) zodat de kaart de ranking
  // toont zonder opnieuw te draaien; oude matches voor deze vacature opschonen.
  const keep = matches.filter((m) => m.score >= 0.3);
  await db.$transaction([
    db.vacancyMatch.deleteMany({ where: { vacancyId } }),
    ...keep.map((m) =>
      db.vacancyMatch.create({
        data: { vacancyId, candidateId: m.candidateId, score: m.score, reason: m.reason },
      }),
    ),
    db.vacancy.update({ where: { id: vacancyId }, data: { lastMatchedAt: new Date() } }),
  ]);

  return { matches, usedAI };
}

/**
 * Rangschik de talentpool tegen één CRM-vacature (Deal). Zelfde AI-logica als
 * matchVacancy maar leest de velden van de Deal. Persisteert NIET (deals hebben
 * geen VacancyMatch-tabel) — geeft de gerangschikte lijst live terug zodat de
 * recruiter meteen de beste kandidaat kan koppelen.
 */
export async function matchDealCandidates(
  dealId: string,
): Promise<{ matches: CandidateMatch[]; usedAI: boolean }> {
  const deal = await db.deal.findUnique({
    where: { id: dealId },
    select: {
      id: true, title: true, discipline: true, location: true,
      requirements: true, responsibilities: true, niceToHave: true,
      certificates: true, experienceText: true,
    },
  });
  if (!deal) return { matches: [], usedAI: false };

  // Bouw een VacancyRow uit de deal-velden (hergebruik van dezelfde ranking).
  const v: VacancyRow = {
    id: deal.id,
    title: deal.title,
    discipline: deal.discipline,
    location: deal.location,
    requirements: [deal.requirements, deal.certificates, deal.experienceText]
      .filter(Boolean)
      .join("\n") || null,
    summary: [deal.responsibilities, deal.niceToHave].filter(Boolean).join("\n") || null,
    rawText: [deal.title, deal.responsibilities, deal.requirements]
      .filter(Boolean)
      .join("\n"),
  };

  const candidates = await db.candidate.findMany({
    where: { rating: { not: "NIET_MEER" } },
    select: {
      id: true, firstName: true, lastName: true, discipline: true,
      headline: true, location: true, rating: true, experienceSummary: true,
    },
    take: 200,
  });
  if (candidates.length === 0) return { matches: [], usedAI: false };

  let matches: CandidateMatch[];
  let usedAI = false;
  try {
    matches = await aiRank(v, candidates);
    usedAI = true;
  } catch {
    matches = candidates.map((c) => ruleScore(v, c));
  }
  matches.sort((a, b) => b.score - a.score);
  return { matches, usedAI };
}
