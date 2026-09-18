"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { CONTRACT_STATUS_VALUES } from "@/lib/domain";

/**
 * Server actions voor de Contracten-hub (Overeenkomst van opdracht).
 *
 * Alleen de VARIABELE velden komen hier binnen; de vaste juridische tekst zit in
 * de renderer (contract-doc.ts / ContractVel.tsx). Een contract hangt altijd aan
 * een Consultant (opdrachtnemer) en optioneel aan een Placement.
 */

const optional = z.string().optional().transform((v) => (v && v.trim() ? v.trim() : ""));
const optionalNull = z.string().optional().transform((v) => (v && v.trim() ? v.trim() : null));

const ContractSchema = z.object({
  consultantId: z.string().min(1, "Kies een opdrachtnemer"),
  placementId: optionalNull,
  number: optionalNull,

  contractorName: z.string().min(1, "Naam opdrachtnemer is verplicht"),
  contractorAddress: optional,
  contractorKvk: optional,
  contractorVat: optional,

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

/** Vul lege optionele string-velden met de sjabloon-defaults. */
function withDefaults(data: z.infer<typeof ContractSchema>) {
  return {
    fieldOfWork: data.fieldOfWork || "Quality & Inspection Services",
    serviceNeed: data.serviceNeed || "Quality Management & Inspection Services",
    noticePeriod: data.noticePeriod || "twee (2) weken",
    invoiceEmail: data.invoiceEmail || "admin@q4s.nl",
    insuranceCover: data.insuranceCover || "€ 2.500.000,-",
    signerClient: data.signerClient || "P. Boomsma",
    signPlaceClient: data.signPlaceClient || "Barendrecht",
  };
}

export async function createContract(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(ContractSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;
  const flags = readFlags(formData);

  let id: string;
  try {
    const created = await db.contract.create({
      data: {
        consultantId: d.consultantId,
        placementId: d.placementId,
        number: d.number,
        contractorName: d.contractorName,
        contractorAddress: d.contractorAddress,
        contractorKvk: d.contractorKvk,
        contractorVat: d.contractorVat,
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
      },
      select: { id: true },
    });
    id = created.id;
  } catch {
    return { error: "Contract kon niet worden opgeslagen. Controleer de velden en probeer opnieuw." };
  }

  revalidatePath("/contracten");
  redirect(`/contracten/${id}`);
}

export async function updateContract(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Ontbrekend contract-id." };

  const parsed = parseForm(ContractSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;
  const flags = readFlags(formData);

  try {
    await db.contract.update({
      where: { id },
      data: {
        consultantId: d.consultantId,
        placementId: d.placementId,
        number: d.number,
        contractorName: d.contractorName,
        contractorAddress: d.contractorAddress,
        contractorKvk: d.contractorKvk,
        contractorVat: d.contractorVat,
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
      },
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
