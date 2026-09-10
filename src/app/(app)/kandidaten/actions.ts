"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import {
  CANDIDATE_RATING_VALUES,
  CANDIDATE_AVAILABILITY_VALUES,
  CANDIDATE_INTERVIEW_STATUS_VALUES,
} from "@/lib/domain";
import {
  saveCvUpload,
  deleteCvUpload,
  savePhotoUpload,
  deletePhotoUpload,
  MAX_UPLOAD_BYTES,
  MAX_PHOTO_BYTES,
  PHOTO_MIME_TYPES,
} from "@/lib/uploads";
import { extractCandidateFields, CvExtractError, type CandidateFields } from "@/lib/cv-extract";

const CandidateSchema = z.object({
  firstName: z.string().min(1, "Voornaam is verplicht"),
  lastName: z.string().min(1, "Achternaam is verplicht"),
  email: z.string().optional(),
  phone: z.string().optional(),
  discipline: z.string().optional(),
  headline: z.string().optional(),
  location: z.string().optional(),
  linkedinUrl: z.string().optional(),
  rating: z.enum(CANDIDATE_RATING_VALUES).default("ONBEKEND"),
  availability: z.enum(CANDIDATE_AVAILABILITY_VALUES).default("ONBEKEND"),
  availableFrom: z.coerce.date().optional(),
  interviewStatus: z.enum(CANDIDATE_INTERVIEW_STATUS_VALUES).default("NONE"),
  interviewDate: z.coerce.date().optional(),
  experienceSummary: z.string().optional(),
  notes: z.string().optional(),
});

// Build the DB payload, turning undefined optionals into null so that
// clearing a field on edit actually clears it.
function toData(data: z.infer<typeof CandidateSchema>) {
  return {
    firstName: data.firstName,
    lastName: data.lastName,
    email: data.email ?? null,
    phone: data.phone ?? null,
    discipline: data.discipline ?? null,
    headline: data.headline ?? null,
    location: data.location ?? null,
    linkedinUrl: data.linkedinUrl ?? null,
    rating: data.rating,
    availability: data.availability,
    // Alleen relevant bij "binnenkort"; anders opschonen.
    availableFrom:
      data.availability === "BINNENKORT" ? (data.availableFrom ?? null) : null,
    interviewStatus: data.interviewStatus,
    // Datum wissen bij "nog niet"; bij "op interview geweest" zonder ingevulde
    // datum automatisch vandaag invullen — gelijk aan de inline InterviewSelect.
    interviewDate:
      data.interviewStatus === "NONE"
        ? null
        : (data.interviewDate ??
          (data.interviewStatus === "DONE" ? new Date() : null)),
    experienceSummary: data.experienceSummary ?? null,
    notes: data.notes ?? null,
  };
}

/** Quick-set a candidate's recruiter rating from the talentpool list. */
export async function setCandidateRating(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const rating = String(formData.get("rating") ?? "");
  if (!id || !CANDIDATE_RATING_VALUES.includes(rating)) return;
  await db.candidate.update({ where: { id }, data: { rating } });
  revalidatePath("/kandidaten");
  revalidatePath(`/kandidaten/${id}`);
}

/**
 * Quick-set a candidate's availability from the talentpool list. An optional
 * `availableFrom` (yyyy-mm-dd) is only kept for the "binnenkort" status; every
 * other status clears the date so stale dates don't linger.
 */
export async function setCandidateAvailability(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const availability = String(formData.get("availability") ?? "");
  if (!id || !CANDIDATE_AVAILABILITY_VALUES.includes(availability)) return;

  const rawFrom = String(formData.get("availableFrom") ?? "").trim();
  const parsed = rawFrom ? new Date(rawFrom) : null;
  const availableFrom =
    availability === "BINNENKORT" && parsed && !Number.isNaN(parsed.getTime())
      ? parsed
      : null;

  await db.candidate.update({
    where: { id },
    data: { availability, availableFrom },
  });
  revalidatePath("/kandidaten");
  revalidatePath("/kandidaten/beschikbaar");
  revalidatePath(`/kandidaten/${id}`);
}

