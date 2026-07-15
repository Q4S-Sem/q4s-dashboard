"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentRecruiterId, logNote } from "@/lib/crm";
import { DISCIPLINES, labelFor, CANDIDATE_AVAILABILITY_VALUES } from "@/lib/domain";
import { saveCvUpload, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { rematchCandidateSourcing, rematchVacancy } from "@/lib/matching";
import { aiRefineMatches } from "@/lib/msp";
import { aiJSONFromFile, isAIConfigured, isVisionConfigured } from "@/lib/ai";

/**
 * Zet een binnengekomen CV/kandidaat als **Lead** in de CRM-pijplijn. Idempotent:
 * is er al een deal voor deze kandidaat, dan open je die. Nieuwe deal komt in de
 * "lead"-fase, op naam van de ingelogde recruiter, bron = WEBSITE.
 */
export async function convertCvToLead(formData: FormData) {
  const candidateId = String(formData.get("candidateId") ?? "");
  if (!candidateId) redirect("/website/cvs");
  const cand = await db.candidate.findUnique({ where: { id: candidateId } });
  if (!cand) redirect("/website/cvs");

  const existing = await db.deal.findFirst({ where: { candidateId }, select: { id: true } });
  if (existing) redirect(`/crm/deals/${existing.id}`);

  const lead =
    (await db.crmStage.findFirst({ where: { key: "lead" } })) ??
    (await db.crmStage.findFirst({ where: { isWon: false, isLost: false }, orderBy: { order: "asc" } })) ??
    (await db.crmStage.findFirst({ orderBy: { order: "asc" } }));
  if (!lead) redirect("/website/cvs?error=nostage");

  const recruiterId = await currentRecruiterId();
  const name = `${cand.firstName} ${cand.lastName}`.trim();
  const disc = cand.discipline ? labelFor(DISCIPLINES, cand.discipline) : "";

  const deal = await db.deal.create({
    data: {
      title: disc ? `${name} — ${disc}` : name,
      company: cand.headline?.trim() || cand.location?.trim() || "Website-sollicitant",
      discipline: cand.discipline ?? null,
      stageId: lead.id,
      status: "OPEN",
      probability: lead.probability,
      source: "WEBSITE",
      ownerId: recruiterId,
      candidateId: cand.id,
    },
  });

  await logNote({
    dealId: deal.id,
    candidateId: cand.id,
    authorId: recruiterId,
    type: "SYSTEM",
    body: `Lead aangemaakt vanuit binnengekomen CV — ${name}${disc ? ` (${disc})` : ""}.`,
  });

  revalidatePath("/website/cvs");
  revalidatePath("/crm");
  redirect(`/crm/deals/${deal.id}`);
}

// --- Handmatig CV's importeren -----------------------------------------------

/** Toegestane CV-bestandstypen (PDF/Word/Excel/afbeelding/tekst). */
const CV_EXTENSIONS = new Set([
  ".pdf", ".doc", ".docx", ".rtf", ".odt", ".txt",
  ".xls", ".xlsx", ".csv", ".png", ".jpg", ".jpeg", ".webp",
]);
function isAllowedCv(file: File): boolean {
  const m = file.name.toLowerCase().match(/\.[a-z0-9]+$/);
  return m ? CV_EXTENSIONS.has(m[0]) : false;
}

/** Haal een fatsoenlijke voor-/achternaam uit een bestandsnaam als er verder
 *  niets bekend is (bv. "Jan_de_Vries_CV_2025.pdf" → Jan / de Vries). */
function nameFromFilename(name: string): { firstName: string; lastName: string } {
  let base = name.replace(/\.[a-z0-9]+$/i, "").replace(/[_\-.]+/g, " ");
  base = base.replace(/\b(cv|curriculum vitae|resume|resum[ée]|sollicitatie|q4s)\b/gi, " ");
  base = base.replace(/\b(19|20)\d{2}\b/g, " ").replace(/\s+/g, " ").trim();
  const parts = base.split(" ").filter(Boolean);
  if (parts.length === 0) return { firstName: "Onbekend", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

const CV_EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    firstName: { type: ["string", "null"] },
    lastName: { type: ["string", "null"] },
    discipline: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
    phone: { type: ["string", "null"] },
    headline: { type: ["string", "null"] },
  },
  required: ["firstName", "lastName", "discipline", "email", "phone", "headline"],
} as const;

type CvExtract = {
  firstName: string | null;
  lastName: string | null;
  discipline: string | null;
  email: string | null;
  phone: string | null;
  headline: string | null;
};

/** Best-effort: lees naam/discipline/contact uit een PDF of afbeelding via AI.
 *  Word/Excel worden overgeslagen (geen native extractie) → null. */
async function aiExtractCvFields(file: File): Promise<CvExtract | null> {
  if (!isVisionConfigured()) return null;
  const type = file.type;
  let mediaType = "";
  if (type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")) mediaType = "application/pdf";
  else if (/^image\/(png|jpe?g|gif|webp)$/.test(type)) mediaType = type;
  else return null;
  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    return await aiJSONFromFile<CvExtract>({
      system:
        "Je leest CV's van technische kandidaten (QA/QC, lassers, fitters, NDO/NDT). Geef alleen wat echt op het CV staat; verzin niets.",
      prompt:
        "Haal uit dit CV: voornaam, achternaam, discipline/vakgebied, e-mail, telefoon en een korte functietitel (headline). Onbekende velden = null.",
      schema: CV_EXTRACT_SCHEMA,
      file: { base64, mediaType },
      maxTokens: 500,
      effort: "low",
    });
  } catch {
    return null;
  }
}

/** Eén CV handmatig importeren: bestand + naam (+ optionele velden) → kandidaat
 *  met het CV eraan, bron = IMPORT. Zoekt meteen matches op openstaande vacatures. */
export async function importCv(formData: FormData) {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const file = formData.get("file");

  if (!firstName && !lastName) redirect("/website/cvs/importeren?error=naam");
  if (!(file instanceof File) || file.size === 0) redirect("/website/cvs/importeren?error=bestand");
  if (file.size > MAX_UPLOAD_BYTES) redirect("/website/cvs/importeren?error=groot");
  if (!isAllowedCv(file)) redirect("/website/cvs/importeren?error=type");

  const availabilityRaw = String(formData.get("availability") ?? "ONBEKEND");
  const availability = CANDIDATE_AVAILABILITY_VALUES.includes(availabilityRaw) ? availabilityRaw : "ONBEKEND";

  const cvFileName = await saveCvUpload(file);
  const cand = await db.candidate.create({
    data: {
      firstName: firstName || "Onbekend",
      lastName,
      email: String(formData.get("email") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      discipline: String(formData.get("discipline") ?? "").trim() || null,
      headline: String(formData.get("headline") ?? "").trim() || null,
      availability,
      source: "IMPORT",
      cvFileName,
      cvOriginalName: file.name,
      cvMimeType: file.type || "application/octet-stream",
      cvSize: file.size,
    },
  });

  try {
    await rematchCandidateSourcing(cand.id);
  } catch {
    // matching is best-effort; het CV staat er nu al.
  }

  revalidatePath("/website/cvs");
  redirect("/website/cvs?import=1");
}

/** Meerdere CV's tegelijk importeren (een stapel). Namen komen uit de
 *  bestandsnaam; met AI aan worden naam/discipline/contact uit PDF's gelezen. */
export async function importCvsBulk(formData: FormData) {
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) redirect("/website/cvs/importeren?error=bestand");
  const useAi = formData.get("useAi") === "on" && isVisionConfigured();

  let created = 0;
  let skipped = 0;
  const ids: string[] = [];
  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES || !isAllowedCv(file)) {
      skipped++;
      continue;
    }
    let { firstName, lastName } = nameFromFilename(file.name);
    let discipline: string | null = null;
    let email: string | null = null;
    let phone: string | null = null;
    let headline: string | null = null;

    if (useAi) {
      const ex = await aiExtractCvFields(file);
      if (ex) {
        if (ex.firstName?.trim()) firstName = ex.firstName.trim();
        if (ex.lastName?.trim()) lastName = ex.lastName.trim();
        discipline = ex.discipline?.trim() || null;
        email = ex.email?.trim() || null;
        phone = ex.phone?.trim() || null;
        headline = ex.headline?.trim() || null;
      }
    }

    const cvFileName = await saveCvUpload(file);
    const cand = await db.candidate.create({
      data: {
        firstName: firstName || "Onbekend",
        lastName,
        email,
        phone,
        discipline,
        headline,
        source: "IMPORT",
        cvFileName,
        cvOriginalName: file.name,
        cvMimeType: file.type || "application/octet-stream",
        cvSize: file.size,
      },
    });
    ids.push(cand.id);
    created++;
  }

  for (const id of ids) {
    try {
      await rematchCandidateSourcing(id);
    } catch {
      // best-effort
    }
  }

  revalidatePath("/website/cvs");
  redirect(`/website/cvs?import=bulk&n=${created}&skip=${skipped}`);
}

