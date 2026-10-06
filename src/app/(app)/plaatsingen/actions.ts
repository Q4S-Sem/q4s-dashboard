"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import {
  PLACEMENT_STATUS_VALUES,
  DOCUMENT_CATEGORY_VALUES,
  EMPLOYMENT_VALUES,
  SURCHARGE_UNIT_VALUES,
} from "@/lib/domain";
import { saveUpload, deleteUpload, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { extractDocumentMeta, extractContractRates, CvExtractError } from "@/lib/cv-extract";
import { plaatsingUitContract, type ContractTarieven, type TariefKant } from "@/lib/contract-tarieven";
import { authRequired, currentUser } from "@/lib/session";
import { syncPlaatsingStatus } from "@/lib/plaatsing-status";

// Placement fields WITHOUT the consultant link (resolved separately so a new
// placement can either pick an existing person or create one inline).
const PlacementCoreSchema = z.object({
  // Bedrijf is OPTIONEEL: een plaatsing mag (tijdelijk) zonder klant bestaan.
  // Leeg → null. De plaatsing is dan niet te factureren tot er een klant is.
  clientId: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? v.trim() : null)),
  title: z.string().min(1, "Functie is verplicht"),
  poNumber: z.string().optional().transform((v) => (v && v.trim() ? v.trim() : null)),
  workLocation: z.string().optional().transform((v) => (v && v.trim() ? v.trim() : null)),
  vatReverseCharge: z.coerce.boolean().default(false),
  startDate: z.coerce.date({ message: "Startdatum is verplicht" }),
  endDate: z.coerce.date().optional(),
  costRate: z.coerce.number().min(0, "Inkooptarief mag niet negatief zijn"),
  chargeRate: z.coerce.number().min(0, "Verkooptarief mag niet negatief zijn"),
  rateUnit: z.enum(["HOUR", "DAY"]).default("HOUR"),
  // Toeslagen (%) + km-vergoeding (€/km), per side. Default 0 = geen toeslag.
  weekendSurchargeBuy: z.coerce.number().min(0).default(0),
  weekendSurchargeSell: z.coerce.number().min(0).default(0),
  overtimeSurchargeBuy: z.coerce.number().min(0).default(0),
  overtimeSurchargeSell: z.coerce.number().min(0).default(0),
  // De zes losse toeslagen: bedrag per zijde + de schakelaar percentage/vast.
  // Offshore, ploegendienst en buitenland zijn niet uit de datums af te leiden en
  // hebben daarom een AAN/UIT-vlag; aan = over alle reguliere uren.
  weekdaySurchargeBuy: z.coerce.number().min(0).default(0),
  weekdaySurchargeSell: z.coerce.number().min(0).default(0),
  weekdaySurchargeUnit: z.enum(SURCHARGE_UNIT_VALUES).default("PCT"),
  weekdaySurchargeSellUnit: z.enum(SURCHARGE_UNIT_VALUES).default("PCT"),
  // Meeruren-treden. Leeg "vanaf" = oud gedrag (toeslag over alle ma–vr-uren).
  otFromHours: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? Number(v.replace(",", ".")) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0 && v <= 24), "Meeruren vanaf: 0 t/m 24 uur"),
  ot1Hours: z.coerce.number().min(0).max(24).default(2),
  weekday2SurchargeBuy: z.coerce.number().min(0).default(0),
  weekday2SurchargeSell: z.coerce.number().min(0).default(0),
  weekday2SurchargeUnit: z.enum(SURCHARGE_UNIT_VALUES).default("PCT"),
  weekday2SurchargeSellUnit: z.enum(SURCHARGE_UNIT_VALUES).default("PCT"),
  saturdaySurchargeBuy: z.coerce.number().min(0).default(0),
  saturdaySurchargeSell: z.coerce.number().min(0).default(0),
  saturdaySurchargeUnit: z.enum(SURCHARGE_UNIT_VALUES).default("PCT"),
  saturdaySurchargeSellUnit: z.enum(SURCHARGE_UNIT_VALUES).default("PCT"),
  sundaySurchargeBuy: z.coerce.number().min(0).default(0),
  sundaySurchargeSell: z.coerce.number().min(0).default(0),
  sundaySurchargeUnit: z.enum(SURCHARGE_UNIT_VALUES).default("PCT"),
  sundaySurchargeSellUnit: z.enum(SURCHARGE_UNIT_VALUES).default("PCT"),
  offshoreEnabled: z.coerce.boolean().default(false),
  offshoreSurchargeBuy: z.coerce.number().min(0).default(0),
  offshoreSurchargeSell: z.coerce.number().min(0).default(0),
  offshoreSurchargeUnit: z.enum(SURCHARGE_UNIT_VALUES).default("PCT"),
  offshoreSurchargeSellUnit: z.enum(SURCHARGE_UNIT_VALUES).default("PCT"),
  shiftEnabled: z.coerce.boolean().default(false),
  shiftSurchargeBuy: z.coerce.number().min(0).default(0),
  shiftSurchargeSell: z.coerce.number().min(0).default(0),
  shiftSurchargeUnit: z.enum(SURCHARGE_UNIT_VALUES).default("PCT"),
  shiftSurchargeSellUnit: z.enum(SURCHARGE_UNIT_VALUES).default("PCT"),
  abroadEnabled: z.coerce.boolean().default(false),
  abroadSurchargeBuy: z.coerce.number().min(0).default(0),
  abroadSurchargeSell: z.coerce.number().min(0).default(0),
  abroadSurchargeUnit: z.enum(SURCHARGE_UNIT_VALUES).default("PCT"),
  abroadSurchargeSellUnit: z.enum(SURCHARGE_UNIT_VALUES).default("PCT"),
  // Expliciet overuren-uurtarief (€/u), los van het percentage. Leeg → null =
  // val terug op de normale rate (geen uplift, geen margeverlies).
  overtimeCostRate: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? Number(v.replace(",", ".")) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Overuren-inkoop mag niet negatief zijn"),
  overtimeChargeRate: z
    .string()
    .optional()
    .transform((v) => (v && v.trim() !== "" ? Number(v.replace(",", ".")) : null))
    .refine((v) => v === null || (Number.isFinite(v) && v >= 0), "Overuren-verkoop mag niet negatief zijn"),
  kmRateBuy: z.coerce.number().min(0).default(0),
  kmRateSell: z.coerce.number().min(0).default(0),
  status: z.enum(PLACEMENT_STATUS_VALUES).default("ACTIVE"),
  notes: z.string().optional(),
});

