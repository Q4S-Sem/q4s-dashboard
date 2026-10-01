"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { currentRecruiterId, logNote } from "@/lib/crm";
import { DISCIPLINES, labelFor, CANDIDATE_AVAILABILITY_VALUES } from "@/lib/domain";
import { saveCvUpload, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { rematchVacancy } from "@/lib/matching";
import { runCvIntakeShortlist } from "@/lib/cv-intake";
import { aiExtractCvFields, isReadableCvName, nameFromCvFilename } from "@/lib/cv-import";
import { aiRefineMatches } from "@/lib/msp";
import { isAIConfigured, isVisionConfigured } from "@/lib/ai";
import { mirrorDealToVacancy } from "@/lib/vacancy-mirror";
import { aiImproveVacancy } from "@/lib/recruitment";

/**
 * Zet een binnengekomen CV/kandidaat als **Lead** in de CRM-pijplijn. Idempotent:
 * is er al een deal voor deze kandidaat, dan open je die. Nieuwe deal komt in de
 * "lead"-fase, op naam van de ingelogde recruiter, bron = WEBSITE.
 */
export async function convertCvToLead(formData: FormData) {
  const candidateId = String(formData.get("candidateId") ?? "");
  if (!candidateId) redirect("/website/cv-inbox");
  const cand = await db.candidate.findUnique({ where: { id: candidateId } });
  if (!cand) redirect("/website/cv-inbox");

  const existing = await db.deal.findFirst({ where: { candidateId }, select: { id: true } });
  if (existing) redirect(`/crm/deals/${existing.id}`);

  const lead =
    (await db.crmStage.findFirst({ where: { key: "lead" } })) ??
    (await db.crmStage.findFirst({ where: { isWon: false, isLost: false }, orderBy: { order: "asc" } })) ??
    (await db.crmStage.findFirst({ orderBy: { order: "asc" } }));
  if (!lead) redirect("/website/cv-inbox?error=nostage");

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

  revalidatePath("/website/cv-inbox");
  revalidatePath("/crm");
  redirect(`/crm/deals/${deal.id}`);
}

/** Run (or safely retry) CV intake for one inbox candidate. The result remains a
 * recruiter-review suggestion; this action never creates a deal, application,
 * placement, outreach or status transition. */
export async function shortlistCv(formData: FormData) {
  const candidateId = String(formData.get("candidateId") ?? "").trim();
  if (!candidateId) return;
  await runCvIntakeShortlist(candidateId);
  revalidatePath("/website/cv-inbox");
  revalidatePath(`/kandidaten/${candidateId}`);
}

// --- Handmatig CV's importeren -----------------------------------------------
// De bestandstype-check, de naam-uit-bestandsnaam en de AI-velduitlezing staan in
// @/lib/cv-import, zodat de postvak-intake (gemailde CV's) exact dezelfde weg loopt.

/** Eén CV handmatig importeren: bestand + naam (+ optionele velden) → kandidaat
 *  met het CV eraan, bron = IMPORT. Zoekt meteen matches op openstaande vacatures. */
export async function importCv(formData: FormData) {
  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();
  const file = formData.get("file");

  if (!firstName && !lastName) redirect("/website/cv-inbox/importeren?error=naam");
  if (!(file instanceof File) || file.size === 0) redirect("/website/cv-inbox/importeren?error=bestand");
  if (file.size > MAX_UPLOAD_BYTES) redirect("/website/cv-inbox/importeren?error=groot");
  if (!isReadableCvName(file.name)) redirect("/website/cv-inbox/importeren?error=type");

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
    await runCvIntakeShortlist(cand.id);
  } catch {
    // Intake failures are persisted as an auditable ERROR run; importing the CV still succeeds.
  }

  revalidatePath("/website/cv-inbox");
  redirect("/website/cv-inbox?import=1");
}

/** Meerdere CV's tegelijk importeren (een stapel). Namen komen uit de
 *  bestandsnaam; met AI aan worden naam/discipline/contact uit PDF's gelezen. */
