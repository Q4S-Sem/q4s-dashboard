"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { DEAL_SOURCE_VALUES, CRM_NOTE_TYPE_VALUES, CRM_SENTIMENT_VALUES } from "@/lib/domain";
import { currentRecruiterId, logNote } from "@/lib/crm";

const DealSchema = z.object({
  title: z.string().min(1, "Titel is verplicht"),
  company: z.string().min(1, "Bedrijf is verplicht"),
  discipline: z.string().optional(),
  ownerId: z.string().optional(),
  stageId: z.string().min(1, "Fase is verplicht"),
  value: z.coerce.number().min(0).default(0),
  positions: z.coerce.number().int().min(1).max(999).default(1),
  fitScore: z.coerce.number().int().min(0).max(5).default(0),
  source: z.enum(DEAL_SOURCE_VALUES).default("MANUAL"),
  targetClientId: z.string().optional(),
  clientId: z.string().optional(),
  vacancyId: z.string().optional(),
  primaryContactId: z.string().optional(),
  expectedCloseDate: z.coerce.date().optional(),
  nextFollowUpAt: z.coerce.date().optional(),
  notes: z.string().optional(),
});

type DealData = z.infer<typeof DealSchema>;

/** Map form data + the chosen stage's semantics into the DB payload. */
async function toData(data: DealData) {
  const stage = await db.crmStage.findUnique({ where: { id: data.stageId } });
  const status = stage?.isWon ? "WON" : stage?.isLost ? "LOST" : "OPEN";
  return {
    payload: {
      title: data.title,
      company: data.company,
      discipline: data.discipline ?? null,
      ownerId: data.ownerId ?? null,
      stageId: data.stageId,
      status,
      probability: stage?.probability ?? 0,
      value: data.value,
      positions: data.positions,
      fitScore: data.fitScore,
      source: data.source,
      targetClientId: data.targetClientId ?? null,
      clientId: data.clientId ?? null,
      vacancyId: data.vacancyId ?? null,
      primaryContactId: data.primaryContactId ?? null,
      expectedCloseDate: data.expectedCloseDate ?? null,
      nextFollowUpAt: data.nextFollowUpAt ?? null,
      closedAt: status === "OPEN" ? null : new Date(),
    },
    stageName: stage?.name ?? "",
    status,
  };
}

export async function createDeal(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(DealSchema, formData);
  if (!parsed.success) return parsed.state;

  const recruiterId = await currentRecruiterId();
  const { payload, stageName } = await toData(parsed.data);
  // Fall back to the acting recruiter as owner if none chosen.
  if (!payload.ownerId) payload.ownerId = recruiterId;

  const created = await db.deal.create({ data: payload });
  await logNote({
    type: "SYSTEM",
    dealId: created.id,
    authorId: recruiterId,
    body: `Deal aangemaakt in fase "${stageName}".`,
  });

  // Eigen notitie bij het aanmaken meteen vastleggen in het notitieblok.
  const notes = String(formData.get("notes") ?? "").trim();
  if (notes) {
    await logNote({ type: "NOTE", dealId: created.id, authorId: recruiterId, body: notes });
  }

  revalidatePath("/crm");
  revalidatePath("/crm/kansen");
  redirect("/crm/kansen");
}

export async function updateDeal(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Onbekende deal." };

  const parsed = parseForm(DealSchema, formData);
  if (!parsed.success) return parsed.state;

  const existing = await db.deal.findUnique({ where: { id }, include: { stage: true } });
  if (!existing) return { error: "Onbekende deal." };

  const recruiterId = await currentRecruiterId();
  const { payload, stageName } = await toData(parsed.data);

  await db.deal.update({ where: { id }, data: payload });

  if (existing.stageId !== payload.stageId) {
    await logNote({
      type: "STAGE_CHANGE",
      dealId: id,
      authorId: recruiterId,
      body: `Fase gewijzigd: ${existing.stage.name} → ${stageName}`,
    });
  }

  revalidatePath("/crm");
  revalidatePath(`/crm/deals/${id}`);
  revalidatePath("/crm/inzichten");
  redirect(`/crm/deals/${id}`);
}

export async function deleteDeal(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.deal.delete({ where: { id } });
  revalidatePath("/crm");
  redirect("/crm");
}

