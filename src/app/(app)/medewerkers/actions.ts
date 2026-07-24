"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { saveUpload, deleteUpload, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { workdaysExcludingHolidays } from "@/lib/holidays";
import {
  EMPLOYEE_DEPARTMENT_VALUES,
  EMPLOYEE_EMPLOYMENT_VALUES,
  LEAVE_TYPE_VALUES,
  BONUS_TYPE_VALUES,
  EMPLOYEE_DOC_CATEGORY_VALUES,
  DISCIPLINE_VALUES,
} from "@/lib/domain";

const EmployeeSchema = z.object({
  firstName: z.string().min(1, "Voornaam is verplicht"),
  lastName: z.string().min(1, "Achternaam is verplicht"),
  email: z.string().email("Ongeldig e-mailadres").optional(),
  phone: z.string().optional(),
  jobTitle: z.string().optional(),
  department: z.enum(EMPLOYEE_DEPARTMENT_VALUES),
  employmentType: z.enum(EMPLOYEE_EMPLOYMENT_VALUES),
  contractType: z.string().optional(),
  startDate: z.coerce.date().optional(),
  endDate: z.coerce.date().optional(),
  hoursPerWeek: z.coerce.number().min(0).optional(),
  monthlySalary: z.coerce.number().min(0).optional(),
  vacationDaysPerYear: z.coerce.number().min(0).optional(),
  dateOfBirth: z.coerce.date().optional(),
  bsn: z.string().optional(),
  address: z.string().optional(),
  postalCode: z.string().optional(),
  city: z.string().optional(),
  iban: z.string().optional(),
  emergencyName: z.string().optional(),
  emergencyPhone: z.string().optional(),
  notes: z.string().optional(),
});

function toData(d: z.infer<typeof EmployeeSchema>) {
  const orNull = (v?: string) => (v && v.trim() ? v : null);
  return {
    firstName: d.firstName,
    lastName: d.lastName,
    email: orNull(d.email),
    phone: orNull(d.phone),
    jobTitle: orNull(d.jobTitle),
    department: d.department,
    employmentType: d.employmentType,
    contractType: orNull(d.contractType),
    startDate: d.startDate ?? null,
    endDate: d.endDate ?? null,
    hoursPerWeek: d.hoursPerWeek ?? 40,
    monthlySalary: d.monthlySalary ?? 0,
    vacationDaysPerYear: d.vacationDaysPerYear ?? 25,
    dateOfBirth: d.dateOfBirth ?? null,
    bsn: orNull(d.bsn),
    address: orNull(d.address),
    postalCode: orNull(d.postalCode),
    city: orNull(d.city),
    iban: orNull(d.iban),
    emergencyName: orNull(d.emergencyName),
    emergencyPhone: orNull(d.emergencyPhone),
    notes: orNull(d.notes),
  };
}

export async function createEmployee(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(EmployeeSchema, formData);
  if (!parsed.success) return parsed.state;

  const created = await db.employee.create({ data: toData(parsed.data) });
  revalidatePath("/medewerkers");
  redirect(`/medewerkers/${created.id}`);
}

export async function updateEmployee(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Onbekende medewerker." };

  const parsed = parseForm(EmployeeSchema, formData);
  if (!parsed.success) return parsed.state;

  await db.employee.update({ where: { id }, data: toData(parsed.data) });
  revalidatePath("/medewerkers");
  revalidatePath(`/medewerkers/${id}`);
  redirect(`/medewerkers/${id}`);
}

export async function deleteEmployee(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  try {
    await db.employee.delete({ where: { id } });
  } catch {
    redirect(`/medewerkers/${id}?error=in-use`);
  }
  revalidatePath("/medewerkers");
  redirect("/medewerkers");
}

// ---- Detacheren (eigen medewerker → plaatsing bij klant) ----

/**
 * Detacheer deze eigen medewerker naar een klant. Koppelt (of maakt) één keer een
 * Consultant-record (employmentType LOONDIENST, `employeeId` naar de medewerker) —
 * dat is de "detachering-identiteit" die de facturatie-motor gebruikt — en maakt
 * daaronder de plaatsing. Omdat het dienstverband LOONDIENST is, slaat de motor de
 * inkoopfactuur over (salaris i.p.v. factuur) en stuurt alleen de klantfactuur.
 */
