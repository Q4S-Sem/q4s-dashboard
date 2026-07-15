"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { saveCvUpload, MAX_UPLOAD_BYTES } from "@/lib/uploads";

const ApplySchema = z.object({
  firstName: z.string().min(1, "Voornaam is verplicht"),
  lastName: z.string().min(1, "Achternaam is verplicht"),
  email: z.string().email("Vul een geldig e-mailadres in").optional(),
  phone: z.string().optional(),
  discipline: z.string().optional(),
  motivation: z.string().optional(),
});

export async function applyToVacancy(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const vacancyId = String(formData.get("vacancyId") ?? "");
  const slug = String(formData.get("slug") ?? "");
  if (!vacancyId) return { error: "Onbekende vacature." };

  const parsed = parseForm(ApplySchema, formData);
  if (!parsed.success) return parsed.state;
  const data = parsed.data;

  // Only accept applications on a vacancy that actually exists and is live.
  const vacancy = await db.vacancy.findUnique({ where: { id: vacancyId } });
  if (!vacancy || vacancy.status !== "PUBLISHED") {
    return { error: "Deze vacature is niet (meer) beschikbaar." };
  }

  // Optional CV upload — robust: skip silently when no/empty/oversized file is
  // sent (this is a public endpoint, so the size cap is a DoS guard).
  const file = formData.get("cv");
  let cvFileName: string | null = null;
  let cvOriginalName: string | null = null;
  let cvMimeType: string | null = null;
  let cvSize: number | null = null;
  if (file instanceof File && file.size > 0 && file.size <= MAX_UPLOAD_BYTES) {
    try {
      cvFileName = await saveCvUpload(file);
      cvOriginalName = file.name;
      cvMimeType = file.type || "application/octet-stream";
      cvSize = file.size;
    } catch {
      // Upload failed — continue without a CV rather than dropping the sollicitatie.
      cvFileName = null;
    }
  }

  const candidate = await db.candidate.create({
    data: {
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email ?? null,
      phone: data.phone ?? null,
      discipline: data.discipline ?? null,
      source: "WEBSITE",
      cvFileName,
      cvOriginalName,
      cvMimeType,
      cvSize,
    },
  });

  await db.application.create({
    data: {
      candidateId: candidate.id,
      vacancyId,
      status: "NEW",
      motivation: data.motivation ?? null,
    },
  });

  redirect(`/vacature/${slug || vacancy.slug}?ok=1`);
}
