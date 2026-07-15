"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { CRM_NOTE_TYPE_VALUES, CRM_SENTIMENT_VALUES } from "@/lib/domain";
import { currentRecruiterId, logNote } from "@/lib/crm";

// Het notitieblok (chat) op een kandidaat — dezelfde "bewaar alles"-logica als
// bij deals en contacten, zodat elk contactmoment met een kandidaat vastligt.

const CandidateNoteSchema = z.object({
  candidateId: z.string().min(1),
  type: z.enum(CRM_NOTE_TYPE_VALUES).default("NOTE"),
  body: z.string().min(1, "Schrijf iets om vast te leggen"),
  sentiment: z.enum(CRM_SENTIMENT_VALUES).optional(),
  followUpAt: z.coerce.date().optional(),
});

export async function addCandidateNote(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(CandidateNoteSchema, formData);
  if (!parsed.success) return parsed.state;
  const { candidateId, type, body, sentiment, followUpAt } = parsed.data;
  const pinned = formData.get("pinned") === "on";
  const recruiterId = await currentRecruiterId();

  await logNote({
    candidateId,
    type,
    body,
    sentiment: sentiment ?? null,
    authorId: recruiterId,
    pinned,
    followUpAt: followUpAt ?? null,
  });

  revalidatePath(`/kandidaten/${candidateId}`);
  revalidatePath("/crm/opvolging");
  return {};
}

export async function togglePinCandidateNote(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const candidateId = String(formData.get("candidateId") ?? "");
  if (!id) return;
  const note = await db.crmNote.findUnique({ where: { id }, select: { pinned: true } });
  if (!note) return;
  await db.crmNote.update({ where: { id }, data: { pinned: !note.pinned } });
  if (candidateId) revalidatePath(`/kandidaten/${candidateId}`);
}

export async function deleteCandidateNote(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const candidateId = String(formData.get("candidateId") ?? "");
  if (!id) return;
  await db.crmNote.delete({ where: { id } });
  if (candidateId) revalidatePath(`/kandidaten/${candidateId}`);
}

export async function completeCandidateNoteFollowUp(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const candidateId = String(formData.get("candidateId") ?? "");
  if (!id) return;
  await db.crmNote.update({ where: { id }, data: { followUpDone: true } });
  if (candidateId) revalidatePath(`/kandidaten/${candidateId}`);
  revalidatePath("/crm/opvolging");
}