export async function detachEmployee(formData: FormData) {
  const employeeId = String(formData.get("employeeId") ?? "");
  if (!employeeId) redirect("/medewerkers");
  const emp = await db.employee.findUnique({
    where: { id: employeeId },
    include: { detachering: { select: { id: true } } },
  });
  if (!emp) redirect("/medewerkers");

  const clientId = String(formData.get("clientId") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  if (!clientId || !title) redirect(`/medewerkers/${employeeId}?error=detach`);
  const client = await db.client.findUnique({ where: { id: clientId }, select: { id: true } });
  if (!client) redirect(`/medewerkers/${employeeId}?error=detach`);

  const num = (k: string) => {
    const n = Number(String(formData.get(k) ?? "").replace(",", "."));
    return Number.isFinite(n) && n >= 0 ? n : 0;
  };
  const disciplineRaw = String(formData.get("discipline") ?? "OVERIG");
  const discipline = (DISCIPLINE_VALUES as string[]).includes(disciplineRaw) ? disciplineRaw : "OVERIG";
  const chargeRate = num("chargeRate");
  const costRate = num("costRate");
  const startRaw = String(formData.get("startDate") ?? "").trim();
  const startDate = startRaw ? new Date(startRaw) : new Date();
  const workLocation = String(formData.get("workLocation") ?? "").trim() || null;

  // Koppel/creëer de consultant-identiteit. Geen e-mail/IBAN kopiëren: die zijn
  // uniek + loondienst factureert niet (geen inkoopfactuur), dus niet nodig — en zo
  // botst het nooit met een bestaande consultant.
  let consultantId = emp.detachering?.id ?? null;
  if (!consultantId) {
    const c = await db.consultant.create({
      data: {
        firstName: emp.firstName,
        lastName: emp.lastName,
        discipline,
        employmentType: "LOONDIENST",
        defaultCostRate: costRate,
        employeeId: emp.id,
        dateOfBirth: emp.dateOfBirth,
        bsn: emp.bsn,
      },
    });
    consultantId = c.id;
  } else {
    await db.consultant
      .update({ where: { id: consultantId }, data: { discipline, active: true } })
      .catch(() => {});
  }

  const placement = await db.placement.create({
    data: {
      consultantId,
      clientId,
      title,
      startDate: isNaN(startDate.getTime()) ? new Date() : startDate,
      status: "ACTIVE",
      costRate,
      chargeRate,
      weekendSurchargeSell: num("weekendSurchargeSell"),
      overtimeSurchargeSell: num("overtimeSurchargeSell"),
      kmRateSell: num("kmRateSell"),
      workLocation,
    },
  });

  revalidatePath(`/medewerkers/${employeeId}`);
  revalidatePath("/plaatsingen");
  revalidatePath("/werknemers");
  redirect(`/plaatsingen/${placement.id}?new=1`);
}

// ---- Verlof ----

export async function addLeave(formData: FormData) {
  const employeeId = String(formData.get("employeeId") ?? "");
  if (!employeeId) return;
  const type = String(formData.get("type") ?? "VAKANTIE");
  const start = new Date(String(formData.get("startDate") ?? ""));
  if (isNaN(start.getTime())) redirect(`/medewerkers/${employeeId}?error=date`);
  const endRaw = String(formData.get("endDate") ?? "");
  const end = endRaw ? new Date(endRaw) : start;
  const inputDays = Number(formData.get("days") ?? 0);
  // Auto: werkdagen excl. weekend én officiële NL-feestdagen (kosten geen verlof).
  const days =
    inputDays > 0
      ? inputDays
      : workdaysExcludingHolidays(start, isNaN(end.getTime()) ? start : end);

  await db.employeeLeave.create({
    data: {
      employeeId,
      type: (LEAVE_TYPE_VALUES as string[]).includes(type) ? type : "VAKANTIE",
      startDate: start,
      endDate: isNaN(end.getTime()) ? start : end,
      days,
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
  });
  revalidatePath(`/medewerkers/${employeeId}`);
  redirect(`/medewerkers/${employeeId}`);
}

export async function deleteLeave(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  if (id) await db.employeeLeave.delete({ where: { id } }).catch(() => {});
  revalidatePath(`/medewerkers/${employeeId}`);
  redirect(`/medewerkers/${employeeId}`);
}

// ---- Bonussen ----

export async function addBonus(formData: FormData) {
  const employeeId = String(formData.get("employeeId") ?? "");
  if (!employeeId) return;
  const type = String(formData.get("type") ?? "PRESTATIE");
  const dateRaw = String(formData.get("date") ?? "");
  const date = dateRaw ? new Date(dateRaw) : new Date();

  await db.employeeBonus.create({
    data: {
      employeeId,
      type: (BONUS_TYPE_VALUES as string[]).includes(type) ? type : "PRESTATIE",
      amount: Number(formData.get("amount") ?? 0) || 0,
      date: isNaN(date.getTime()) ? new Date() : date,
      description: String(formData.get("description") ?? "").trim() || null,
    },
  });
  revalidatePath(`/medewerkers/${employeeId}`);
  redirect(`/medewerkers/${employeeId}`);
}

export async function deleteBonus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  if (id) await db.employeeBonus.delete({ where: { id } }).catch(() => {});
  revalidatePath(`/medewerkers/${employeeId}`);
  redirect(`/medewerkers/${employeeId}`);
}

// ---- Eindejaarsbeoordeling (percentage) ----

export async function saveReview(formData: FormData) {
  const employeeId = String(formData.get("employeeId") ?? "");
  if (!employeeId) return;
  const year = Number(formData.get("year") ?? 0) || new Date().getFullYear();
  const scorePct = Number(formData.get("scorePct") ?? 0) || 0;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  await db.employeeReview.upsert({
    where: { employeeId_year: { employeeId, year } },
    create: { employeeId, year, scorePct, notes },
    update: { scorePct, notes },
  });
  revalidatePath(`/medewerkers/${employeeId}`);
  redirect(`/medewerkers/${employeeId}`);
}

// ---- Loonstroken (bruto/netto + optioneel PDF) ----

export async function addPayslip(formData: FormData) {
  const employeeId = String(formData.get("employeeId") ?? "");
  if (!employeeId) return;
  const now = new Date();
  const year = Number(formData.get("year") ?? 0) || now.getFullYear();
  const monthRaw = Number(formData.get("month") ?? 0);
  const month = monthRaw >= 1 && monthRaw <= 12 ? monthRaw : now.getMonth() + 1;

  let fileData: {
    fileName?: string;
    originalName?: string;
    mimeType?: string;
    fileSize?: number;
  } = {};
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > MAX_UPLOAD_BYTES) redirect(`/medewerkers/${employeeId}?error=size`);
    const stored = await saveUpload(employeeId, file);
    fileData = {
      fileName: stored,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
    };
  }

  await db.employeePayslip.create({
    data: {
      employeeId,
      year,
      month,
      grossAmount: Number(formData.get("grossAmount") ?? 0) || 0,
      netAmount: Number(formData.get("netAmount") ?? 0) || 0,
      notes: String(formData.get("notes") ?? "").trim() || null,
      ...fileData,
    },
  });
  revalidatePath(`/medewerkers/${employeeId}`);
  redirect(`/medewerkers/${employeeId}`);
}

