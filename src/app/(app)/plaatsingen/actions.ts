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
} from "@/lib/domain";
import { saveUpload, deleteUpload, MAX_UPLOAD_BYTES } from "@/lib/uploads";

// Placement fields WITHOUT the consultant link (resolved separately so a new
// placement can either pick an existing person or create one inline).
const PlacementCoreSchema = z.object({
  clientId: z.string().min(1, "Klant is verplicht"),
  title: z.string().min(1, "Functie is verplicht"),
  startDate: z.coerce.date({ message: "Startdatum is verplicht" }),
  endDate: z.coerce.date().optional(),
  costRate: z.coerce.number().min(0, "Inkooptarief mag niet negatief zijn"),
  chargeRate: z.coerce.number().min(0, "Verkooptarief mag niet negatief zijn"),
  // Toeslagen (%) + km-vergoeding (€/km), per side. Default 0 = geen toeslag.
  weekendSurchargeBuy: z.coerce.number().min(0).default(0),
  weekendSurchargeSell: z.coerce.number().min(0).default(0),
  overtimeSurchargeBuy: z.coerce.number().min(0).default(0),
  overtimeSurchargeSell: z.coerce.number().min(0).default(0),
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
    startDate: d.startDate,
    endDate: d.endDate ?? null,
    costRate: d.costRate,
    chargeRate: d.chargeRate,
    weekendSurchargeBuy: d.weekendSurchargeBuy,
    weekendSurchargeSell: d.weekendSurchargeSell,
    overtimeSurchargeBuy: d.overtimeSurchargeBuy,
    overtimeSurchargeSell: d.overtimeSurchargeSell,
    kmRateBuy: d.kmRateBuy,
    kmRateSell: d.kmRateSell,
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

  await db.placement.update({
    where: { id },
    data: { consultantId: parsed.data.consultantId, ...coreToData(parsed.data) },
  });
  revalidatePath("/plaatsingen");
  revalidatePath(`/plaatsingen/${id}`);
  redirect(`/plaatsingen/${id}`);
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

  revalidatePath(`/plaatsingen/${placementId}`);
  revalidatePath(`/werknemers/${d.consultantId}`);
  redirect(`/plaatsingen/${placementId}?saved=billing`);
}

export async function uploadPlacementDocument(formData: FormData) {
  const placementId = String(formData.get("placementId") ?? "");
  const consultantId = String(formData.get("consultantId") ?? "");
  const file = formData.get("file");
  if (!consultantId || !(file instanceof File) || file.size === 0) {
    redirect(`/plaatsingen/${placementId}?error=upload`);
  }
  const f = file as File;
  if (f.size > MAX_UPLOAD_BYTES) {
    redirect(`/plaatsingen/${placementId}?error=size`);
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

  revalidatePath(`/plaatsingen/${placementId}`);
  revalidatePath(`/werknemers/${consultantId}`);
  redirect(`/plaatsingen/${placementId}?saved=doc`);
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
  revalidatePath(`/plaatsingen/${placementId}`);
  redirect(`/plaatsingen/${placementId}`);
}
