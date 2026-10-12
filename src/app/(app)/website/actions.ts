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
/** Gekozen ids: de knop zelf (`knop`: één rij of "alles", komma-gescheiden),
 *  anders de aangevinkte rijen (`id`). */
function gekozen(formData: FormData): string[] {
  const knop = String(formData.get("knop") ?? "");
  return (knop ? knop.split(",") : formData.getAll("id").map(String)).filter(Boolean);
}

/**
 * Concept → gereed: website-vacature aanmaken (indien nodig) en de AI de tekst
 * laten schrijven; die zet de status op IMPROVED (= gereed). Eén of alle tegelijk.
 * Lukt de AI niet, dan blijft de vacature in concept en melden we hoeveel.
 */
export async function naarGereed(formData: FormData) {
  const dealIds = gekozen(formData);
  const deals = await db.deal.findMany({
    where: { id: { in: dealIds }, status: "OPEN", candidateId: null },
    select: { id: true, vacancyId: true },
  });
  // ponytail: parallel binnen één request (maxDuration op de pagina); bij heel
  // veel concepten tegelijk een achtergrondjob.
  const uitkomst = await Promise.allSettled(
    deals.map(async (d) => {
      const vacancyId = d.vacancyId ?? (await mirrorDealToVacancy(d.id));
      if (!vacancyId) throw new Error("geen vacature");
      await aiImproveVacancy(vacancyId);
    }),
  );
  const mislukt = uitkomst.filter((u) => u.status === "rejected").length;
  revalidatePath("/website");
  redirect(mislukt ? `/website?tab=concept&mislukt=${mislukt}` : "/website?tab=gereed");
}

/** Gereed → online: één, de selectie of alles tegelijk live op q4s.nl. */
export async function zetOnline(formData: FormData) {
  const ids = gekozen(formData);
  const waar = { id: { in: ids }, status: { in: ["IMPROVED", "PAUSED"] as ("IMPROVED" | "PAUSED")[] } };
  if (ids.length) {
    await db.vacancy.updateMany({ where: { ...waar, publishedAt: null }, data: { publishedAt: new Date() } });
    await db.vacancy.updateMany({ where: waar, data: { status: "PUBLISHED" } });
  }
  revalidatePath("/website");
  revalidatePath("/vacatures");
  redirect("/website?tab=online");
}