const PlacementSchema = PlacementCoreSchema.extend({
  consultantId: z.string().min(1, "Werknemer is verplicht"),
});

// A new person created inline from the "Nieuwe plaatsing" flow.
const NewPersonSchema = z.object({
  firstName: z.string().min(1, "Voornaam is verplicht"),
  lastName: z.string().min(1, "Achternaam is verplicht"),
  discipline: z.string().min(1, "Discipline is verplicht"),
  employmentType: z.enum(EMPLOYMENT_VALUES).default("ZZP"),
  dateOfBirth: z.coerce.date().optional(),
  email: z.string().email("Ongeldig e-mailadres").optional(),
  phone: z.string().optional(),
  bsn: z.string().optional(),
  nationality: z.string().optional(),
  // ZZP-/bedrijfsgegevens (de ZZP'er is zijn eigen bedrijf) — voor de inkoop-
  // factuur en de betaling.
  companyName: z.string().optional(),
  kvkNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  iban: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
});

// Core placement DB payload (without consultantId), undefined optionals → null.
function coreToData(d: z.infer<typeof PlacementCoreSchema>) {
  return {
    clientId: d.clientId,
    title: d.title,
    poNumber: d.poNumber,
    workLocation: d.workLocation,
    vatReverseCharge: d.vatReverseCharge,
    startDate: d.startDate,
    endDate: d.endDate ?? null,
    costRate: d.costRate,
    chargeRate: d.chargeRate,
    rateUnit: d.rateUnit,
    weekendSurchargeBuy: d.weekendSurchargeBuy,
    weekendSurchargeSell: d.weekendSurchargeSell,
    overtimeSurchargeBuy: d.overtimeSurchargeBuy,
    overtimeSurchargeSell: d.overtimeSurchargeSell,
    overtimeCostRate: d.overtimeCostRate,
    overtimeChargeRate: d.overtimeChargeRate,
    kmRateBuy: d.kmRateBuy,
    kmRateSell: d.kmRateSell,
    weekdaySurchargeBuy: d.weekdaySurchargeBuy,
    weekdaySurchargeSell: d.weekdaySurchargeSell,
    weekdaySurchargeUnit: d.weekdaySurchargeUnit,
    weekdaySurchargeSellUnit: d.weekdaySurchargeSellUnit,
    otFromHours: d.otFromHours,
    ot1Hours: d.ot1Hours,
    // Zonder "meeruren vanaf" geen meeruren-toeslag — anders zou de oude regel
    // (toeslag over ÁLLE ma–vr-uren) ongemerkt gaan gelden.
    ...(d.otFromHours == null ? { weekdaySurchargeBuy: 0, weekdaySurchargeSell: 0 } : {}),
    weekday2SurchargeBuy: d.otFromHours == null ? 0 : d.weekday2SurchargeBuy,
    weekday2SurchargeSell: d.otFromHours == null ? 0 : d.weekday2SurchargeSell,
    weekday2SurchargeUnit: d.weekday2SurchargeUnit,
    weekday2SurchargeSellUnit: d.weekday2SurchargeSellUnit,
    saturdaySurchargeBuy: d.saturdaySurchargeBuy,
    saturdaySurchargeSell: d.saturdaySurchargeSell,
    saturdaySurchargeUnit: d.saturdaySurchargeUnit,
    saturdaySurchargeSellUnit: d.saturdaySurchargeSellUnit,
    sundaySurchargeBuy: d.sundaySurchargeBuy,
    sundaySurchargeSell: d.sundaySurchargeSell,
    sundaySurchargeUnit: d.sundaySurchargeUnit,
    sundaySurchargeSellUnit: d.sundaySurchargeSellUnit,
    offshoreEnabled: d.offshoreEnabled,
    offshoreSurchargeBuy: d.offshoreSurchargeBuy,
    offshoreSurchargeSell: d.offshoreSurchargeSell,
    offshoreSurchargeUnit: d.offshoreSurchargeUnit,
    offshoreSurchargeSellUnit: d.offshoreSurchargeSellUnit,
    shiftEnabled: d.shiftEnabled,
    shiftSurchargeBuy: d.shiftSurchargeBuy,
    shiftSurchargeSell: d.shiftSurchargeSell,
    shiftSurchargeUnit: d.shiftSurchargeUnit,
    shiftSurchargeSellUnit: d.shiftSurchargeSellUnit,
    abroadEnabled: d.abroadEnabled,
    abroadSurchargeBuy: d.abroadSurchargeBuy,
    abroadSurchargeSell: d.abroadSurchargeSell,
    abroadSurchargeUnit: d.abroadSurchargeUnit,
    abroadSurchargeSellUnit: d.abroadSurchargeSellUnit,
    status: d.status,
    notes: d.notes ?? null,
  };
}

