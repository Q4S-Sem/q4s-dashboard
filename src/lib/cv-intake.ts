import { db } from "./db";
import { CvExtractError, extractCvProfile } from "./cv-extract";
import { serializeSection, type CvProfileData } from "./cv-profile";
import { rematchCandidateSourcing } from "./matching";
import { cvKey } from "./uploads";
import { getObject } from "./storage";

export type ShortlistMatch = {
  vacancyId: string;
  vacancyTitle: string;
  score: number;
  reason: string | null;
};

export type CvIntakeShortlistPlanInput = {
  candidateId: string;
  candidateName: string;
  cvFileName: string;
  needsProfileExtraction: boolean;
  matches: ShortlistMatch[];
  alreadyAlertedForCv: boolean;
};

export type CvIntakeShortlistPlan = {
  status: "PENDING_REVIEW";
  shouldExtractProfile: boolean;
  shouldCreateAlert: boolean;
  automaticActions: [];
  alert: { title: string; body: string; href: string };
};

/**
 * Build the recruiter-facing outcome of CV intake. This intentionally only
 * proposes a shortlist: it never creates an application, placement, CRM lead,
 * outreach, or any other candidate-state transition.
 */
export function buildCvIntakeShortlistPlan(
  input: CvIntakeShortlistPlanInput,
): CvIntakeShortlistPlan {
  const shortlist = input.matches
    .slice(0, 5)
    .map((match) => {
      const score = Math.round(Math.max(0, Math.min(1, match.score)) * 100);
      return `${match.vacancyTitle} (${score}%${match.reason ? `: ${match.reason}` : ""})`;
    });
  const profileNote = input.needsProfileExtraction
    ? "Het CV-profiel is uitgelezen en moet nog door een recruiter worden nagekeken."
    : "Het bestaande CV-profiel moet door een recruiter worden nagekeken.";
  const shortlistNote = shortlist.length
    ? `Mogelijke matches: ${shortlist.join("; ")}.`
    : "Nog geen mogelijke matches in actieve zoekopdrachten.";

  return {
    status: "PENDING_REVIEW",
    shouldExtractProfile: input.needsProfileExtraction,
    shouldCreateAlert: !input.alreadyAlertedForCv,
    automaticActions: [],
    alert: {
      title: `CV-shortlist klaar voor review: ${input.candidateName}`.slice(0, 300),
      body: `${profileNote} ${shortlistNote} Nakijken vóór je de kandidaat benadert, aan een sollicitatie koppelt of verder zet.`.slice(0, 1000),
      href: `/kandidaten/${input.candidateId}/cv`,
    },
  };
}

function profileRecord(data: CvProfileData) {
  return {
    fullName: data.fullName || "Onbekend",
    headline: data.headline || null,
    location: data.location || null,
    availability: data.availability || null,
    summary: data.summary || null,
    yearsExperience: data.yearsExperience,
    skillsJson: serializeSection(data.skills),
    languagesJson: serializeSection(data.languages),
    experienceJson: serializeSection(data.experience),
    educationJson: serializeSection(data.education),
    certificatesJson: serializeSection(data.certificates),
  };
}

export type CvIntakeRunResult = {
  runId: string;
  status: "PENDING_REVIEW" | "ERROR";
  created: boolean;
  alerted: boolean;
  shortlistCount: number;
  error?: string;
};

/**
 * Process one already-stored candidate CV into a human-review-only shortlist.
 * The candidate's current CV filename is the idempotency key. Existing runs for
 * the same file are returned unchanged, and the one-to-one alert relation makes
 * concurrent retries unable to create alert spam.
 */