export async function deletePayslip(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  if (id) {
    const slip = await db.employeePayslip.findUnique({ where: { id } });
    await db.employeePayslip.delete({ where: { id } }).catch(() => {});
    if (slip?.fileName) await deleteUpload(employeeId, slip.fileName);
  }
  revalidatePath(`/medewerkers/${employeeId}`);
  redirect(`/medewerkers/${employeeId}`);
}

// ---- Documenten / contract ----

export async function uploadDocument(formData: FormData) {
  const employeeId = String(formData.get("employeeId") ?? "");
  if (!employeeId) return;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    redirect(`/medewerkers/${employeeId}?error=upload`);
  }
  if (file.size > MAX_UPLOAD_BYTES) redirect(`/medewerkers/${employeeId}?error=size`);

  const category = String(formData.get("category") ?? "CONTRACT");
  const title = String(formData.get("title") ?? "").trim() || file.name;
  const stored = await saveUpload(employeeId, file);

  await db.employeeDocument.create({
    data: {
      employeeId,
      category: (EMPLOYEE_DOC_CATEGORY_VALUES as string[]).includes(category) ? category : "OVERIG",
      title,
      fileName: stored,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
      fileSize: file.size,
    },
  });
  revalidatePath(`/medewerkers/${employeeId}`);
  redirect(`/medewerkers/${employeeId}`);
}

export async function deleteDocument(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  if (id) {
    const doc = await db.employeeDocument.findUnique({ where: { id } });
    await db.employeeDocument.delete({ where: { id } }).catch(() => {});
    if (doc?.fileName) await deleteUpload(employeeId, doc.fileName);
  }
  revalidatePath(`/medewerkers/${employeeId}`);
  redirect(`/medewerkers/${employeeId}`);
}

// ---- Eigen urenregistratie (gewerkte uren per week) ----

/** Monday (local midnight) of the week containing `d`. */
function mondayOf(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

export async function addWorklog(formData: FormData) {
  const employeeId = String(formData.get("employeeId") ?? "");
  if (!employeeId) return;
  const weekRaw = String(formData.get("week") ?? "");
  const date = weekRaw ? new Date(weekRaw) : new Date();
  if (isNaN(date.getTime())) redirect(`/medewerkers/${employeeId}?error=date`);
  const weekStart = mondayOf(date);
  const hours = Number(formData.get("hours") ?? 0) || 0;
  const notes = String(formData.get("notes") ?? "").trim() || null;

  await db.employeeWorklog.upsert({
    where: { employeeId_weekStart: { employeeId, weekStart } },
    create: { employeeId, weekStart, hours, notes },
    update: { hours, notes },
  });
  revalidatePath(`/medewerkers/${employeeId}`);
  redirect(`/medewerkers/${employeeId}`);
}

export async function deleteWorklog(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const employeeId = String(formData.get("employeeId") ?? "");
  if (id) await db.employeeWorklog.delete({ where: { id } }).catch(() => {});
  revalidatePath(`/medewerkers/${employeeId}`);
  redirect(`/medewerkers/${employeeId}`);
}
