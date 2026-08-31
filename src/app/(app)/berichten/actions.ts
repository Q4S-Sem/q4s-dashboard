"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { aiText } from "@/lib/ai";
import {
  canRegenerateOutreach,
  canReopenOutreach,
  canTransitionOutreach,
  createCandidateOutreachDraft,
} from "@/lib/candidate-outreach-draft";
import {
  OUTREACH_CHANNEL_VALUES,
  OUTREACH_CHANNELS,
  DISCIPLINES,
  labelFor,
} from "@/lib/domain";

const OutreachSchema = z.object({
  recipientName: z.string().min(1, "Naam van de ontvanger is verplicht"),
  recipientHeadline: z.string().optional(),
  company: z.string().optional(),
  channel: z.enum(OUTREACH_CHANNEL_VALUES).default("LINKEDIN"),
  subject: z.string().optional(),
  vacancyId: z.string().optional(),
  context: z.string().optional(),
  draft: z.string().optional(),
});

// Build the DB payload, turning undefined optionals into null so that
// clearing a field on edit actually clears it.
function toData(data: z.infer<typeof OutreachSchema>) {
  return {
    recipientName: data.recipientName,
    recipientHeadline: data.recipientHeadline ?? null,
    company: data.company ?? null,
    channel: data.channel,
    subject: data.subject ?? null,
    vacancyId: data.vacancyId ?? null,
    context: data.context ?? null,
    draft: data.draft ?? null,
  };
}

export async function createOutreach(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(OutreachSchema, formData);
  if (!parsed.success) return parsed.state;

  const created = await db.outreachMessage.create({ data: toData(parsed.data) });
  revalidatePath("/berichten");
  redirect(`/berichten/${created.id}`);
}

/**
 * Explicit recruiter action from a candidate/vacancy match. It only creates (or
 * returns) a reviewable DRAFT record; it does not call AI, send email, approve,
 * or automate LinkedIn in any way.
 */
export async function createCandidateLinkedOutreach(formData: FormData) {
  const candidateId = String(formData.get("candidateId") ?? "").trim();
  const vacancyId = String(formData.get("vacancyId") ?? "").trim();
  if (!candidateId || !vacancyId) return;

  const [candidate, vacancy, match] = await Promise.all([
    db.candidate.findUnique({
      where: { id: candidateId },
      select: { id: true, firstName: true, lastName: true, headline: true, discipline: true },
    }),
    db.vacancy.findUnique({
      where: { id: vacancyId },
      select: { id: true, title: true, discipline: true, location: true },
    }),
    db.vacancyMatch.findUnique({
      where: { vacancyId_candidateId: { vacancyId, candidateId } },
      select: { reason: true },
    }),
  ]);
  if (!candidate || !vacancy) return;

  const result = await createCandidateOutreachDraft(
    {
      findExisting: ({ candidateId: existingCandidateId, vacancyId: existingVacancyId, contextKey }) =>
        db.outreachMessage.findFirst({
          where: { candidateId: existingCandidateId, vacancyId: existingVacancyId, contextKey },
          orderBy: { createdAt: "asc" },
        }),
      create: async ({ automaticActions: _automaticActions, idempotencyKey: _idempotencyKey, ...data }) =>
        db.outreachMessage.create({ data }),
    },
    {
      candidate,
      vacancy,
      contextKey: `vacancy-match:${vacancy.id}`,
      recruiterContext: match?.reason
        ? `Handmatig geselecteerd vanuit deze vacaturematch: ${match.reason}`
        : "Handmatig geselecteerd door een recruiter vanuit de vacature.",
    },
  );

  revalidatePath("/berichten");
  revalidatePath(`/kandidaten/${candidate.id}`);
  revalidatePath(`/vacatures/${vacancy.id}`);
  redirect(`/berichten/${result.message.id}`);
}

export async function updateOutreach(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Onbekend bericht." };

  const parsed = parseForm(OutreachSchema, formData);
  if (!parsed.success) return parsed.state;

  await db.outreachMessage.update({ where: { id }, data: toData(parsed.data) });
  revalidatePath("/berichten");
  revalidatePath(`/berichten/${id}`);
  redirect(`/berichten/${id}`);
}

export async function deleteOutreach(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await db.outreachMessage.delete({ where: { id } });
  } catch {
    redirect(`/berichten/${id}?error=in-use`);
  }
  revalidatePath("/berichten");
  redirect("/berichten");
}

const SYSTEM_LINKEDIN = `Je bent een ervaren recruiter bij Q4S, een Nederlands detacherings- en wervingsbureau gespecialiseerd in technische kwaliteitsdisciplines: QA (Quality Assurance), QC (Quality Control), lassen/welding, fitters en NDO/NDT (niet-destructief onderzoek).

Je schrijft een KORTE, warme, professionele en GEPERSONALISEERDE LinkedIn-bericht om iemand te benaderen.

Strikte regels:
- Schrijf in vloeiend, natuurlijk Nederlands (tutoyeren, "je"-vorm).
- Maximaal ongeveer 5 zinnen. Houd het kort en respecteer de LinkedIn-etiquette: geen spam, geen overdreven verkooppraat, geen clichés.
- Begin persoonlijk: verwijs naar de achtergrond, rol of headline van de persoon en de gegeven aanleiding/context.
- Als er een vacature gekoppeld is, verwijs er kort en concreet naar (functietitel en discipline), maar dring niet aan.
- Eindig met een vrijblijvende, laagdrempelige uitnodiging tot contact of een korte connectievraag.
- Geen onderwerpregel (dit is een LinkedIn-bericht).
- Geef ALLEEN de berichttekst terug, zonder uitleg, zonder aanhalingstekens, zonder labels.`;