/** Optional CV / contract / diploma uploads from the new-person form. */
function collectPersonDocs(formData: FormData) {
  const docs: { file: File; category: string; title: string }[] = [];
  const cv = formData.get("cvFile");
  if (cv instanceof File && cv.size > 0) docs.push({ file: cv, category: "CV", title: "CV" });
  const contract = formData.get("contractFile");
  if (contract instanceof File && contract.size > 0)
    docs.push({ file: contract, category: "CONTRACT", title: "Contract" });
  for (const d of formData.getAll("diplomaFiles")) {
    if (d instanceof File && d.size > 0)
      docs.push({ file: d, category: "CERTIFICAAT", title: d.name });
  }
  return docs;
}

export async function createPlacement(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const personMode = String(formData.get("personMode") ?? "existing");
  // Wordt deze plaatsing vanuit een concept afgemaakt? Dan wissen we dat concept
  // na een geslaagde aanmaak.
  const draftId = String(formData.get("draftId") ?? "").trim() || null;

  // Validate the placement fields first — never create an orphan person on a
  // bad form.
  const core = parseForm(PlacementCoreSchema, formData);
  if (!core.success) return core.state;

  // ---- Existing person: just create the placement. ----
  if (personMode !== "new") {
    const consultantId = String(formData.get("consultantId") ?? "");
    if (!consultantId) return { fieldErrors: { consultantId: "Kies een werknemer." } };
    const created = await db.placement.create({
      data: { consultantId, ...coreToData(core.data) },
    });
    await syncPlaatsingStatus({ id: created.id });
    if (draftId) await db.placementDraft.delete({ where: { id: draftId } }).catch(() => {});
    revalidatePath("/plaatsingen");
    redirect(`/plaatsingen/${created.id}`);
  }

  // ---- New person: create the consultant + placement atomically, then docs. ----
  const person = parseForm(NewPersonSchema, formData);
  if (!person.success) return person.state;

  const docs = collectPersonDocs(formData);
  if (docs.some((d) => d.file.size > MAX_UPLOAD_BYTES)) {
    return { error: "Een geüpload bestand is te groot (max. 15 MB)." };
  }

  const p = person.data;
  let result: { consultantId: string; placementId: string };
  try {
    result = await db.$transaction(async (tx) => {
      const consultant = await tx.consultant.create({
        data: {
          firstName: p.firstName,
          lastName: p.lastName,
          discipline: p.discipline,
          employmentType: p.employmentType,
          dateOfBirth: p.dateOfBirth ?? null,
          email: p.email ?? null,
          phone: p.phone ?? null,
          bsn: p.bsn ?? null,
          nationality: p.nationality ?? null,
          companyName: p.companyName ?? null,
          kvkNumber: p.kvkNumber ?? null,
          vatNumber: p.vatNumber ?? null,
          iban: p.iban ?? null,
          address: p.address ?? null,
          postalCode: p.postalCode ?? null,
          city: p.city ?? null,
        },
      });
      const placement = await tx.placement.create({
        data: { consultantId: consultant.id, ...coreToData(core.data) },
      });
      return { consultantId: consultant.id, placementId: placement.id };
    });
  } catch {
    return {
      error: "Aanmaken mislukt — dit e-mailadres is mogelijk al in gebruik.",
    };
  }

  // Documenten/certificaten best-effort na commit. Certificaten gaan direct naar
  // het Certificate-model, zodat ze meteen in de certificeringslijst staan — één
  // bron, geen dubbel werk (CV/contract blijven gewone documenten).
  for (const doc of docs) {
    const fileName = await saveUpload(result.consultantId, doc.file);
    if (doc.category === "CERTIFICAAT") {
      await db.certificate.create({
        data: {
          consultantId: result.consultantId,
          name: doc.title || doc.file.name,
          fileName,
          originalName: doc.file.name,
          mimeType: doc.file.type || "application/octet-stream",
          fileSize: doc.file.size,
        },
      });
    } else {
      await db.document.create({
        data: {
          consultantId: result.consultantId,
          category: doc.category,
          title: doc.title || doc.file.name,
          fileName,
          originalName: doc.file.name,
          mimeType: doc.file.type || "application/octet-stream",
          size: doc.file.size,
        },
      });
    }
  }

  await syncPlaatsingStatus({ id: result.placementId });
  if (draftId) await db.placementDraft.delete({ where: { id: draftId } }).catch(() => {});
  revalidatePath("/plaatsingen");
  revalidatePath("/werknemers");
  revalidatePath("/certificeringen");
  redirect(`/plaatsingen/${result.placementId}?new=1`);
}