export async function runCvIntakeShortlist(candidateId: string): Promise<CvIntakeRunResult> {
  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    include: { cvProfile: true },
  });
  if (!candidate?.cvFileName) {
    throw new Error("Deze kandidaat heeft geen opgeslagen CV.");
  }

  const existing = await db.cvIntakeRun.findUnique({
    where: { candidateId_sourceFileName: { candidateId, sourceFileName: candidate.cvFileName } },
    include: { alert: true },
  });
  const candidateName = `${candidate.firstName} ${candidate.lastName}`.trim() || "Onbekende kandidaat";

  if (existing) {
    const matches = parseShortlist(existing.shortlistJson);
    const plan = buildCvIntakeShortlistPlan({
      candidateId,
      candidateName,
      cvFileName: candidate.cvFileName,
      needsProfileExtraction: false,
      matches,
      alreadyAlertedForCv: Boolean(existing.alert),
    });
    const alerted = await ensureRecruiterAlert(existing.id, plan);
    return {
      runId: existing.id,
      status: existing.status === "ERROR" ? "ERROR" : "PENDING_REVIEW",
      created: false,
      alerted,
      shortlistCount: matches.length,
      error: existing.error ?? undefined,
    };
  }

  const needsProfileExtraction =
    !candidate.cvProfile || candidate.cvProfile.sourceFileName !== candidate.cvFileName;
  let profileExtractedAt: Date | null = null;
  try {
    if (needsProfileExtraction) {
      const bytes = await getObject(cvKey(candidate.cvFileName));
      const extracted = await extractCvProfile(
        bytes,
        candidate.cvOriginalName ?? candidate.cvFileName,
        candidate.cvMimeType ?? "",
      );
      await db.cvProfile.upsert({
        where: { candidateId },
        create: {
          ...profileRecord(extracted),
          candidateId,
          sourceFileName: candidate.cvFileName,
          sourceOriginalName: candidate.cvOriginalName,
        },
        update: {
          ...profileRecord(extracted),
          // Human-entered candidate name remains the canonical dossier name.
          fullName: candidateName || extracted.fullName || "Onbekend",
          sourceFileName: candidate.cvFileName,
          sourceOriginalName: candidate.cvOriginalName,
        },
      });
      profileExtractedAt = new Date();
    }

    await rematchCandidateSourcing(candidateId);
    const matches = await db.vacancyMatch.findMany({
      where: { candidateId, vacancy: { sourcing: true } },
      orderBy: { score: "desc" },
      take: 5,
      select: { vacancyId: true, score: true, reason: true, vacancy: { select: { title: true } } },
    });
    const shortlist: ShortlistMatch[] = matches.map((match) => ({
      vacancyId: match.vacancyId,
      vacancyTitle: match.vacancy.title,
      score: match.score,
      reason: match.reason,
    }));
    const run = await db.cvIntakeRun.upsert({
      where: { candidateId_sourceFileName: { candidateId, sourceFileName: candidate.cvFileName } },
      create: {
        candidateId,
        sourceFileName: candidate.cvFileName,
        status: "PENDING_REVIEW",
        shortlistJson: JSON.stringify(shortlist),
        profileExtractedAt,
      },
      update: {
        status: "PENDING_REVIEW",
        shortlistJson: JSON.stringify(shortlist),
        profileExtractedAt,
        error: null,
      },
    });
    const plan = buildCvIntakeShortlistPlan({
      candidateId,
      candidateName,
      cvFileName: candidate.cvFileName,
      needsProfileExtraction,
      matches: shortlist,
      alreadyAlertedForCv: false,
    });
    const alerted = await ensureRecruiterAlert(run.id, plan);
    return { runId: run.id, status: "PENDING_REVIEW", created: true, alerted, shortlistCount: shortlist.length };
  } catch (cause) {
    const error = humanError(cause);
    const run = await db.cvIntakeRun.upsert({
      where: { candidateId_sourceFileName: { candidateId, sourceFileName: candidate.cvFileName } },
      create: { candidateId, sourceFileName: candidate.cvFileName, status: "ERROR", error },
      update: { status: "ERROR", error },
    });
    return { runId: run.id, status: "ERROR", created: true, alerted: false, shortlistCount: 0, error };
  }
}

async function ensureRecruiterAlert(runId: string, plan: CvIntakeShortlistPlan): Promise<boolean> {
  if (!plan.shouldCreateAlert) return false;
  try {
    await db.recruiterAlert.create({
      data: { type: "CV_SHORTLIST", title: plan.alert.title, body: plan.alert.body, href: plan.alert.href, cvIntakeRunId: runId },
    });
    return true;
  } catch (cause) {
    // A competing retry already created this run's unique alert: idempotent no-op.
    if ((cause as { code?: string }).code === "P2002") return false;
    throw cause;
  }
}

function parseShortlist(raw: string): ShortlistMatch[] {
  try {
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) return [];
    return value.flatMap((item): ShortlistMatch[] => {
      if (!item || typeof item !== "object") return [];
      const row = item as Record<string, unknown>;
      if (
        typeof row.vacancyId !== "string" ||
        typeof row.vacancyTitle !== "string" ||
        typeof row.score !== "number" ||
        (row.reason !== null && typeof row.reason !== "string")
      ) return [];
      return [{ vacancyId: row.vacancyId, vacancyTitle: row.vacancyTitle, score: row.score, reason: row.reason }];
    });
  } catch {
    return [];
  }
}

function humanError(cause: unknown): string {
  if (cause instanceof CvExtractError) return cause.message.slice(0, 500);
  if (cause instanceof Error) return cause.message.slice(0, 500);
  return "CV-intake kon niet worden verwerkt.";
}
