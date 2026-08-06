"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import {
  EVALUATION_TYPE_VALUES,
  EVALUATION_STATUS_VALUES,
  EVALUATION_TYPES,
  labelFor,
} from "@/lib/domain";
import { getFormDef } from "@/lib/evaluation-forms";
import { getCompanySettings } from "@/lib/settings";
import { renderEvaluationPdf } from "@/lib/evaluation-pdf";
import { saveUpload } from "@/lib/uploads";

const EvaluationSchema = z.object({
  type: z.enum(EVALUATION_TYPE_VALUES),
  status: z.enum(EVALUATION_STATUS_VALUES),
  year: z.coerce.number().int().min(2000).max(2100),
  quarter: z.coerce.number().int().min(1).max(4),
  evaluationDate: z.coerce.date().optional(),
  clientName: z.string().optional(),
  clientAddress: z.string().optional(),
  department: z.string().optional(),
  reference: z.string().optional(),
  functionTitle: z.string().optional(),
  workLocation: z.string().optional(),
  periodText: z.string().optional(),
  evaluatorName: z.string().optional(),
});

type EvaluationInput = z.infer<typeof EvaluationSchema>;

/**
 * Map the parsed form to Prisma data. Scores (`s_<key>` radios, 1..4) and answers
 * (`a_<key>` — ja/nee, vrije tekst, toelichtingen) are template-driven, so they
 * are collected dynamically from the FormData and stored as JSON.
 */
function toData(d: EvaluationInput, formData: FormData) {
  const scores: Record<string, number> = {};
  const answers: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v !== "string") continue;
    if (k.startsWith("s_")) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 1 && n <= 4) scores[k.slice(2)] = n;
    } else if (k.startsWith("a_")) {
      const val = v.trim();
      if (val) answers[k.slice(2)] = val;
    }
  }
  return {
    type: d.type,
    status: d.status,
    year: d.year,
    quarter: d.quarter,
    evaluationDate: d.evaluationDate ?? null,
    clientName: d.clientName ?? null,
    clientAddress: d.clientAddress ?? null,
    department: d.department ?? null,
    reference: d.reference ?? null,
    functionTitle: d.functionTitle ?? null,
    workLocation: d.workLocation ?? null,
    periodText: d.periodText ?? null,
    evaluatorName: d.evaluatorName ?? null,
    scoresJson: Object.keys(scores).length ? JSON.stringify(scores) : null,
    answersJson: Object.keys(answers).length ? JSON.stringify(answers) : null,
  };
}

/** Link to an existing Client when the typed name matches one exactly. */
async function resolveClientId(name: string | null): Promise<string | null> {
  if (!name) return null;
  const c = await db.client.findFirst({
    where: { companyName: name },
    select: { id: true },
  });
  return c?.id ?? null;
}

/** Create a new "Overig" medewerker from a typed name (first word = voornaam). */
async function createOverigConsultant(name: string): Promise<string> {
  const parts = name.trim().split(/\s+/);
  const firstName = parts[0] ?? name.trim();
  const lastName = parts.slice(1).join(" ");
  const c = await db.consultant.create({
    data: { firstName, lastName, discipline: "OVERIG" },
  });
  return c.id;
}

/** The combobox submits either an existing `consultantId` or a typed
 *  `newConsultantName` to create. Returns the resolved id, or null. */
async function resolveConsultantId(formData: FormData): Promise<string | null> {
  const id = String(formData.get("consultantId") ?? "").trim();
  if (id) {
    const c = await db.consultant.findUnique({ where: { id }, select: { id: true } });
    if (c) return c.id;
  }
  const newName = String(formData.get("newConsultantName") ?? "").trim();
  if (newName) return createOverigConsultant(newName);
  return null;
}