// ---------------------------------------------------------------------------
// Concept-plaatsingen (drafts): bewaar een half ingevuld formulier om later af
// te maken; verschijnt bovenaan op /plaatsingen.
// ---------------------------------------------------------------------------

export async function savePlacementDraft(formData: FormData) {
  // Alle ingevulde tekstvelden verzamelen (bestanden overslaan).
  const data: Record<string, string> = {};
  for (const [k, v] of formData.entries()) {
    if (typeof v !== "string" || k === "draftId") continue;
    if (v.trim() !== "") data[k] = v;
  }

  // Herkenbaar label: werknemer + klant (+ functie).
  let personLabel = [String(formData.get("firstName") ?? ""), String(formData.get("lastName") ?? "")]
    .filter(Boolean)
    .join(" ")
    .trim();
  const consultantId = String(formData.get("consultantId") ?? "").trim();
  if (!personLabel && consultantId) {
    const c = await db.consultant.findUnique({
      where: { id: consultantId },
      select: { firstName: true, lastName: true },
    });
    if (c) personLabel = `${c.firstName} ${c.lastName}`;
  }
  let clientLabel = "";
  const clientId = String(formData.get("clientId") ?? "").trim();
  if (clientId) {
    const cl = await db.client.findUnique({ where: { id: clientId }, select: { companyName: true } });
    clientLabel = cl?.companyName ?? "";
  }
  const title = String(formData.get("title") ?? "").trim();
  const label =
    [personLabel || "Nieuwe werknemer", clientLabel].filter(Boolean).join(" · ") +
    (title ? ` — ${title}` : "");

  const json = JSON.stringify(data);
  const existingId = String(formData.get("draftId") ?? "").trim() || null;
  if (existingId) {
    const ok = await db.placementDraft
      .update({ where: { id: existingId }, data: { data: json, label } })
      .then(() => true)
      .catch(() => false);
    if (!ok) await db.placementDraft.create({ data: { data: json, label } });
  } else {
    await db.placementDraft.create({ data: { data: json, label } });
  }
  revalidatePath("/plaatsingen");
  redirect("/plaatsingen?concept=1");
}

