"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { CANDIDATE_AVAILABILITY_VALUES } from "@/lib/domain";
import { saveCvUpload, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { runCvIntakeShortlist } from "@/lib/cv-intake";
import { aiExtractCvFields, isReadableCvName, nameFromCvFilename } from "@/lib/cv-import";
import { isVisionConfigured } from "@/lib/ai";
import { mirrorDealToVacancy } from "@/lib/vacancy-mirror";
import { aiImproveVacancy } from "@/lib/recruitment";

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
