"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { DISCIPLINE_VALUES, EMPLOYMENT_VALUES } from "@/lib/domain";
import { saveUpload, deleteUpload } from "@/lib/uploads";

const ConsultantSchema = z.object({
  firstName: z.string().min(1, "Voornaam is verplicht"),
  lastName: z.string().min(1, "Achternaam is verplicht"),
  email: z.string().optional(),
  phone: z.string().optional(),
  discipline: z.enum(DISCIPLINE_VALUES, { message: "Kies een discipline" }),
  employmentType: z.enum(EMPLOYMENT_VALUES).default("ZZP"),
  defaultCostRate: z.coerce.number().min(0).default(0),
  // Personal
  dateOfBirth: z.coerce.date().optional(),
  bsn: z.string().optional(),
  nationality: z.string().optional(),
  // Contact
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional().default("Nederland"),
  // Employment & contract
  startDate: z.coerce.date().optional(),
  contractType: z.string().optional(),
  contractStart: z.coerce.date().optional(),
  contractEnd: z.coerce.date().optional(),
  // Company
  companyName: z.string().optional(),
  kvkNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  // Bank & emergency
  iban: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  notes: z.string().optional(),
});

function toData(data: z.infer<typeof ConsultantSchema>, active: boolean) {
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email ?? null,
    phone: data.phone ?? null,
    discipline: data.discipline,
    employmentType: data.employmentType,
    defaultCostRate: data.defaultCostRate,
    active,
    dateOfBirth: data.dateOfBirth ?? null,
    bsn: data.bsn ?? null,
    nationality: data.nationality ?? null,
    address: data.address ?? null,
    postalCode: data.postalCode ?? null,
    city: data.city ?? null,
    country: data.country ?? "Nederland",
    startDate: data.startDate ?? null,
    contractType: data.contractType ?? null,
    contractStart: data.contractStart ?? null,
    contractEnd: data.contractEnd ?? null,
    companyName: data.companyName ?? null,
    kvkNumber: data.kvkNumber ?? null,
    vatNumber: data.vatNumber ?? null,
    iban: data.iban ?? null,
    emergencyName: data.emergencyName ?? null,
    emergencyPhone: data.emergencyPhone ?? null,
    notes: data.notes ?? null,
  };
}

export async function createConsultant(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(ConsultantSchema, formData);
  if (!parsed.success) return parsed.state;

  const active = formData.get("active") === "on";
  const created = await db.consultant.create({ data: toData(parsed.data, active) });
  revalidatePath("/werknemers");
  redirect(`/werknemers/${created.id}`);
}

export async function updateConsultant(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Onbekende werknemer." };

  const parsed = parseForm(ConsultantSchema, formData);
  if (!parsed.success) return parsed.state;

  const active = formData.get("active") === "on";
  await db.consultant.update({ where: { id }, data: toData(parsed.data, active) });
  revalidatePath("/werknemers");
  revalidatePath(`/werknemers/${id}`);
  redirect(`/werknemers/${id}`);
}

export async function deleteConsultant(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await db.consultant.delete({ where: { id } });
  } catch {
    // Likely has placements (onDelete: Restrict). Certificates/documents cascade.
    redirect(`/werknemers/${id}?error=in-use`);
  }
  revalidatePath("/werknemers");
  redirect("/werknemers");
}

// ---------- Documents ----------

export async function uploadDocument(formData: FormData) {
  const consultantId = String(formData.get("consultantId") ?? "");
  const category = String(formData.get("category") ?? "OVERIG");
  const title = String(formData.get("title") ?? "").trim();
  const file = formData.get("file");

  if (!consultantId) return;
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/werknemers/${consultantId}?error=upload`);
  }

  const fileName = await saveUpload(consultantId, file as File);
  await db.document.create({
    data: {
      consultantId,
      category,
      title: title || (file as File).name,
      fileName,
      originalName: (file as File).name,
      mimeType: (file as File).type || "application/octet-stream",
      size: (file as File).size,
    },
  });

  revalidatePath(`/werknemers/${consultantId}`);
  redirect(`/werknemers/${consultantId}`);
}

export async function deleteDocument(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) return;
  await deleteUpload(doc.consultantId, doc.fileName);
  await db.document.delete({ where: { id } });
  revalidatePath(`/werknemers/${doc.consultantId}`);
  redirect(`/werknemers/${doc.consultantId}`);
}

// ---------- Certificates ----------

function dateOrNull(value: FormDataEntryValue | null): Date | null {
  const v = String(value ?? "").trim();
  return v ? new Date(`${v}T00:00:00`) : null;
}

export async function addCertificate(formData: FormData) {
  const consultantId = String(formData.get("consultantId") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!consultantId) return;
  if (!name) {
    redirect(`/werknemers/${consultantId}?error=cert`);
  }

  await db.certificate.create({
    data: {
      consultantId,
      name,
      number: String(formData.get("number") ?? "").trim() || null,
      issuedDate: dateOrNull(formData.get("issuedDate")),
      expiryDate: dateOrNull(formData.get("expiryDate")),
    },
  });

  revalidatePath(`/werknemers/${consultantId}`);
  redirect(`/werknemers/${consultantId}`);
}

export async function deleteCertificate(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const cert = await db.certificate.findUnique({ where: { id } });
  if (!cert) return;
  await db.certificate.delete({ where: { id } });
  revalidatePath(`/werknemers/${cert.consultantId}`);
  redirect(`/werknemers/${cert.consultantId}`);
}