export async function deletePlacementDraft(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (id) await db.placementDraft.delete({ where: { id } }).catch(() => {});
  revalidatePath("/plaatsingen");
  redirect("/plaatsingen");
}

export async function updatePlacement(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Onbekende plaatsing." };

  const parsed = parseForm(PlacementSchema, formData);
  if (!parsed.success) return parsed.state;

  // Factuur- & betaalgegevens van de (oorspronkelijke) werknemer, als ze meekwamen.
  const billId = String(formData.get("bill_consultantId") ?? "");
  if (billId) {
    const v = (k: string) => String(formData.get(`bill_${k}`) ?? "").trim() || null;
    const email = v("email");
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { fieldErrors: { bill_email: "Ongeldig e-mailadres" }, error: "Controleer het e-mailadres bij de factuurgegevens." };
    }
    try {
      await db.consultant.update({
        where: { id: billId },
        data: {
          companyName: v("companyName"),
          iban: v("iban"),
          kvkNumber: v("kvkNumber"),
          vatNumber: v("vatNumber"),
          email,
          phone: v("phone"),
          address: v("address"),
          postalCode: v("postalCode"),
          city: v("city"),
        },
      });
    } catch {
      return { error: "Factuurgegevens opslaan mislukt — dit e-mailadres is mogelijk al in gebruik." };
    }
    revalidatePath(`/werknemers/${billId}`);
  }

  await db.placement.update({
    where: { id },
    data: { consultantId: parsed.data.consultantId, ...coreToData(parsed.data) },
  });
  await syncPlaatsingStatus({ id });
  if (billId && billId !== parsed.data.consultantId) await syncPlaatsingStatus({ consultantId: billId });
  revalidatePath("/plaatsingen");
  revalidatePath(`/plaatsingen/${id}`);
  redirect(`/plaatsingen/${id}`);
}