const SYSTEM_EMAIL = `Je bent een ervaren recruiter bij Q4S, een Nederlands detacherings- en wervingsbureau gespecialiseerd in technische kwaliteitsdisciplines: QA (Quality Assurance), QC (Quality Control), lassen/welding, fitters en NDO/NDT (niet-destructief onderzoek).

Je schrijft een KORTE, warme, professionele en GEPERSONALISEERDE e-mail om iemand te benaderen.

Strikte regels:
- Schrijf in vloeiend, natuurlijk Nederlands (tutoyeren, "je"-vorm).
- Houd het kort en bondig: een paar korte alinea's, geen lange lap tekst, geen overdreven verkooppraat of clichés.
- Begin de allereerste regel met een onderwerpregel in de vorm "Onderwerp: ...".
- Daarna een korte, persoonlijke aanhef en e-mailtekst die verwijst naar de achtergrond, rol of headline van de persoon en de gegeven aanleiding/context.
- Als er een vacature gekoppeld is, verwijs er kort en concreet naar (functietitel en discipline), maar dring niet aan.
- Sluit af met een vrijblijvende uitnodiging tot contact en een vriendelijke groet namens Q4S.
- Geef ALLEEN de e-mailtekst terug (beginnend met de onderwerpregel), zonder verdere uitleg, zonder aanhalingstekens.`;

export async function draftOutreach(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const message = await db.outreachMessage.findUnique({
    where: { id },
    include: { vacancy: true },
  });
  if (!message) redirect("/berichten");
  if (!canRegenerateOutreach(message.status)) redirect(`/berichten/${id}`);

  try {
    const channelLabel = labelFor(OUTREACH_CHANNELS, message.channel);
    const lines: string[] = [];
    lines.push(`Kanaal: ${channelLabel}`);
    lines.push(`Naam ontvanger: ${message.recipientName}`);
    if (message.recipientHeadline)
      lines.push(`Headline / rol: ${message.recipientHeadline}`);
    if (message.company) lines.push(`Bedrijf: ${message.company}`);
    if (message.subject) lines.push(`Voorgesteld onderwerp: ${message.subject}`);
    if (message.context)
      lines.push(`Context / aanleiding: ${message.context}`);
    if (message.vacancy) {
      lines.push(`Gekoppelde vacature: ${message.vacancy.title}`);
      if (message.vacancy.discipline)
        lines.push(
          `Discipline van de vacature: ${labelFor(DISCIPLINES, message.vacancy.discipline)}`,
        );
      if (message.vacancy.location)
        lines.push(`Locatie van de vacature: ${message.vacancy.location}`);
    }

    const prompt = `Schrijf het outreach-bericht op basis van de volgende gegevens:\n\n${lines.join("\n")}`;

    const draft = await aiText({
      system: message.channel === "EMAIL" ? SYSTEM_EMAIL : SYSTEM_LINKEDIN,
      prompt,
      maxTokens: 1200,
      effort: "medium",
    });

    await db.outreachMessage.updateMany({
      where: { id, status: "DRAFT" },
      data: { draft, status: "DRAFT" },
    });
  } catch {
    redirect(`/berichten/${id}?error=ai`);
  }

  revalidatePath(`/berichten/${id}`);
  redirect(`/berichten/${id}`);
}

export async function approveOutreach(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const message = await db.outreachMessage.findUnique({
    where: { id },
    select: { status: true, draft: true },
  });
  if (!message || !canTransitionOutreach({ ...message, target: "APPROVED" })) return;
  // The conditional update is a race-safe server-side approval gate.
  await db.outreachMessage.updateMany({
    where: { id, status: "DRAFT", draft: { not: "" } },
    data: { status: "APPROVED" },
  });
  revalidatePath("/berichten");
  revalidatePath(`/berichten/${id}`);
  redirect(`/berichten/${id}`);
}

export async function markSent(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const message = await db.outreachMessage.findUnique({
    where: { id },
    select: { status: true, draft: true },
  });
  if (!message || !canTransitionOutreach({ ...message, target: "SENT" })) return;
  // Only a previously approved record can be marked sent; this action never sends a mail.
  await db.outreachMessage.updateMany({
    where: { id, status: "APPROVED" },
    data: { status: "SENT", sentAt: new Date() },
  });
  revalidatePath("/berichten");
  revalidatePath(`/berichten/${id}`);
  redirect(`/berichten/${id}`);
}

export async function reopenOutreach(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const message = await db.outreachMessage.findUnique({ where: { id }, select: { status: true } });
  if (!message || !canReopenOutreach(message.status)) return;
  await db.outreachMessage.updateMany({ where: { id, status: "APPROVED" }, data: { status: "DRAFT" } });
  revalidatePath("/berichten");
  revalidatePath(`/berichten/${id}`);
  redirect(`/berichten/${id}`);
}