/** Quick-save a candidate's notes from the detail page, zonder het hele formulier. */
export async function setCandidateNotes(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const raw = String(formData.get("notes") ?? "").trim();
  await db.candidate.update({
    where: { id },
    data: { notes: raw === "" ? null : raw },
  });
  revalidatePath(`/kandidaten/${id}`);
}

/**
 * Quick-set a candidate's interview-with-Q4S status from the list/detail. Marking
 * "op interview geweest" zonder datum vult automatisch vandaag in; terug naar
 * "nog niet" wist de datum weer.
 */
export async function setCandidateInterview(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("interviewStatus") ?? "");
  if (!id || !CANDIDATE_INTERVIEW_STATUS_VALUES.includes(status)) return;

  const current = await db.candidate.findUnique({
    where: { id },
    select: { interviewDate: true },
  });
  let interviewDate = current?.interviewDate ?? null;
  if (status === "DONE" && !interviewDate) interviewDate = new Date();
  if (status === "NONE") interviewDate = null;

  await db.candidate.update({
    where: { id },
    data: { interviewStatus: status, interviewDate },
  });
  revalidatePath("/kandidaten");
  revalidatePath(`/kandidaten/${id}`);
}

/** Interview-datum en -notities zelf invullen op de kandidaatpagina. Lege datum
 *  wist de datum; lege notitie wist de notitie. */
export async function saveCandidateInterviewDetails(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const rawDate = String(formData.get("interviewDate") ?? "").trim();
  const parsed = rawDate ? new Date(rawDate) : null;
  const interviewDate = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
  const rawNotes = String(formData.get("interviewNotes") ?? "").trim();

  await db.candidate.update({
    where: { id },
    data: { interviewDate, interviewNotes: rawNotes || null },
  });
  revalidatePath(`/kandidaten/${id}`);
}

// ---------- Plaatsingshistorie (bij welke bedrijven geplaatst) ----------