/**
 * Uit dienst: plaatsing naar het archief. Niets wordt verwijderd — de plaatsing
 * blijft compleet (tarieven, documenten, urenstaten) en de werknemer gaat op
 * inactief als hij geen andere actieve plaatsing heeft.
 */
export async function archivePlacement(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const p = await db.placement.findUnique({ where: { id }, select: { consultantId: true, endDate: true } });
  if (!p) return;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  await db.placement.update({
    where: { id },
    data: { status: "ARCHIVED", endDate: p.endDate ?? today },
  });
  const nogActief = await db.placement.count({
    where: { consultantId: p.consultantId, status: { in: ["ACTIVE", "INCOMPLETE"] } },
  });
  if (nogActief === 0) await db.consultant.update({ where: { id: p.consultantId }, data: { active: false } });
  revalidatePath("/plaatsingen");
  revalidatePath("/archief");
  redirect("/plaatsingen?gearchiveerd=1");
}

/**
 * Weer in dienst: plaatsing terug naar actief met alle oude gegevens. De
 * einddatum gaat leeg; start/einddatum pas je daarna aan via Bewerken.
 */
export async function restorePlacement(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const p = await db.placement.update({
    where: { id },
    data: { status: "ACTIVE", endDate: null },
    select: { consultantId: true },
  });
  await syncPlaatsingStatus({ id });
  await db.consultant.update({ where: { id: p.consultantId }, data: { active: true } });
  revalidatePath("/plaatsingen");
  revalidatePath("/archief");
  redirect(`/plaatsingen/${id}/bewerken?teruggezet=1`);
}

export async function deletePlacement(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await db.placement.delete({ where: { id } });
  } catch {
    // Likely has timesheets attached (onDelete: Cascade is on timesheets,
    // but invoice lines reference it via SetNull); guard anyway.
    redirect(`/plaatsingen/${id}?error=in-use`);
  }
  revalidatePath("/plaatsingen");
  redirect("/plaatsingen");
}

// ---------- Werknemer-gegevens & contract vanuit de plaatsing ----------
// These edit the linked CONSULTANT (shared across that person's placements):
// the billing details needed for the self-billing inkoopfactuur, and the
// contract/documents. Kept separate from updateConsultant so a focused form
// can't accidentally clobber required fields (firstName/discipline) or the
// `active` flag.

const BillingSchema = z.object({
  consultantId: z.string().min(1),
  companyName: z.string().optional(),
  kvkNumber: z.string().optional(),
  vatNumber: z.string().optional(),
  iban: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  email: z.string().email("Ongeldig e-mailadres").optional(),
  phone: z.string().optional(),
});

