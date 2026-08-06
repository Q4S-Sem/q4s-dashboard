"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { CvExtractError, extractCvProfile } from "@/lib/cv-extract";
import {
  cvCertificateSchema,
  cvEducationSchema,
  cvExperienceSchema,
  cvLanguageSchema,
  serializeSection,
  type CvProfileData,
} from "@/lib/cv-profile";
import { cvKey, MAX_UPLOAD_BYTES, saveCvUpload } from "@/lib/uploads";
import { getObject } from "@/lib/storage";

/**
 * Server actions van de CV-generator: bestand erin → AI leest het → CvProfile →
 * review → PDF/Word. Zie src/lib/cv-profile.ts voor de vorm van het profiel.
 */

/** Profieldata → de kolommen van CvProfile (secties als JSON-tekst). */
function dataToRecord(data: CvProfileData) {
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

// ---------------------------------------------------------------------------
// Uitlezen
// ---------------------------------------------------------------------------

/**
 * Lees een geüpload CV uit en maak er een profiel van. Werkt met of zonder
 * kandidaat: zonder `candidateId` is het een ad-hoc CV (los door de generator).
 */
export async function startCvProfile(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const candidateId = String(formData.get("candidateId") ?? "").trim() || null;
  const file = formData.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return { error: "Kies een CV-bestand (PDF of Word)." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "Het bestand is te groot (max. 15 MB)." };
  }
  if (candidateId) {
    const exists = await db.candidate.findUnique({
      where: { id: candidateId },
      select: { id: true },
    });
    if (!exists) return { error: "Deze kandidaat bestaat niet (meer)." };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  let data: CvProfileData;
  try {
    data = await extractCvProfile(bytes, file.name, file.type);
  } catch (err) {
    if (err instanceof CvExtractError) return { error: err.message };
    return {
      error: "Het uitlezen van dit CV is mislukt. Probeer het opnieuw of gebruik een ander bestand.",
    };
  }

  // Pas ná een geslaagde extractie opslaan — anders vult _cv/ zich met bestanden
  // van mislukte pogingen.
  const storedName = await saveCvUpload(file);

  const record = {
    ...dataToRecord(data),
    sourceFileName: storedName,
    sourceOriginalName: file.name,
  };

  // Eén profiel per kandidaat (candidateId is @unique): opnieuw uitlezen vervangt
  // het vorige profiel i.p.v. te crashen op de unique-constraint.
  const profile = candidateId
    ? await db.cvProfile.upsert({
        where: { candidateId },
        create: { ...record, candidateId },
        update: record,
      })
    : await db.cvProfile.create({ data: record });

  revalidatePath("/socials/cv-generator");
  if (candidateId) revalidatePath(`/kandidaten/${candidateId}`);
  redirect(`/socials/cv-generator/${profile.id}`);
}

/**
 * Maak een profiel uit het CV dat al bij de kandidaat staat — de recruiter hoeft
 * dan niets opnieuw te uploaden.
 *
 * `terug` bepaalt waar een mislukking landt. Vanuit het kandidaat-dossier is dat
 * het dossier zelf; vanuit het mapje Kandidaten in de generator hoor je daar
 * terug te komen, niet ergens anders in de app.
 */
export async function profileFromCandidateCv(formData: FormData) {
  const candidateId = String(formData.get("candidateId") ?? "").trim();
  if (!candidateId) return;
  const terug = String(formData.get("terug") ?? "").trim();
  const mislukt = (code: string) =>
    terug.startsWith("/")
      ? `${terug}${terug.includes("?") ? "&" : "?"}fout=${code}`
      : `/kandidaten/${candidateId}/cv?error=${code}`;

  const candidate = await db.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate?.cvFileName) {
    redirect(mislukt("geen-cv"));
  }

  let bytes: Buffer;
  try {
    bytes = await getObject(cvKey(candidate.cvFileName));
  } catch {
    redirect(mislukt("cv-bestand"));
  }

  let data: CvProfileData;
  try {
    data = await extractCvProfile(
      bytes,
      candidate.cvOriginalName ?? candidate.cvFileName,
      candidate.cvMimeType ?? "",
    );
  } catch {
    redirect(mislukt("uitlezen"));
  }

  const record = {
    ...dataToRecord(data),
    // Naam van de kandidaat wint van wat de AI las: die is door een mens ingevoerd.
    fullName: `${candidate.firstName} ${candidate.lastName}`.trim() || data.fullName,
    sourceFileName: candidate.cvFileName,
    sourceOriginalName: candidate.cvOriginalName,
  };

  const profile = await db.cvProfile.upsert({
    where: { candidateId },
    create: { ...record, candidateId },
    update: record,
  });

  revalidatePath(`/kandidaten/${candidateId}`);
  revalidatePath("/socials/cv-generator/kandidaten");
  redirect(`/socials/cv-generator/${profile.id}`);
}