// --- Vacature-gedreven matchflow (zoekopdrachten) ----------------------------

/** "Ik zoek kandidaten": zet de vacature als actieve zoekopdracht op de
 *  CV-matches-pagina en ga er meteen naartoe. */
export async function startSourcing(formData: FormData) {
  const id = String(formData.get("vacancyId") ?? "");
  if (!id) redirect("/website/cvs/matches");
  await db.vacancy.update({ where: { id }, data: { sourcing: true } });
  revalidatePath("/website/cvs/matches");
  revalidatePath(`/vacatures/${id}`);
  revalidatePath("/website/vacatures");
  redirect("/website/cvs/matches");
}

/** Stop de zoekopdracht: haal de vacature van de CV-matches-pagina. */
export async function stopSourcing(formData: FormData) {
  const id = String(formData.get("vacancyId") ?? "");
  if (!id) return;
  await db.vacancy.update({ where: { id }, data: { sourcing: false } });
  revalidatePath("/website/cvs/matches");
  revalidatePath(`/vacatures/${id}`);
  revalidatePath("/website/vacatures");
}

/** "Zoek match": doorzoek de hele kandidaten-/CV-database voor deze ene vacature
 *  (regelmatch + AI-verfijning als AI ingesteld is). Blijft op de matchpagina. */