export async function updatePlacementBilling(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const placementId = String(formData.get("placementId") ?? "");
  const parsed = parseForm(BillingSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;

  try {
    await db.consultant.update({
      where: { id: d.consultantId },
      data: {
        companyName: d.companyName ?? null,
        kvkNumber: d.kvkNumber ?? null,
        vatNumber: d.vatNumber ?? null,
        iban: d.iban ?? null,
        address: d.address ?? null,
        postalCode: d.postalCode ?? null,
        city: d.city ?? null,
        email: d.email ?? null,
        phone: d.phone ?? null,
      },
    });
  } catch {
    return {
      error: "Opslaan mislukt — dit e-mailadres is mogelijk al in gebruik.",
    };
  }

  await syncPlaatsingStatus({ consultantId: d.consultantId });
  revalidatePath("/plaatsingen");
  revalidatePath(`/plaatsingen/${placementId}`);
  revalidatePath(`/werknemers/${d.consultantId}`);
  redirect(`/plaatsingen/${placementId}?saved=billing`);
}

export async function uploadPlacementDocument(formData: FormData) {
  const placementId = String(formData.get("placementId") ?? "");
  const consultantId = String(formData.get("consultantId") ?? "");
  const file = formData.get("file");
  if (!consultantId || !(file instanceof File) || file.size === 0) {
    redirect(`/plaatsingen/${placementId}/documenten?error=upload`);
  }
  const f = file as File;
  if (f.size > MAX_UPLOAD_BYTES) {
    redirect(`/plaatsingen/${placementId}/documenten?error=size`);
  }

  const categoryRaw = String(formData.get("category") ?? "CONTRACT");
  const category = (DOCUMENT_CATEGORY_VALUES as readonly string[]).includes(
    categoryRaw,
  )
    ? categoryRaw
    : "OVERIG";
  const title = String(formData.get("title") ?? "").trim() || f.name;

  const fileName = await saveUpload(consultantId, f);
  if (category === "CERTIFICAAT") {
    // Certificaat vanaf de plaatsing → direct in het Certificate-model, zodat het
    // meteen in de certificeringslijst verschijnt (geen dubbel werk).
    await db.certificate.create({
      data: {
        consultantId,
        name: title,
        fileName,
        originalName: f.name,
        mimeType: f.type || "application/octet-stream",
        fileSize: f.size,
      },
    });
    revalidatePath("/certificeringen");
    revalidatePath(`/certificeringen/${consultantId}`);
  } else {
    await db.document.create({
      data: {
        consultantId,
        category,
        title,
        fileName,
        originalName: f.name,
        mimeType: f.type || "application/octet-stream",
        size: f.size,
      },
    });
  }

  revalidatePath(`/plaatsingen/${placementId}/documenten`);
  revalidatePath(`/werknemers/${consultantId}`);
  redirect(`/plaatsingen/${placementId}/documenten?saved=doc`);
}

export async function deletePlacementDocument(formData: FormData) {
  const placementId = String(formData.get("placementId") ?? "");
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const doc = await db.document.findUnique({ where: { id } });
  if (doc) {
    await deleteUpload(doc.consultantId, doc.fileName);
    await db.document.delete({ where: { id } });
    revalidatePath(`/werknemers/${doc.consultantId}`);
  }
  revalidatePath(`/plaatsingen/${placementId}/documenten`);
  redirect(`/plaatsingen/${placementId}/documenten`);
}

// ---- Vaste notitie bij de plaatsing (tabblad Notities) ----

export async function savePlacementNotes(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  await db.placement.update({
    where: { id },
    data: { notes: String(formData.get("notes") ?? "").trim() || null },
  });
  revalidatePath(`/plaatsingen/${id}`);
  revalidatePath(`/plaatsingen/${id}/notities`);
  redirect(`/plaatsingen/${id}/notities?saved=1`);
}

/**
 * Leest een geüpload document en stelt automatisch een SOORT + TITEL voor
 * (client roept dit aan zodra een bestand in de Dropzone valt). Faalt de AI of is
 * die niet geconfigureerd, dan geeft het een nette terugval terug (OVERIG + de
 * bestandsnaam zonder extensie), zodat uploaden altijd blijft werken.
 */
export type DocMetaResult =
  | { ok: true; category: string; title: string }
  | { ok: false; category: string; title: string; error: string };

export async function readDocumentMeta(formData: FormData): Promise<DocMetaResult> {
  const file = formData.get("file");
  const fallbackTitle = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, category: "OVERIG", title: "", error: "Geen bestand ontvangen." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, category: "OVERIG", title: fallbackTitle(file.name), error: "Dit bestand is te groot." };
  }
  try {
    const bytes = Buffer.from(await file.arrayBuffer());
    const meta = await extractDocumentMeta(bytes, file.name, file.type || "");
    return { ok: true, category: meta.category, title: meta.title || fallbackTitle(file.name) };
  } catch (err) {
    const msg = err instanceof CvExtractError ? err.message : "Automatisch herkennen lukte niet — kies de soort zelf.";
    return { ok: false, category: "OVERIG", title: fallbackTitle(file.name), error: msg };
  }
}