// ---------------------------------------------------------------------------
// Review opslaan
// ---------------------------------------------------------------------------

/**
 * De herhalende secties komen als JSON-tekst uit het review-formulier (de
 * repeater is client-side). Valideren met hetzelfde Zod-schema als de AI-uitvoer:
 * geknoeide of kapotte JSON wordt zo een nette lege sectie, geen 500.
 */
function jsonList<T extends z.ZodTypeAny>(raw: FormDataEntryValue | null, schema: T): z.infer<T>[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const out: z.infer<T>[] = [];
  for (const item of parsed) {
    const r = schema.safeParse(item);
    if (r.success) out.push(r.data);
  }
  return out;
}

const reviewSchema = z.object({
  id: z.string().min(1),
  fullName: z.string().min(1, "Vul een naam in."),
  headline: z.string().optional(),
  location: z.string().optional(),
  availability: z.string().optional(),
  summary: z.string().optional(),
  yearsExperience: z.coerce.number().int().min(0).max(70).optional(),
});

export async function saveCvProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(reviewSchema, formData);
  if (!parsed.success) return parsed.state;
  const { id, ...fields } = parsed.data;

  const existing = await db.cvProfile.findUnique({ where: { id }, select: { candidateId: true } });
  if (!existing) return { error: "Dit CV-profiel bestaat niet meer." };

  const skills = jsonList(formData.get("skillsJson"), z.string().trim().min(1));

  await db.cvProfile.update({
    where: { id },
    data: {
      fullName: fields.fullName,
      headline: fields.headline ?? null,
      location: fields.location ?? null,
      availability: fields.availability ?? null,
      summary: fields.summary ?? null,
      yearsExperience: fields.yearsExperience ?? null,
      // Checkbox: lees direct uit FormData (conventie — niet via Zod).
      anonymize: formData.get("anonymize") === "on",
      skillsJson: serializeSection(skills),
      languagesJson: serializeSection(jsonList(formData.get("languagesJson"), cvLanguageSchema)),
      experienceJson: serializeSection(jsonList(formData.get("experienceJson"), cvExperienceSchema)),
      educationJson: serializeSection(jsonList(formData.get("educationJson"), cvEducationSchema)),
      certificatesJson: serializeSection(
        jsonList(formData.get("certificatesJson"), cvCertificateSchema),
      ),
    },
  });

  revalidatePath(`/socials/cv-generator/${id}`);
  revalidatePath("/socials/cv-generator");
  if (existing.candidateId) revalidatePath(`/kandidaten/${existing.candidateId}`);
  redirect(`/socials/cv-generator/${id}?opgeslagen=1`);
}

export async function deleteCvProfile(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const profile = await db.cvProfile.findUnique({ where: { id }, select: { candidateId: true } });
  if (!profile) redirect("/socials/cv-generator");

  await db.cvProfile.delete({ where: { id } });
  // Het bronbestand in _cv/ blijft staan: bij een kandidaat is dat "het CV" van de
  // talentpool, dat los van dit profiel bestaat.
  revalidatePath("/socials/cv-generator");
  if (profile.candidateId) revalidatePath(`/kandidaten/${profile.candidateId}`);
  redirect("/socials/cv-generator");
}
