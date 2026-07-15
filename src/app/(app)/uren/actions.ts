"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { parseForm, type FormState } from "@/lib/form";
import { parseHours, startOfISOWeek, round2 } from "@/lib/utils";
import { createSalesInvoice, createPurchaseInvoice } from "@/lib/invoicing";

const BaseSchema = z.object({
  placementId: z.string().min(1, "Kies een plaatsing"),
  weekStart: z.coerce.date(),
  note: z.string().optional(),
});

const EditSchema = z.object({
  weekStart: z.coerce.date(),
  note: z.string().optional(),
});

type BuiltEntry = {
  date: Date;
  hours: number;
  kilometers: number | null;
  description: string | null;
};

/** Read hours/km/note per day (0..6) → dated entries. Uren én kilometers worden
 *  in hetzelfde formulier ("Weekstaat bewerken") ingevuld. Een dag blijft staan
 *  zodra er uren OF kilometers OF een notitie is. */
function buildEntries(weekMonday: Date, formData: FormData): BuiltEntry[] {
  const entries: BuiltEntry[] = [];
  for (let i = 0; i < 7; i++) {
    const hours = parseHours(String(formData.get(`hours_${i}`) ?? ""));
    const km = parseHours(String(formData.get(`km_${i}`) ?? ""));
    const note = String(formData.get(`note_${i}`) ?? "").trim();
    if (hours > 0 || km > 0 || note) {
      const d = new Date(weekMonday);
      d.setDate(d.getDate() + i);
      d.setHours(0, 0, 0, 0);
      entries.push({
        date: d,
        hours,
        kilometers: km > 0 ? km : null,
        description: note || null,
      });
    }
  }
  return entries;
}

/** Week kilometers = sum of the per-day kilometers (drives the km-vergoeding). */
function weekKilometers(entries: BuiltEntry[]): number | null {
  const total = round2(entries.reduce((s, e) => s + (e.kilometers ?? 0), 0));
  return total > 0 ? total : null;
}

function readOvertime(formData: FormData): number | null {
  return parseHours(String(formData.get("overtimeHours") ?? "")) || null;
}

export async function createTimesheet(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parseForm(BaseSchema, formData);
  if (!parsed.success) return parsed.state;

  const monday = startOfISOWeek(parsed.data.weekStart);
  const entries = buildEntries(monday, formData);
  if (entries.length === 0) {
    return { error: "Vul minimaal één dag in (uren of een notitie)." };
  }

  const existing = await db.timesheet.findUnique({
    where: {
      placementId_weekStart: {
        placementId: parsed.data.placementId,
        weekStart: monday,
      },
    },
  });
  if (existing) {
    return {
      error: "Er bestaat al een urenstaat voor deze plaatsing in deze week.",
    };
  }

  const ts = await db.timesheet.create({
    data: {
      placementId: parsed.data.placementId,
      weekStart: monday,
      status: "DRAFT",
      kilometers: weekKilometers(entries),
      overtimeHours: readOvertime(formData),
      entries: { create: entries },
    },
  });

  revalidatePath("/uren");
  revalidatePath("/", "layout");
  redirect(`/uren/${ts.id}`);
}

export async function updateTimesheet(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Onbekende urenstaat." };

  // Uren mogen ALTIJD handmatig aangepast worden (ook na goedkeuren/factureren);
  // een reeds aangemaakte factuur blijft staan zoals verzonden.
  const ts = await db.timesheet.findUnique({ where: { id }, select: { id: true } });
  if (!ts) return { error: "Onbekende urenstaat." };

  const parsed = parseForm(EditSchema, formData);
  if (!parsed.success) return parsed.state;

  const monday = startOfISOWeek(parsed.data.weekStart);
  const entries = buildEntries(monday, formData);
  if (entries.length === 0) {
    return { error: "Vul minimaal één dag in (uren, kilometers of een notitie)." };
  }

  try {
    await db.$transaction([
      db.timesheetEntry.deleteMany({ where: { timesheetId: id } }),
      db.timesheet.update({
        where: { id },
        data: {
          weekStart: monday,
          kilometers: weekKilometers(entries),
          overtimeHours: readOvertime(formData),
          entries: { create: entries },
        },
      }),
    ]);
  } catch {
    return {
      error: "Er bestaat al een urenstaat voor deze plaatsing in die week.",
    };
  }

  revalidatePath("/uren");
  revalidatePath("/", "layout");
  revalidatePath(`/uren/${id}`);
  redirect(`/uren/${id}`);
}