export async function addCandidatePlacement(formData: FormData) {
  const candidateId = String(formData.get("candidateId") ?? "");
  const company = String(formData.get("company") ?? "").trim();
  if (!candidateId) return;
  if (!company) redirect(`/kandidaten/${candidateId}/plaatsingen?error=plaatsing`);

  const role = String(formData.get("role") ?? "").trim() || null;
  const notes = String(formData.get("notes") ?? "").trim() || null;
  const parseDate = (key: string): Date | null => {
    const raw = String(formData.get(key) ?? "").trim();
    if (!raw) return null;
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  await db.candidatePlacement.create({
    data: {
      candidateId,
      company,
      role,
      notes,
      startDate: parseDate("startDate"),
      endDate: parseDate("endDate"),
    },
  });
  revalidatePath(`/kandidaten/${candidateId}`);
  revalidatePath("/kandidaten");
  redirect(`/kandidaten/${candidateId}/plaatsingen`);
}

export async function deleteCandidatePlacement(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  // Haal de kandidaat-id uit de plaatsing zelf, zodat we terug kunnen navigeren.
  const placement = await db.candidatePlacement.findUnique({
    where: { id },
    select: { candidateId: true },
  });
  try {
    await db.candidatePlacement.delete({ where: { id } });
  } catch {
    // Rij al weg (dubbele submit / verouderde pagina) — behandel als no-op.
  }
  revalidatePath("/kandidaten");
  if (placement?.candidateId) {
    revalidatePath(`/kandidaten/${placement.candidateId}`);
    redirect(`/kandidaten/${placement.candidateId}/plaatsingen`);
  }
  redirect("/kandidaten");
}

export async function createCandidate(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(CandidateSchema, formData);
  if (!parsed.success) return parsed.state;

  // Optioneel meegestuurd CV-bestand (uit de "CV inlezen"-flow) meteen koppelen.
  // De upload naar objectopslag/cloud mag de kandidaat-opslag NOOIT laten crashen:
  // hapert R2 of de cloud-mirror even, dan slaan we de kandidaat gewoon op zonder
  // CV (die kun je daarna opnieuw uploaden) i.p.v. een serverfout te tonen.
  const file = formData.get("cvFile");
  let cvMeta: {
    cvFileName: string;
    cvOriginalName: string;
    cvMimeType: string;
    cvSize: number;
  } | null = null;
  if (file instanceof File && file.size > 0 && file.size <= MAX_UPLOAD_BYTES) {
    try {
      const fileName = await saveCvUpload(file);
      cvMeta = {
        cvFileName: fileName,
        cvOriginalName: file.name,
        cvMimeType: file.type || "application/octet-stream",
        cvSize: file.size,
      };
    } catch (err) {
      console.error("CV-upload bij nieuwe kandidaat mislukt (kandidaat wordt zonder CV opgeslagen):", err);
      cvMeta = null;
    }
  }

  // Manually-added candidates are MANUAL. WEBSITE/TALENTPOOL candidates are
  // created via their own public actions and must keep that source on edit —
  // so `source` is intentionally NOT part of the shared edit payload.
  await db.candidate.create({
    data: { ...toData(parsed.data), source: "MANUAL", ...(cvMeta ?? {}) },
  });
  revalidatePath("/kandidaten");
  // Na het aanmaken terug naar de talentpool-lijst (niet naar het dossier van de
  // nieuwe kandidaat) — de recruiter wil daar verder werken/de volgende toevoegen.
  redirect("/kandidaten");
}

export async function updateCandidate(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Onbekende kandidaat." };

  const parsed = parseForm(CandidateSchema, formData);
  if (!parsed.success) return parsed.state;

  await db.candidate.update({ where: { id }, data: toData(parsed.data) });
  revalidatePath("/kandidaten");
  revalidatePath(`/kandidaten/${id}`);
  redirect(`/kandidaten/${id}`);
}

export async function deleteCandidate(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await db.candidate.delete({ where: { id } });
  } catch {
    // Likely has applications (onDelete: Restrict).
    redirect(`/kandidaten/${id}?error=in-use`);
  }
  revalidatePath("/kandidaten");
  redirect("/kandidaten");
}

// ---------- CV upload ----------