export async function importCvsBulk(formData: FormData) {
  const files = formData.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
  if (files.length === 0) redirect("/website/cv-inbox/importeren?error=bestand");
  const useAi = formData.get("useAi") === "on" && isVisionConfigured();

  let created = 0;
  let skipped = 0;
  const ids: string[] = [];
  for (const file of files) {
    if (file.size > MAX_UPLOAD_BYTES || !isReadableCvName(file.name)) {
      skipped++;
      continue;
    }
    let { firstName, lastName } = nameFromCvFilename(file.name);
    let discipline: string | null = null;
    let email: string | null = null;
    let phone: string | null = null;
    let headline: string | null = null;

    if (useAi) {
      const ex = await aiExtractCvFields({
        bytes: new Uint8Array(await file.arrayBuffer()),
        name: file.name,
        mime: file.type,
      });
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
      await runCvIntakeShortlist(id);
    } catch {
      // Each failure is recorded on its own CvIntakeRun; keep processing the batch.
    }
  }

  revalidatePath("/website/cv-inbox");
  redirect(`/website/cv-inbox?import=bulk&n=${created}&skip=${skipped}`);
}

// --- Vacature-gedreven matchflow (zoekopdrachten) ----------------------------

/** "Ik zoek kandidaten": zet de vacature als actieve zoekopdracht op de
 *  CV-matches-pagina en ga er meteen naartoe. */
export async function startSourcing(formData: FormData) {
  const id = String(formData.get("vacancyId") ?? "");
  if (!id) redirect("/website/cv-inbox/matches");
  await db.vacancy.update({ where: { id }, data: { sourcing: true } });
  revalidatePath("/website/cv-inbox/matches");
  revalidatePath(`/vacatures/${id}`);
  revalidatePath("/website/vacatures");
  redirect("/website/cv-inbox/matches");
}

/**
 * Stuur een openstaande recruitment-vacature (Deal) alsnog naar de website: maakt
 * een Vacancy-concept aan via de mirror. Voor bestaande deals van vóór de auto-
 * mirror, of als de eerdere spiegeling niet doorliep. Idempotent (mirror her-checkt).
 */
export async function sendDealToWebsite(formData: FormData) {
  const dealId = String(formData.get("dealId") ?? "");
  if (!dealId) redirect("/website");
  const vacancyId = await mirrorDealToVacancy(dealId);
  // Meteen de AI-website-tekst laten schrijven, zodat de recruiter op de
  // review-pagina direct de gegenereerde tekst ziet (accepteren of aanpassen).
  // Faalt zacht: zonder AI-sleutel blijven de overgenomen velden staan.
  if (vacancyId) {
    try {
      await aiImproveVacancy(vacancyId);
    } catch {
      /* geen AI of mislukt — de recruiter kan het op de pagina zelf proberen */
    }
  }
  revalidatePath("/website");
  revalidatePath("/website/vacatures");
  // Ga direct naar de vacature om de tekst te controleren/publiceren; anders terug.
  if (vacancyId) redirect(`/vacatures/${vacancyId}`);
  redirect("/website");
}

/** Stop de zoekopdracht: haal de vacature van de CV-matches-pagina. */
export async function stopSourcing(formData: FormData) {
  const id = String(formData.get("vacancyId") ?? "");
  if (!id) return;
  await db.vacancy.update({ where: { id }, data: { sourcing: false } });
  revalidatePath("/website/cv-inbox/matches");
  revalidatePath(`/vacatures/${id}`);
  revalidatePath("/website/vacatures");
}

/** "Zoek match": doorzoek de hele kandidaten-/CV-database voor deze ene vacature
 *  (regelmatch + AI-verfijning als AI ingesteld is). Blijft op de matchpagina.
 *  Een mislukte zoekactie wordt NIET stil ingeslikt: de pagina krijgt ?error=match
 *  terug, zodat je niet naar een onveranderde lijst zit te kijken zonder te weten
 *  dat er niets is gebeurd. */
export async function searchMatchesForVacancy(formData: FormData) {
  const id = String(formData.get("vacancyId") ?? "");
  if (!id) return;
  let failed = false;
  try {
    const n = await rematchVacancy(id);
    if (isAIConfigured() && n > 0) await aiRefineMatches(id);
    await db.vacancy.update({ where: { id }, data: { lastMatchedAt: new Date(), sourcing: true } });
  } catch {
    failed = true;
  }
  revalidatePath("/website/cv-inbox/matches");
  if (failed) redirect("/website/cv-inbox/matches?error=match");
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
  revalidatePath("/website/cv-inbox/matches");
  revalidatePath("/website/cv-inbox");
  redirect("/website/cv-inbox/matches?matched=1");
}