// ---------------------------------------------------------------------------
// Tarieven uit het contract overnemen (plaatsing → Contracten-tab).
// Uitlezen slaat NIETS op; pas "Overnemen" (een expliciete knop) zet de
// tarieven op de plaatsing. De omrekening is plaatsingUitContract (getest).
// ---------------------------------------------------------------------------

export type ContractTariefVoorstel =
  | { ok: true; tarieven: ContractTarieven; regels: string[]; naam: string }
  | { ok: false; error: string };

/** Lees een geüpload contract (PDF/Word/foto) en laat zien wat er zou veranderen. */
export async function leesContractTarieven(formData: FormData): Promise<ContractTariefVoorstel> {
  if (authRequired() && !(await currentUser())) return { ok: false, error: "Niet ingelogd." };
  const file = formData.get("file");
  const kant: TariefKant = formData.get("kant") === "verkoop" ? "verkoop" : "inkoop";
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Geen bestand ontvangen." };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "Dit bestand is te groot (max. 15 MB)." };
  try {
    const r = await extractContractRates(Buffer.from(await file.arrayBuffer()), file.name, file.type || "");
    const { regels } = plaatsingUitContract(r, kant);
    if (regels.length === 0) return { ok: false, error: "Er zijn geen tarieven in dit contract gevonden." };
    return { ok: true, tarieven: r, regels, naam: r.contractorName };
  } catch (err) {
    if (err instanceof CvExtractError) return { ok: false, error: err.message };
    console.error("leesContractTarieven mislukt:", err);
    return { ok: false, error: "Het contract kon niet uitgelezen worden. Probeer het opnieuw." };
  }
}

const tariefVeld = z.string().max(80).optional();
const TarievenSchema = z.object({
  rateDay: tariefVeld, rateDayFixed: tariefVeld, rateOvertime: tariefVeld, rateSaturday: tariefVeld,
  rateSunday: tariefVeld, rateShift: tariefVeld, rateOffshore: tariefVeld, kmRate: tariefVeld,
  startDate: tariefVeld, endDate: tariefVeld,
});

/**
 * Zet de tarieven op de plaatsing — de knop "Overnemen". Bron is óf een
 * contract in het dashboard (contractId, server leest het zelf), óf het
 * voorstel uit een geüpload bestand (tarieven-JSON, opnieuw gevalideerd).
 */
export async function neemContractTarievenOver(formData: FormData): Promise<void> {
  if (authRequired() && !(await currentUser())) redirect("/login");
  const placementId = String(formData.get("placementId") ?? "");
  const kant: TariefKant = formData.get("kant") === "verkoop" ? "verkoop" : "inkoop";
  const contractId = String(formData.get("contractId") ?? "");
  let tarieven: ContractTarieven | null = null;
  if (contractId) {
    const c = await db.contract.findUnique({ where: { id: contractId } });
    if (c) {
      const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");
      tarieven = { ...c, startDate: iso(c.startDate), endDate: iso(c.endDate) };
    }
  } else {
    let json: unknown = null;
    try {
      json = JSON.parse(String(formData.get("tarieven") ?? ""));
    } catch {
      json = null;
    }
    const parsed = TarievenSchema.safeParse(json);
    if (parsed.success) tarieven = parsed.data;
  }
  if (!placementId || !tarieven) redirect(`/plaatsingen/${placementId}/contracten?tarieven=fout`);
  const { data } = plaatsingUitContract(tarieven, kant);
  if (Object.keys(data).length > 0) {
    await db.placement.update({ where: { id: placementId }, data });
    await syncPlaatsingStatus({ id: placementId });
  }
  revalidatePath("/plaatsingen");
  revalidatePath(`/plaatsingen/${placementId}`, "layout");
  redirect(`/plaatsingen/${placementId}/tarieven?overgenomen=1`);
}