export async function uploadCv(formData: FormData) {
  const candidateId = String(formData.get("candidateId") ?? "");
  const file = formData.get("file");

  if (!candidateId) return;
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/kandidaten/${candidateId}/cv?error=upload`);
  }
  if ((file as File).size > MAX_UPLOAD_BYTES) {
    redirect(`/kandidaten/${candidateId}/cv?error=size`);
  }

  const fileName = await saveCvUpload(file as File);

  // Werkervaring automatisch uitlezen en invullen als die nog leeg is, zodat de
  // uitgelezen ervaring meteen op de kandidaat verschijnt (Overzicht → Werkervaring).
  // Nooit fataal: mislukt het uitlezen, dan blijft de upload gewoon staan.
  let experienceSummary: string | null = null;
  try {
    const current = await db.candidate.findUnique({
      where: { id: candidateId },
      select: { experienceSummary: true },
    });
    if (!current?.experienceSummary?.trim()) {
      const bytes = Buffer.from(await (file as File).arrayBuffer());
      const fields = await extractCandidateFields(bytes, (file as File).name, (file as File).type || "");
      if (fields.experienceSummary) experienceSummary = fields.experienceSummary;
    }
  } catch (err) {
    console.error("uploadCv: automatische werkervaring-uitlezing mislukt:", err);
  }

  await db.candidate.update({
    where: { id: candidateId },
    data: {
      cvFileName: fileName,
      cvOriginalName: (file as File).name,
      cvMimeType: (file as File).type || "application/octet-stream",
      cvSize: (file as File).size,
      ...(experienceSummary ? { experienceSummary } : {}),
    },
  });

  revalidatePath(`/kandidaten/${candidateId}`);
  redirect(`/kandidaten/${candidateId}/cv`);
}

export async function deleteCv(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const candidate = await db.candidate.findUnique({ where: { id } });
  if (!candidate) return;
  if (candidate.cvFileName) {
    await deleteCvUpload(candidate.cvFileName);
  }
  await db.candidate.update({
    where: { id },
    data: {
      cvFileName: null,
      cvOriginalName: null,
      cvMimeType: null,
      cvSize: null,
    },
  });
  revalidatePath(`/kandidaten/${id}`);
  redirect(`/kandidaten/${id}/cv`);
}

// ---------- Profielfoto ----------

/** Upload of vervang de pasfoto van een kandidaat. */
export async function uploadPhoto(formData: FormData) {
  const candidateId = String(formData.get("candidateId") ?? "");
  const file = formData.get("file");

  if (!candidateId) return;
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/kandidaten/${candidateId}?error=foto`);
  }
  if (file.size > MAX_PHOTO_BYTES) {
    redirect(`/kandidaten/${candidateId}?error=foto-groot`);
  }
  if (!PHOTO_MIME_TYPES.includes(file.type)) {
    redirect(`/kandidaten/${candidateId}?error=foto-type`);
  }

  // Oude foto opruimen zodat er geen wees-bestanden achterblijven.
  const current = await db.candidate.findUnique({
    where: { id: candidateId },
    select: { photoFileName: true },
  });
  if (current?.photoFileName) {
    await deletePhotoUpload(current.photoFileName).catch(() => {});
  }

  const fileName = await savePhotoUpload(file);
  await db.candidate.update({
    where: { id: candidateId },
    data: { photoFileName: fileName, photoMimeType: file.type },
  });

  revalidatePath("/kandidaten");
  revalidatePath(`/kandidaten/${candidateId}`);
  redirect(`/kandidaten/${candidateId}`);
}

export async function deletePhoto(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const candidate = await db.candidate.findUnique({
    where: { id },
    select: { photoFileName: true },
  });
  if (candidate?.photoFileName) {
    await deletePhotoUpload(candidate.photoFileName).catch(() => {});
  }
  await db.candidate.update({
    where: { id },
    data: { photoFileName: null, photoMimeType: null },
  });
  revalidatePath("/kandidaten");
  revalidatePath(`/kandidaten/${id}`);
  redirect(`/kandidaten/${id}`);
}

// ---------- CV automatisch uitlezen (talentpool) ----------

export type CvReadResult =
  | { ok: true; fields: CandidateFields }
  | { ok: false; error: string };

/**
 * Lees een geüpload CV (PDF/Word/afbeelding) uit tot talentpool-kandidaatvelden.
 * Wordt aangeroepen vanuit het "Nieuwe kandidaat"-formulier zodat de recruiter de
 * gevonden gegevens nog kan controleren en corrigeren vóór opslaan. Slaat zelf
 * niets op — puur uitlezen.
 */
export async function readCvFields(formData: FormData): Promise<CvReadResult> {
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Geen bestand ontvangen." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, error: "Dit bestand is te groot." };
  }
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const fields = await extractCandidateFields(bytes, file.name, file.type || "");
    return { ok: true, fields };
  } catch (err) {
    if (err instanceof CvExtractError) return { ok: false, error: err.message };
    // Toon de échte reden (bijv. een OpenRouter-fout) i.p.v. een nietszeggende
    // tekst, zodat je meteen ziet wat er misgaat en het gericht kunt oplossen.
    const detail = err instanceof Error ? err.message : String(err);
    console.error("readCvFields mislukt:", err);
    return {
      ok: false,
      error: `Het CV kon niet uitgelezen worden: ${detail}. Probeer het opnieuw of vul handmatig in.`,
    };
  }
}