/** Close a deal as won or lost — moves it to the matching closing stage. */
export async function closeDeal(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  const lostReason = String(formData.get("lostReason") ?? "").trim();
  if (!id || (outcome !== "WON" && outcome !== "LOST")) return;

  const deal = await db.deal.findUnique({ where: { id }, include: { stage: true } });
  if (!deal) return;

  const stage = await db.crmStage.findFirst({
    where: outcome === "WON" ? { isWon: true } : { isLost: true },
    orderBy: { order: "asc" },
  });
  const recruiterId = await currentRecruiterId();

  await db.deal.update({
    where: { id },
    data: {
      status: outcome,
      stageId: stage?.id ?? deal.stageId,
      probability: outcome === "WON" ? 100 : 0,
      lostReason: outcome === "LOST" ? lostReason || null : null,
      nextFollowUpAt: null,
      closedAt: new Date(),
    },
  });

  await logNote({
    type: "SYSTEM",
    dealId: id,
    authorId: recruiterId,
    body:
      outcome === "WON"
        ? "Deal gewonnen 🎉 — geplaatst."
        : `Deal verloren${lostReason ? ` — reden: ${lostReason}` : "."}`,
    sentiment: outcome === "WON" ? "POSITIVE" : "NEGATIVE",
  });

  revalidatePath("/crm");
  revalidatePath(`/crm/deals/${id}`);
  revalidatePath("/crm/inzichten");
  redirect(`/crm/deals/${id}`);
}

/** Reopen a closed deal back into the first open stage. */
export async function reopenDeal(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const stage = await db.crmStage.findFirst({
    where: { isWon: false, isLost: false, active: true },
    orderBy: { order: "asc" },
  });
  if (!stage) return;
  const recruiterId = await currentRecruiterId();
  await db.deal.update({
    where: { id },
    data: {
      status: "OPEN",
      stageId: stage.id,
      probability: stage.probability,
      lostReason: null,
      closedAt: null,
    },
  });
  await logNote({ type: "SYSTEM", dealId: id, authorId: recruiterId, body: "Deal heropend." });
  revalidatePath("/crm");
  revalidatePath(`/crm/deals/${id}`);
}

/**
 * Deze plaatsing gaat niet door, maar de kandidaat blijft goed — sluit de deal
 * (als verloren, reden "andere vacature gezocht") en stuur de recruiter terug
 * naar de talentpool om dezelfde persoon op een nieuwe vacature in de pipeline
 * te zetten. Zo verdwijnt de deal uit het open bord zonder de kandidaat af te
 * schrijven.
 */
export async function rematchDeal(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const stage = await db.crmStage.findFirst({
    where: { isLost: true },
    orderBy: { order: "asc" },
  });
  const recruiterId = await currentRecruiterId();
  await db.deal.update({
    where: { id },
    data: {
      status: "LOST",
      ...(stage ? { stageId: stage.id, probability: 0 } : {}),
      lostReason: "Andere vacature gezocht",
      closedAt: new Date(),
      nextFollowUpAt: null,
    },
  });
  await logNote({
    type: "SYSTEM",
    dealId: id,
    authorId: recruiterId,
    body: "Deze plaatsing ging niet door — kandidaat gaat naar een andere vacature.",
  });
  revalidatePath("/crm");
  revalidatePath(`/crm/deals/${id}`);
  redirect("/kandidaten");
}

// --- The notitieblok (chat) -------------------------------------------------

const NoteSchema = z.object({
  dealId: z.string().min(1),
  type: z.enum(CRM_NOTE_TYPE_VALUES).default("NOTE"),
  body: z.string().min(1, "Schrijf iets om vast te leggen"),
  sentiment: z.enum(CRM_SENTIMENT_VALUES).optional(),
  followUpAt: z.coerce.date().optional(),
});

/** Log an entry on a deal (the everything-saving chat). Optionally (re)sets the
 *  deal's next follow-up date. */
export async function addDealNote(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(NoteSchema, formData);
  if (!parsed.success) return parsed.state;
  const { dealId, type, body, sentiment, followUpAt } = parsed.data;
  const pinned = formData.get("pinned") === "on";
  const recruiterId = await currentRecruiterId();

  await logNote({ dealId, type, body, sentiment: sentiment ?? null, authorId: recruiterId, pinned });

  if (followUpAt) {
    await db.deal.update({ where: { id: dealId }, data: { nextFollowUpAt: followUpAt } });
  }

  revalidatePath(`/crm/deals/${dealId}`);
  revalidatePath("/crm");
  revalidatePath("/crm/opvolging");
  return {};
}

export async function togglePinNote(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const dealId = String(formData.get("dealId") ?? "");
  if (!id) return;
  const note = await db.crmNote.findUnique({ where: { id }, select: { pinned: true } });
  if (!note) return;
  await db.crmNote.update({ where: { id }, data: { pinned: !note.pinned } });
  if (dealId) revalidatePath(`/crm/deals/${dealId}`);
}

export async function deleteNote(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const dealId = String(formData.get("dealId") ?? "");
  if (!id) return;
  await db.crmNote.delete({ where: { id } });
  if (dealId) revalidatePath(`/crm/deals/${dealId}`);
}

/** Mark a deal's planned follow-up as done (clears the date, logs it). */
export async function completeDealFollowUp(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const recruiterId = await currentRecruiterId();
  await db.deal.update({ where: { id }, data: { nextFollowUpAt: null } });
  await logNote({ type: "SYSTEM", dealId: id, authorId: recruiterId, body: "Opvolging afgerond." });
  revalidatePath(`/crm/deals/${id}`);
  revalidatePath("/crm");
  revalidatePath("/crm/opvolging");
}