export async function searchMatchesForVacancy(formData: FormData) {
  const id = String(formData.get("vacancyId") ?? "");
  if (!id) return;
  try {
    const n = await rematchVacancy(id);
    if (isAIConfigured() && n > 0) await aiRefineMatches(id);
    await db.vacancy.update({ where: { id }, data: { lastMatchedAt: new Date(), sourcing: true } });
  } catch {
    // best-effort
  }
  revalidatePath("/website/cvs/matches");
}

/**
 * Zoek matches voor ALLE actieve zoekopdrachten in één keer. Per vacature eerst
 * de regelmatch, daarna AI-verfijning (als AI ingesteld is). Voedt de CV-matches.
 */
export async function runCvMatching() {
  const vacancies = await db.vacancy.findMany({
    where: { sourcing: true },
    select: { id: true },
  });
  const aiOn = isAIConfigured();
  for (const v of vacancies) {
    try {
      const n = await rematchVacancy(v.id);
      if (aiOn && n > 0) await aiRefineMatches(v.id);
      await db.vacancy.update({ where: { id: v.id }, data: { lastMatchedAt: new Date() } });
    } catch {
      // per-vacature best-effort; ga door met de rest.
    }
  }
  revalidatePath("/website/cvs/matches");
  revalidatePath("/website/cvs");
  redirect("/website/cvs/matches?matched=1");
}
