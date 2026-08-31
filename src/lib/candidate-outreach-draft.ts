export type CandidateOutreachDraftInput = {
  candidate: {
    id: string;
    firstName: string;
    lastName: string;
    headline: string | null;
    discipline: string | null;
  };
  vacancy: {
    id: string;
    title: string;
    discipline: string | null;
    location: string | null;
  };
  /** A recruiter-controlled key identifying why this specific draft is requested. */
  contextKey: string;
  /** Recruiter-provided reason; never inferred from scraping or background automation. */
  recruiterContext: string;
};

export type CandidateOutreachDraft = {
  candidateId: string;
  vacancyId: string;
  contextKey: string;
  idempotencyKey: string;
  recipientName: string;
  recipientHeadline: string | null;
  company: null;
  channel: "LINKEDIN";
  subject: null;
  context: string;
  draft: string;
  status: "DRAFT";
  sentAt: null;
  /** Documents the safety boundary for callers and behavior tests. */
  automaticActions: [];
};

/**
 * Builds one candidate-linked outreach concept from an explicit recruiter action.
 * This pure helper never performs I/O, sends a message, approves a draft, or uses
 * LinkedIn. Persistence is handled separately by the recruiter-only action.
 */
export function buildCandidateOutreachDraft(input: CandidateOutreachDraftInput): CandidateOutreachDraft {
  const recipientName = `${input.candidate.firstName} ${input.candidate.lastName}`.trim();
  const recruiterContext = input.recruiterContext.trim();
  const vacancyDetails = [input.vacancy.discipline, input.vacancy.location].filter(Boolean).join(" · ");
  const context = [
    recruiterContext || "Handmatig geselecteerd door een recruiter.",
    `Gekoppelde vacature: ${input.vacancy.title}${vacancyDetails ? ` (${vacancyDetails})` : ""}.`,
  ].join(" ");
  const personalDetail = input.candidate.headline || input.candidate.discipline || "achtergrond";

  return {
    candidateId: input.candidate.id,
    vacancyId: input.vacancy.id,
    contextKey: input.contextKey,
    idempotencyKey: `${input.candidate.id}:${input.vacancy.id}:${input.contextKey}`,
    recipientName,
    recipientHeadline: input.candidate.headline,
    company: null,
    channel: "LINKEDIN",
    subject: null,
    context,
    draft: `Hoi ${input.candidate.firstName},\n\nIk zag je achtergrond als ${personalDetail}. Voor de vacature ${input.vacancy.title} bij Q4S lijkt er mogelijk een goede aansluiting. Sta je open voor een korte, vrijblijvende kennismaking?\n\nGroet,\nQ4S`,
    status: "DRAFT",
    sentAt: null,
    automaticActions: [],
  };
}

export type CandidateOutreachDraftRepository<TMessage> = {
  findExisting(input: Pick<CandidateOutreachDraft, "candidateId" | "vacancyId" | "contextKey">): Promise<TMessage | null>;
  create(input: CandidateOutreachDraft): Promise<TMessage>;
};

/**
 * Persist a recruiter-requested draft idempotently. The repository deliberately
 * has no mail, approval, or LinkedIn capability, so this operation can only
 * create or return a DRAFT record.
 */
export async function createCandidateOutreachDraft<TMessage>(
  repository: CandidateOutreachDraftRepository<TMessage>,
  input: CandidateOutreachDraftInput,
): Promise<{ message: TMessage; created: boolean }> {
  const draft = buildCandidateOutreachDraft(input);
  const existing = await repository.findExisting(draft);
  if (existing) return { message: existing, created: false };

  try {
    return { message: await repository.create(draft), created: true };
  } catch (cause) {
    // A concurrent click may win the database unique constraint. Re-read to
    // preserve idempotency without turning a duplicate click into a second draft.
    if (!isUniqueConstraintError(cause)) throw cause;
    const raced = await repository.findExisting(draft);
    if (raced) return { message: raced, created: false };
    throw cause;
  }
}

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}

/** State policy used by server actions as well as UI: human approval precedes SENT. */
export function canTransitionOutreach(input: {
  status: string;
  draft: string | null;
  target: "APPROVED" | "SENT";
}): boolean {
  if (input.target === "APPROVED") return input.status === "DRAFT" && Boolean(input.draft?.trim());
  return input.status === "APPROVED";
}

export function canRegenerateOutreach(status: string): boolean {
  return status === "DRAFT";
}

export function canReopenOutreach(status: string): boolean {
  return status === "APPROVED";
}