/** Change a timesheet's status (submit / approve / reopen). */
export async function setTimesheetStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id) return;
  if (!["DRAFT", "SUBMITTED", "APPROVED"].includes(status)) return;

  const ts = await db.timesheet.findUnique({
    where: { id },
    include: {
      invoiceLine: { select: { id: true } },
      purchaseLine: { select: { id: true } },
    },
  });
  if (!ts) return;
  // Lock once the hours have been committed to a sales OR purchase invoice —
  // changing them would divorce the issued invoice from its source.
  if (ts.status === "INVOICED" || ts.invoiceLine || ts.purchaseLine) {
    redirect(`/uren/${id}?error=locked`);
  }

  await db.timesheet.update({ where: { id }, data: { status } });
  revalidatePath("/uren");
  revalidatePath("/", "layout");
  revalidatePath(`/uren/${id}`);
  redirect(`/uren/${id}`);
}

export async function deleteTimesheet(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const ts = await db.timesheet.findUnique({
    where: { id },
    include: {
      invoiceLine: { select: { id: true } },
      purchaseLine: { select: { id: true } },
    },
  });
  if (!ts) return;
  if (ts.status === "INVOICED" || ts.invoiceLine || ts.purchaseLine) {
    redirect(`/uren/${id}?error=locked`);
  }

  await db.timesheet.delete({ where: { id } });
  revalidatePath("/uren");
  revalidatePath("/", "layout");
  redirect("/uren");
}

// ---------- Invoice generation from a single timesheet ----------

/** Generate ONLY the client (sales) invoice for one timesheet. */
export async function generateSalesForTimesheet(formData: FormData) {
  const timesheetId = String(formData.get("timesheetId") ?? "");
  if (!timesheetId) return;
  const ts = await db.timesheet.findUnique({
    where: { id: timesheetId },
    include: { placement: true },
  });
  if (!ts) redirect("/uren");

  const res = await createSalesInvoice({
    clientId: ts.placement.clientId,
    timesheetIds: [timesheetId],
    issueDate: new Date(),
    notes: null,
  });
  if (!res.ok) redirect(`/uren/${timesheetId}?error=sales`);

  revalidatePath("/facturen");
  revalidatePath("/uren");
  revalidatePath("/", "layout");
  redirect(`/facturen/${res.invoiceId}`);
}

/** Generate ONLY the purchase (self-billing) invoice for one timesheet. */
export async function generatePurchaseForTimesheet(formData: FormData) {
  const timesheetId = String(formData.get("timesheetId") ?? "");
  if (!timesheetId) return;
  const ts = await db.timesheet.findUnique({
    where: { id: timesheetId },
    include: { placement: true },
  });
  if (!ts) redirect("/uren");

  const res = await createPurchaseInvoice({
    consultantId: ts.placement.consultantId,
    timesheetIds: [timesheetId],
    issueDate: new Date(),
    notes: null,
  });
  if (!res.ok) redirect(`/uren/${timesheetId}?error=purchase`);

  revalidatePath("/inkoopfacturen");
  revalidatePath("/uren");
  revalidatePath("/", "layout");
  redirect(`/inkoopfacturen/${res.purchaseInvoiceId}`);
}

/**
 * One click: generate BOTH invoices for a timesheet — the purchase (cost) and
 * the sales (charge, incl. margin). Skips whichever already exists.
 */
export async function generateBothForTimesheet(formData: FormData) {
  const timesheetId = String(formData.get("timesheetId") ?? "");
  if (!timesheetId) return;
  const ts = await db.timesheet.findUnique({
    where: { id: timesheetId },
    include: { placement: true, invoiceLine: true, purchaseLine: true },
  });
  if (!ts) redirect("/uren");

  const issueDate = new Date();
  let failed: string | null = null;
  // Sales side first (requires APPROVED; this flips the timesheet to INVOICED).
  if (!ts.invoiceLine && ts.status === "APPROVED") {
    const r = await createSalesInvoice({
      clientId: ts.placement.clientId,
      timesheetIds: [timesheetId],
      issueDate,
      notes: null,
    });
    if (!r.ok) failed = "sales";
  }
  // Purchase side (independent of the sales status).
  if (!ts.purchaseLine) {
    const r = await createPurchaseInvoice({
      consultantId: ts.placement.consultantId,
      timesheetIds: [timesheetId],
      issueDate,
      notes: null,
    });
    if (!r.ok && !failed) failed = "purchase";
  }

  revalidatePath("/facturen");
  revalidatePath("/inkoopfacturen");
  revalidatePath("/uren");
  revalidatePath("/", "layout");
  revalidatePath(`/uren/${timesheetId}`);
  redirect(failed ? `/uren/${timesheetId}?error=${failed}` : `/uren/${timesheetId}`);
}
