import { db } from "./db";

// Deterministic, free CV<->vacancy matching: discipline + keyword/region overlap.
// No AI call, so it runs even without ANTHROPIC_API_KEY.

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

type VacancyLike = {
  id: string;
  title: string;
  rawText: string;
  discipline: string | null;
  location: string | null;
};
type CandidateLike = {
  id: string;
  discipline: string | null;
  headline: string | null;
  location: string | null;
};

function scoreMatch(v: VacancyLike, c: CandidateLike): { score: number; reason: string } {
  let s = 0;
  const reasons: string[] = [];

  if (c.discipline && v.discipline && c.discipline === v.discipline) {
    s += 0.7;
    reasons.push(`zelfde discipline (${c.discipline})`);
  }

  const vt = tokens(`${v.title} ${v.rawText}`);
  const ct = tokens(`${c.headline ?? ""} ${c.discipline ?? ""}`);
  let overlap = 0;
  for (const w of ct) if (vt.has(w)) overlap++;
  if (overlap > 0) {
    s += Math.min(0.3, 0.1 * overlap);
    reasons.push(`${overlap} overeenkomend(e) trefwoord(en)`);
  }

  const vloc = tokens(v.location);
  const cloc = tokens(c.location);
  if (cloc.size && [...cloc].some((w) => vloc.has(w))) {
    s += 0.1;
    reasons.push("zelfde regio");
  }

  return { score: Math.min(1, Math.round(s * 100) / 100), reason: reasons.join(", ") };
}

const THRESHOLD = 0.5;

/** Recompute matches for a vacancy across all candidates; upserts >= threshold. Returns # matched. */
export async function rematchVacancy(vacancyId: string): Promise<number> {
  const vacancy = await db.vacancy.findUnique({
    where: { id: vacancyId },
    select: { id: true, title: true, rawText: true, discipline: true, location: true },
  });
  if (!vacancy) return 0;

  const candidates = await db.candidate.findMany({
    select: { id: true, discipline: true, headline: true, location: true },
  });

  let count = 0;
  for (const c of candidates) {
    const { score, reason } = scoreMatch(vacancy, c);
    if (score >= THRESHOLD) {
      await db.vacancyMatch.upsert({
        where: { vacancyId_candidateId: { vacancyId, candidateId: c.id } },
        create: { vacancyId, candidateId: c.id, score, reason },
        update: { score, reason },
      });
      count++;
    } else {
      await db.vacancyMatch.deleteMany({ where: { vacancyId, candidateId: c.id } });
    }
  }
  return count;
}

/** Recompute matches for one candidate across all RELEVANT vacancies. Returns # matched. */
export async function rematchCandidate(candidateId: string): Promise<number> {
  const c = await db.candidate.findUnique({
    where: { id: candidateId },
    select: { id: true, discipline: true, headline: true, location: true },
  });
  if (!c) return 0;

  const vacancies = await db.vacancy.findMany({
    where: { relevance: "RELEVANT" },
    select: { id: true, title: true, rawText: true, discipline: true, location: true },
  });

  let count = 0;
  for (const v of vacancies) {
    const { score, reason } = scoreMatch(v, c);
    if (score >= THRESHOLD) {
      await db.vacancyMatch.upsert({
        where: { vacancyId_candidateId: { vacancyId: v.id, candidateId: c.id } },
        create: { vacancyId: v.id, candidateId: c.id, score, reason },
        update: { score, reason },
      });
      count++;
    } else {
      await db.vacancyMatch.deleteMany({ where: { vacancyId: v.id, candidateId: c.id } });
    }
  }
  return count;
}

/**
 * Als {@link rematchCandidate}, maar tegen de **actieve zoekopdrachten**
 * (`sourcing: true`) — exact de vacature-set die de CV-matches-pagina toont.
 * Zo levert een net geïmporteerd CV meteen matches op in de lopende zoekopdrachten.
 */
export async function rematchCandidateSourcing(candidateId: string): Promise<number> {
  const c = await db.candidate.findUnique({
    where: { id: candidateId },
    select: { id: true, discipline: true, headline: true, location: true },
  });
  if (!c) return 0;

  const vacancies = await db.vacancy.findMany({
    where: { sourcing: true },
    select: { id: true, title: true, rawText: true, discipline: true, location: true },
  });

  let count = 0;
  for (const v of vacancies) {
    const { score, reason } = scoreMatch(v, c);
    if (score >= THRESHOLD) {
      await db.vacancyMatch.upsert({
        where: { vacancyId_candidateId: { vacancyId: v.id, candidateId: c.id } },
        create: { vacancyId: v.id, candidateId: c.id, score, reason },
        update: { score, reason },
      });
      count++;
    } else {
      await db.vacancyMatch.deleteMany({ where: { vacancyId: v.id, candidateId: c.id } });
    }
  }
  return count;
}