/**
 * Waar je uitkomt na opslaan: de lijst van dít formuliertype, niet het
 * detailscherm. Opslaan is het einde van de taak — dan wil je je nieuwe regel in
 * het overzicht zien, niet nóg een scherm vol velden. Het detailscherm blijft
 * één klik weg via de melding bovenaan de lijst.
 *
 * Het type komt uit de opgeslagen evaluatie en niet uit het formulier: wie
 * halverwege van formuliertype wisselt, hoort in de andere lijst te landen.
 */
function naLijst(type: string, id: string): string {
  return `${getFormDef(type).listPath}?opgeslagen=${id}`;
}

export async function createEvaluation(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const consultantId = await resolveConsultantId(formData);
  if (!consultantId) {
    return { fieldErrors: { consultantId: "Kies of typ een medewerker." } };
  }
  const parsed = parseForm(EvaluationSchema, formData);
  if (!parsed.success) return parsed.state;
  const data = toData(parsed.data, formData);
  const ev = await db.evaluation.create({
    data: { ...data, consultantId, clientId: await resolveClientId(data.clientName) },
  });
  revalidatePath("/evaluaties");
  revalidatePath("/werknemers");
  revalidatePath("/", "layout");
  redirect(naLijst(ev.type, ev.id));
}

export async function updateEvaluation(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Onbekende evaluatie." };
  const consultantId = await resolveConsultantId(formData);
  if (!consultantId) {
    return { fieldErrors: { consultantId: "Kies of typ een medewerker." } };
  }
  const parsed = parseForm(EvaluationSchema, formData);
  if (!parsed.success) return parsed.state;
  const data = toData(parsed.data, formData);
  const ev = await db.evaluation.update({
    where: { id },
    data: { ...data, consultantId, clientId: await resolveClientId(data.clientName) },
  });
  revalidatePath("/evaluaties");
  revalidatePath(`/evaluaties/${id}`);
  revalidatePath("/werknemers");
  revalidatePath("/", "layout");
  redirect(naLijst(ev.type, ev.id));
}

export async function deleteEvaluation(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await db.evaluation.delete({ where: { id } });
  revalidatePath("/evaluaties");
  revalidatePath("/", "layout");
  redirect("/evaluaties");
}

/**
 * Generate the filled-in VCU PDF and archive it in the medewerker's dossier
 * (a Document, category EVALUATIE) — the "ingevuld bestand bewaren in de DB".
 */
export async function archiveEvaluationToDossier(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) redirect("/evaluaties");

  const [ev, settings] = await Promise.all([
    db.evaluation.findUnique({
      where: { id },
      include: { consultant: { select: { firstName: true, lastName: true } } },
    }),
    getCompanySettings(),
  ]);
  if (!ev) redirect("/evaluaties");

  const name = `${ev.consultant.firstName} ${ev.consultant.lastName}`;
  const pdf = await renderEvaluationPdf(ev, name, {
    name: settings.companyName,
    email: settings.email,
    phone: settings.phone,
    address: settings.address,
    postalCode: settings.postalCode,
    city: settings.city,
    kvkNumber: settings.kvkNumber,
    vatNumber: settings.vatNumber,
    website: settings.website,
  });
  const safeName = `evaluatie-${name}-Q${ev.quarter}-${ev.year}.pdf`.replace(
    /[^\w.-]+/g,
    "-",
  );
  const file = new File([Buffer.from(pdf)], safeName, { type: "application/pdf" });
  const stored = await saveUpload(ev.consultantId, file);
  await db.document.create({
    data: {
      consultantId: ev.consultantId,
      category: "EVALUATIE",
      title: `Evaluatie ${labelFor(EVALUATION_TYPES, ev.type)} — Q${ev.quarter} ${ev.year}`,
      fileName: stored,
      originalName: safeName,
      mimeType: "application/pdf",
      size: pdf.length,
    },
  });

  revalidatePath(`/evaluaties/${id}`);
  revalidatePath(`/werknemers/${ev.consultantId}`);
  revalidatePath("/", "layout");
  redirect(`/evaluaties/${id}?saved=1`);
}
