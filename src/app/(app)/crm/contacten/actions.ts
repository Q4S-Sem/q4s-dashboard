"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { CRM_NOTE_TYPE_VALUES, CRM_SENTIMENT_VALUES } from "@/lib/domain";
import { currentRecruiterId, logNote } from "@/lib/crm";

const ContactSchema = z.object({
  firstName: z.string().min(1, "Voornaam is verplicht"),
  lastName: z.string().optional(),
  email: z.string().optional(),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  company: z.string().optional(),
  linkedinUrl: z.string().optional(),
  ownerId: z.string().optional(),
  targetClientId: z.string().optional(),
  clientId: z.string().optional(),
  notes: z.string().optional(),
});

function toData(data: z.infer<typeof ContactSchema>) {
  return {
    firstName: data.firstName,
    lastName: data.lastName ?? null,
    email: data.email ?? null,
    phone: data.phone ?? null,
    jobTitle: data.jobTitle ?? null,
    company: data.company ?? null,
    linkedinUrl: data.linkedinUrl ?? null,
    ownerId: data.ownerId ?? null,
    targetClientId: data.targetClientId ?? null,
    clientId: data.clientId ?? null,
    notes: data.notes ?? null,
  };
}

export async function createContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(ContactSchema, formData);
  if (!parsed.success) return parsed.state;

  const data = toData(parsed.data);
  if (!data.ownerId) data.ownerId = await currentRecruiterId();

  const created = await db.crmContact.create({ data });
  revalidatePath("/crm/contacten");
  redirect(`/crm/contacten/${created.id}`);
}

export async function updateContact(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Onbekend contact." };

  const parsed = parseForm(ContactSchema, formData);
  if (!parsed.success) return parsed.state;

  await db.crmContact.update({ where: { id }, data: toData(parsed.data) });
  revalidatePath("/crm/contacten");
  revalidatePath(`/crm/contacten/${id}`);
  redirect(`/crm/contacten/${id}`);
}

export async function deleteContact(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.crmContact.delete({ where: { id } });
  revalidatePath("/crm/contacten");
  redirect("/crm/contacten");
}

// --- Notitieblok on a contact ----------------------------------------------

const ContactNoteSchema = z.object({
  contactId: z.string().min(1),
  type: z.enum(CRM_NOTE_TYPE_VALUES).default("NOTE"),
  body: z.string().min(1, "Schrijf iets om vast te leggen"),
  sentiment: z.enum(CRM_SENTIMENT_VALUES).optional(),
  followUpAt: z.coerce.date().optional(),
});

export async function addContactNote(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(ContactNoteSchema, formData);
  if (!parsed.success) return parsed.state;
  const { contactId, type, body, sentiment, followUpAt } = parsed.data;
  const pinned = formData.get("pinned") === "on";
  const recruiterId = await currentRecruiterId();

  await logNote({
    contactId,
    type,
    body,
    sentiment: sentiment ?? null,
    authorId: recruiterId,
    pinned,
    followUpAt: followUpAt ?? null,
  });

  revalidatePath(`/crm/contacten/${contactId}`);
  revalidatePath("/crm/opvolging");
  return {};
}

export async function togglePinContactNote(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const contactId = String(formData.get("contactId") ?? "");
  if (!id) return;
  const note = await db.crmNote.findUnique({ where: { id }, select: { pinned: true } });
  if (!note) return;
  await db.crmNote.update({ where: { id }, data: { pinned: !note.pinned } });
  if (contactId) revalidatePath(`/crm/contacten/${contactId}`);
}

export async function deleteContactNote(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const contactId = String(formData.get("contactId") ?? "");
  if (!id) return;
  await db.crmNote.delete({ where: { id } });
  if (contactId) revalidatePath(`/crm/contacten/${contactId}`);
}

export async function completeContactNoteFollowUp(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const contactId = String(formData.get("contactId") ?? "");
  if (!id) return;
  await db.crmNote.update({ where: { id }, data: { followUpDone: true } });
  if (contactId) revalidatePath(`/crm/contacten/${contactId}`);
  revalidatePath("/crm/opvolging");
}