// --- Kandidaat in de pipeline zetten ----------------------------------------

const FromCandidateSchema = z.object({
  candidateId: z.string().min(1, "Onbekende kandidaat"),
  company: z.string().min(1, "Kies of typ een bedrijf"),
  clientId: z.string().optional(),
  vacancyId: z.string().optional(),
  value: z.coerce.number().min(0).default(0),
});

/**
 * Zet een kandidaat uit de talentpool in de deal-pipeline: maak een deal aan in
 * de eerste open fase, gekoppeld aan de kandidaat, het (eigen) bedrijf en
 * optioneel de openstaande vacature. Vanaf hier stuurt de recruiter de deal door
 * de fases. Menselijke beslissing blijft leidend — dit maakt alleen de deal aan.
 */
export async function createDealFromCandidate(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(FromCandidateSchema, formData);
  if (!parsed.success) return parsed.state;
  const { candidateId, company, clientId, vacancyId, value } = parsed.data;

  const candidate = await db.candidate.findUnique({
    where: { id: candidateId },
    select: { firstName: true, lastName: true, discipline: true },
  });
  if (!candidate) return { error: "Onbekende kandidaat." };

  // Eerste open fase van de pipeline.
  const stage = await db.crmStage.findFirst({
    where: { isWon: false, isLost: false, active: true },
    orderBy: { order: "asc" },
  });
  if (!stage) return { error: "Er is nog geen pipeline-fase ingesteld." };

  const recruiterId = await currentRecruiterId();
  const naam = `${candidate.firstName} ${candidate.lastName}`.trim();

  const created = await db.deal.create({
    data: {
      title: `${naam} → ${company}`,
      company,
      discipline: candidate.discipline ?? null,
      candidateId,
      clientId: clientId || null,
      vacancyId: vacancyId || null,
      stageId: stage.id,
      status: "OPEN",
      probability: stage.probability,
      value,
      positions: 1,
      source: "REFERRAL",
      ownerId: recruiterId,
    },
  });

  await logNote({
    type: "SYSTEM",
    dealId: created.id,
    authorId: recruiterId,
    body: `Kandidaat ${naam} in de pipeline gezet bij ${company}${vacancyId ? " (op een openstaande vacature)" : ""}.`,
  });

  revalidatePath("/crm");
  revalidatePath("/kandidaten");
  redirect("/crm");
}

const QuickPipelineSchema = z.object({
  candidateId: z.string().min(1),
  clientId: z.string().min(1),
  vacancyId: z.string().optional(),
  // Waar terug naartoe na afloop (de bedrijfswerkruimte).
  returnTo: z.string().optional(),
});

/**
 * Eén-klik variant: zet een kandidaat direct in de pipeline bij een bekend
 * bedrijf + (optioneel) vacature — zonder keuzemodal. Gebruikt vanuit de
 * Bedrijfswerkruimte bij een match. Idempotent: bestaat er al een open deal voor
 * dezelfde kandidaat+bedrijf, dan wordt er geen tweede aangemaakt.
 */
export async function quickAddToPipeline(formData: FormData) {
  const parsed = parseForm(QuickPipelineSchema, formData);
  if (!parsed.success) return;
  const { candidateId, clientId, vacancyId, returnTo } = parsed.data;

  const [candidate, client] = await Promise.all([
    db.candidate.findUnique({
      where: { id: candidateId },
      select: { firstName: true, lastName: true, discipline: true },
    }),
    db.client.findUnique({ where: { id: clientId }, select: { companyName: true } }),
  ]);
  if (!candidate || !client) return;

  // Al een lopende deal voor deze kandidaat bij dit bedrijf? Dan niets doen.
  const existing = await db.deal.findFirst({
    where: { candidateId, clientId, status: "OPEN" },
    select: { id: true },
  });
  const back = returnTo && returnTo.startsWith("/") ? returnTo : "/crm";
  if (existing) redirect(back);

  const stage = await db.crmStage.findFirst({
    where: { isWon: false, isLost: false, active: true },
    orderBy: { order: "asc" },
  });
  if (!stage) return;

  const recruiterId = await currentRecruiterId();
  const naam = `${candidate.firstName} ${candidate.lastName}`.trim();

  const created = await db.deal.create({
    data: {
      title: `${naam} → ${client.companyName}`,
      company: client.companyName,
      discipline: candidate.discipline ?? null,
      candidateId,
      clientId,
      vacancyId: vacancyId || null,
      stageId: stage.id,
      status: "OPEN",
      probability: stage.probability,
      value: 0,
      positions: 1,
      source: "REFERRAL",
      ownerId: recruiterId,
    },
  });

  await logNote({
    type: "SYSTEM",
    dealId: created.id,
    authorId: recruiterId,
    body: `Kandidaat ${naam} vanuit een match in de pipeline gezet bij ${client.companyName}${vacancyId ? " (op een openstaande vacature)" : ""}.`,
  });

  revalidatePath("/crm");
  revalidatePath(back);
  redirect(back);
}
