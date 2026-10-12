"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { CONTRACT_STATUS_VALUES } from "@/lib/domain";
import { ontbrekendeContractVelden } from "@/lib/contract-check";
import { saveUpload, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { maakPakket } from "@/lib/pakket";

/**
 * Server actions voor de Contracten-hub (Overeenkomst van opdracht).
 *
 * Alleen de VARIABELE velden komen hier binnen; de vaste juridische tekst zit in
 * de renderer (contract-doc.ts / ContractVel.tsx). Een contract hangt altijd aan
 * nieuw persoon: de gegevens staan op het contract zelf (geen koppeling met
 * werknemers of plaatsingen; bestaande koppelingen blijven ongemoeid bij bijwerken).
 */

const optional = z.string().optional().transform((v) => (v && v.trim() ? v.trim() : ""));
const optionalNull = z.string().optional().transform((v) => (v && v.trim() ? v.trim() : null));

const ContractSchema = z.object({
  number: optionalNull,

  contractorName: z.string().min(1, "Naam opdrachtnemer is verplicht"),
  contractorAddress: optional,
  contractorKvk: optional,
  contractorVat: optional,
  contractorIban: optional,

  fieldOfWork: optional,
  serviceNeed: optional,
  thirdParty: optional,
  workDescription: optional,

  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  projectDuration: optional,
  noticePeriod: optional,

  rateDay: optional,
  rateShift: optional,
  rateSaturday: optional,
  rateSunday: optional,
  rateOffshore: optional,
  rateOvertime: optional,
  overtimeApplies: optional,
  rateDayFixed: optional,
  overtimeShift: optional,
  overtimeSaturday: optional,
  overtimeSunday: optional,
  overtimeOffshore: optional,
  dayFixedShift: optional,
  dayFixedSaturday: optional,
  dayFixedSunday: optional,
  dayFixedOffshore: optional,
  dayBasedOnHours: optional,
  kmRate: optional,
  invoiceEmail: optional,
  paymentTermDays: z.coerce.number().int().min(0).default(30),

  insuranceCover: optional,

  signerClient: optional,
  signPlaceClient: optional,
  signerContractor: optional,
  signPlaceContractor: optional,
  signDate: z.coerce.date().optional(),

  status: z.enum(CONTRACT_STATUS_VALUES).default("DRAFT"),
  notes: optionalNull,
  // Koppeling met persoon/plaatsing (nieuw contract vanuit Contracten/plaatsing).
  consultantId: optionalNull,
  placementId: optionalNull,
});

/** Checkbox-velden leest Zod niet betrouwbaar; direct uit FormData ("on"). */
function readFlags(formData: FormData) {
  return {
    vatReverseCharge: formData.get("vatReverseCharge") === "on",
    includeConfidentiality: formData.get("includeConfidentiality") === "on",
    includeGdpr: formData.get("includeGdpr") === "on",
    includeIp: formData.get("includeIp") === "on",
  };
}

/** Definitief/Getekend mag alleen als alles erin staat — zo gaat er nooit een half contract de deur uit. */
function blokkeerOnvolledig(d: z.infer<typeof ContractSchema>): FormState | null {
  if (d.status === "DRAFT") return null;
  const mist = ontbrekendeContractVelden(d);
  if (!mist.length) return null;
  return {
    error: `Dit contract kan nog niet op "Definitief" of "Getekend": er ontbreekt nog ${mist.join(", ")}. Vul dit aan, of sla het op als Concept.`,
  };
}

/** Vul lege optionele string-velden met de sjabloon-defaults. */
function withDefaults(data: z.infer<typeof ContractSchema>) {
  return {
    noticePeriod: data.noticePeriod || "twee (2) weken",
    invoiceEmail: data.invoiceEmail || "admin@q4s.nl",
    insuranceCover: data.insuranceCover || "€ 2.500.000,-",
    signerClient: data.signerClient || "P. Boomsma",
    signPlaceClient: data.signPlaceClient || "Rotterdam",
  };
}

/** Alle contractvelden voor create/update (één plek). */
function contractData(d: z.infer<typeof ContractSchema>, flags: ReturnType<typeof readFlags>) {
  return {
    number: d.number,
    contractorName: d.contractorName,
    contractorAddress: d.contractorAddress,
    contractorKvk: d.contractorKvk,
    contractorVat: d.contractorVat,
    contractorIban: d.contractorIban,
    fieldOfWork: d.fieldOfWork,
    serviceNeed: d.serviceNeed,
    thirdParty: d.thirdParty,
    workDescription: d.workDescription,
    startDate: d.startDate ?? null,
    endDate: d.endDate ?? null,
    projectDuration: d.projectDuration,
    rateDay: d.rateDay,
    rateShift: d.rateShift,
    rateSaturday: d.rateSaturday,
    rateSunday: d.rateSunday,
    rateOffshore: d.rateOffshore,
    rateOvertime: d.rateOvertime,
    overtimeApplies: d.overtimeApplies,
    rateDayFixed: d.rateDayFixed,
    overtimeShift: d.overtimeShift,
    overtimeSaturday: d.overtimeSaturday,
    overtimeSunday: d.overtimeSunday,
    overtimeOffshore: d.overtimeOffshore,
    dayFixedShift: d.dayFixedShift,
    dayFixedSaturday: d.dayFixedSaturday,
    dayFixedSunday: d.dayFixedSunday,
    dayFixedOffshore: d.dayFixedOffshore,
    dayBasedOnHours: d.dayBasedOnHours,
    kmRate: d.kmRate,
    paymentTermDays: d.paymentTermDays,
    signerContractor: d.signerContractor,
    signPlaceContractor: d.signPlaceContractor,
    signDate: d.signDate ?? null,
    status: d.status,
    notes: d.notes,
    // Alleen zetten als meegestuurd: bijwerken laat een bestaande koppeling staan.
    ...(d.consultantId ? { consultantId: d.consultantId } : {}),
    ...(d.placementId ? { placementId: d.placementId } : {}),
    ...withDefaults(d),
    ...flags,
  };
}

export async function createContract(_prev: FormState, formData: FormData): Promise<FormState> {
  // Al automatisch bewaard (heeft een id)? Dan is dit gewoon bijwerken.
  if (formData.get("id")) return updateContract(_prev, formData);
  const parsed = parseForm(ContractSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;
  // Knoppen in de balk: "Opslaan als concept" / "Klaar" bepalen de status.
  const als = formData.get("opslaanAls");
  if (als === "concept") d.status = "DRAFT";
  else if (als === "klaar" && d.status === "DRAFT") d.status = "FINAL";
  const flags = readFlags(formData);
  const blok = blokkeerOnvolledig(d);
  if (blok) return blok;

  try {
    await db.contract.create({
      data: contractData(d, flags),
      select: { id: true },
    });
  } catch {
    return { error: "Contract kon niet worden opgeslagen. Controleer de velden en probeer opnieuw." };
  }

  revalidatePath("/contracten");
  revalidatePath("/contracten/nieuw");
  redirect(`/contracten/nieuw?map=${d.status === "DRAFT" ? "concepten" : "klaar"}`);
}

export async function updateContract(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Ontbrekend contract-id." };

  const parsed = parseForm(ContractSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;
  // Knoppen in de balk: "Opslaan als concept" / "Klaar" bepalen de status.
  const als = formData.get("opslaanAls");
  if (als === "concept") d.status = "DRAFT";
  else if (als === "klaar" && d.status === "DRAFT") d.status = "FINAL";
  const flags = readFlags(formData);
  const blok = blokkeerOnvolledig(d);
  if (blok) return blok;

  try {
    await db.contract.update({
      where: { id },
      data: contractData(d, flags),
    });
  } catch {
    return { error: "Contract kon niet worden bijgewerkt." };
  }

  revalidatePath("/contracten");
  revalidatePath(`/contracten/${id}`);
  redirect(`/contracten/${id}?opgeslagen`);
}

export async function deleteContract(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await db.contract.delete({ where: { id } });
  } catch {
    redirect(`/contracten/${id}?error=verwijderen`);
  }
  revalidatePath("/contracten");
  revalidatePath("/contracten/nieuw");
  // Terug naar "+ Nieuw contract" (daar staan de concepten en klare contracten).
  redirect("/contracten/nieuw");
}

/** Offerte/arbeidsovereenkomst opslaan (nieuw of bijwerken). Geeft het id terug. */
export async function bewaarDoc(soort: string, id: string | null, waarden: Record<string, string>, klaar?: boolean): Promise<{ id: string } | { error: string }> {
  if (soort !== "offerte" && soort !== "arbeidsovereenkomst") return { error: "Onbekend document." };
  const schoon = Object.fromEntries(Object.entries(waarden).filter(([k, v]) => typeof k === "string" && typeof v === "string").map(([k, v]) => [k.slice(0, 80), v.slice(0, 5000)]));
  const label = (soort === "offerte" ? [schoon.to, schoon.subject] : [schoon.naam, schoon.functie]).filter(Boolean).join(" — ").slice(0, 200);
  const data = JSON.stringify(schoon);
  // klaar undefined (automatisch bewaren): status van een bestaand document niet aanraken.
  let status: string | undefined = klaar === undefined ? undefined : klaar ? "READY" : "DRAFT";
  // Verstuurd/getekend document: bewerken mag, maar de status niet terugzetten.
  if (id && status) {
    const nu = await db.docConcept.findUnique({ where: { id }, select: { status: true } });
    if (nu && (nu.status === "SENT" || nu.status === "SIGNED")) status = undefined;
  }
  try {
    const doc = id
      ? await db.docConcept.update({ where: { id }, data: { label, data, status }, select: { id: true } })
      : await db.docConcept.create({ data: { soort, label, data, status: status ?? "DRAFT" }, select: { id: true } });
    revalidatePath("/contracten/nieuw");
    return doc;
  } catch {
    return { error: "Opslaan mislukt — probeer het opnieuw." };
  }
}

export async function verwijderDoc(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  if (id) await db.docConcept.deleteMany({ where: { id } });
  revalidatePath("/contracten/nieuw");
}

/**
 * Automatisch tussentijds bewaren (elke halve seconde na typen). Nieuw → als
 * Concept aangemaakt; bestaand → bijgewerkt met de status uit het formulier.
 * Geeft null als het (nog) niet kan, bv. definitief zonder verplichte velden.
 */
export async function bewaarContractConcept(formData: FormData): Promise<{ id: string } | null> {
  const id = String(formData.get("id") ?? "");
  if (!id) formData.set("status", "DRAFT");
  if (!String(formData.get("contractorName") ?? "").trim()) formData.set("contractorName", "Naamloos");
  const parsed = parseForm(ContractSchema, formData);
  if (!parsed.success || blokkeerOnvolledig(parsed.data)) return null;
  const data = contractData(parsed.data, readFlags(formData));
  try {
    const c = id
      ? await db.contract.update({ where: { id }, data, select: { id: true } })
      : await db.contract.create({ data, select: { id: true } });
    return c;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Verstuurd → wacht op handtekening → getekend terug (pakket in het dossier).
// Versturen doe je zelf (mail/Outlook); hier zet je alleen de stap.
// ---------------------------------------------------------------------------

export async function markeerVerstuurd(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const soort = String(formData.get("soort") ?? "");
  const data = { status: "SENT", sentAt: new Date() };
  if (soort === "contract") await db.contract.updateMany({ where: { id }, data });
  else await db.docConcept.updateMany({ where: { id }, data });
  revalidatePath("/contracten/nieuw");
  revalidatePath("/contracten");
  redirect("/contracten/nieuw?map=wacht");
}

/** Terug naar "klaar om te versturen" (per ongeluk op verstuurd gezet). */
export async function terugNaarKlaar(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const soort = String(formData.get("soort") ?? "");
  if (soort === "contract") await db.contract.updateMany({ where: { id, status: "SENT" }, data: { status: "FINAL", sentAt: null } });
  else await db.docConcept.updateMany({ where: { id, status: "SENT" }, data: { status: "READY", sentAt: null } });
  revalidatePath("/contracten/nieuw");
  redirect("/contracten/nieuw?map=klaar");
}

/**
 * Het getekende exemplaar is terug: alle geüploade bestanden (getekend contract +
 * eventuele bijlagen) worden één PDF-pakket en dat gaat in het dossier van de
 * gekozen persoon, medewerker of klant. Daarna staat het document op Getekend.
 */
export async function getekendTerug(formData: FormData): Promise<void> {
  const id = String(formData.get("id") ?? "");
  const soort = String(formData.get("soort") ?? "");
  const [type, eigenaarId] = String(formData.get("eigenaar") ?? "").split(":");
  const fout = (code: string) => redirect(`/contracten/nieuw?map=wacht&fout=${code}`);
  const files = formData.getAll("file").filter((f): f is File => f instanceof File && f.size > 0);
  if (!files.length) fout("bestand");
  if (!eigenaarId || !["consultant", "employee", "client"].includes(type)) fout("eigenaar");
  if (files.reduce((n, f) => n + f.size, 0) > MAX_UPLOAD_BYTES) fout("groot");

  const contract = soort === "contract" ? await db.contract.findUnique({ where: { id } }) : null;
  const doc = soort !== "contract" ? await db.docConcept.findUnique({ where: { id } }) : null;
  if (!contract && !doc) fout("onbekend");
  const naam = contract ? `Getekend contract ${contract.number ?? contract.contractorName}` : `Getekend: ${doc!.label || doc!.soort}`;

  // Eén bestand blijft zoals het is; meerdere → één PDF.
  let bestand = files[0];
  if (files.length > 1) {
    try {
      const pdf = await maakPakket(
        await Promise.all(files.map(async (f) => ({ bytes: new Uint8Array(await f.arrayBuffer()), type: f.type, naam: f.name }))),
      );
      bestand = new File([Buffer.from(pdf)], `${naam}.pdf`, { type: "application/pdf" });
    } catch {
      fout("pakket");
    }
  }
  const meta = { originalName: bestand.name, mimeType: bestand.type || "application/octet-stream" };

  let href = "";
  let bij = "";
  let documentId: string | null = null;
  if (type === "consultant") {
    const c = await db.consultant.findUnique({ where: { id: eigenaarId }, select: { firstName: true, lastName: true } });
    if (!c) fout("eigenaar");
    const fileName = await saveUpload(eigenaarId, bestand);
    const d = await db.document.create({ data: { consultantId: eigenaarId, category: "CONTRACT", title: naam, fileName, size: bestand.size, ...meta } });
    documentId = d.id;
    href = `/api/documents/${d.id}`;
    bij = `${c!.firstName} ${c!.lastName}`.trim();
    revalidatePath(`/werknemers/${eigenaarId}`);
  } else if (type === "employee") {
    const e = await db.employee.findUnique({ where: { id: eigenaarId }, select: { firstName: true, lastName: true } });
    if (!e) fout("eigenaar");
    const fileName = await saveUpload(eigenaarId, bestand);
    const d = await db.employeeDocument.create({ data: { employeeId: eigenaarId, category: "CONTRACT", title: naam, fileName, fileSize: bestand.size, ...meta } });
    href = `/api/medewerkers/document/${d.id}`;
    bij = `${e!.firstName} ${e!.lastName}`.trim();
    revalidatePath(`/medewerkers/${eigenaarId}`);
  } else {
    const k = await db.client.findUnique({ where: { id: eigenaarId }, select: { companyName: true } });
    if (!k) fout("eigenaar");
    const fileName = await saveUpload(eigenaarId, bestand);
    const d = await db.clientDocument.create({ data: { clientId: eigenaarId, title: naam, fileName, size: bestand.size, ...meta } });
    href = `/api/klanten/document/${d.id}`;
    bij = k!.companyName;
    revalidatePath(`/klanten/${eigenaarId}`);
  }

  if (contract) {
    await db.contract.update({
      where: { id },
      data: {
        status: "SIGNED",
        signedDocumentId: documentId,
        signDate: contract.signDate ?? new Date(),
        ...(type === "consultant" && !contract.consultantId ? { consultantId: eigenaarId } : {}),
      },
    });
  } else {
    await db.docConcept.update({ where: { id }, data: { status: "SIGNED", signedAt: new Date(), signedHref: href, signedFor: bij } });
  }
  revalidatePath("/contracten");
  revalidatePath("/contracten/nieuw");
  redirect("/contracten/nieuw?map=getekend");
}
