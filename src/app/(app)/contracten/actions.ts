"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { CONTRACT_STATUS_VALUES } from "@/lib/domain";
import { ontbrekendeContractVelden } from "@/lib/contract-check";

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
    signPlaceClient: data.signPlaceClient || "Barendrecht",
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
  redirect("/contracten");
}

/** Offerte/arbeidsovereenkomst opslaan (nieuw of bijwerken). Geeft het id terug. */
export async function bewaarDoc(soort: string, id: string | null, waarden: Record<string, string>, klaar?: boolean): Promise<{ id: string } | { error: string }> {
  if (soort !== "offerte" && soort !== "arbeidsovereenkomst") return { error: "Onbekend document." };
  const schoon = Object.fromEntries(Object.entries(waarden).filter(([k, v]) => typeof k === "string" && typeof v === "string").map(([k, v]) => [k.slice(0, 80), v.slice(0, 5000)]));
  const label = (soort === "offerte" ? [schoon.to, schoon.subject] : [schoon.naam, schoon.functie]).filter(Boolean).join(" — ").slice(0, 200);
  const data = JSON.stringify(schoon);
  // klaar undefined (automatisch bewaren): status van een bestaand document niet aanraken.
  const status = klaar === undefined ? undefined : klaar ? "READY" : "DRAFT";
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
