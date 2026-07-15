"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSalesInvoice } from "@/lib/invoicing";
import { reconcileInvoiceSequence } from "@/lib/numbering";
import { parseForm, type FormState } from "@/lib/form";
import { round2 } from "@/lib/utils";

const EditInvoiceSchema = z.object({
  number: z.string().min(1, "Factuurnummer is verplicht"),
  issueDate: z.coerce.date({ message: "Factuurdatum is verplicht" }),
  dueDate: z.coerce.date({ message: "Vervaldatum is verplicht" }),
  vatRate: z.coerce.number().min(0, "BTW mag niet negatief zijn").max(100),
  notes: z.string().optional(),
});

/**
 * Correct an existing invoice's header (number, dates, BTW%, notes). The number
 * stays unique; BTW + total are recomputed from the (unchanged) subtotal; and a
 * manually-set number bumps the year sequence so auto-numbering keeps running.
 */
export async function updateInvoice(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Onbekende factuur." };

  const parsed = parseForm(EditInvoiceSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;
  const number = d.number.trim();

  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!invoice) return { error: "Onbekende factuur." };

  // Parse + validate the edited lines (the form submits every line).
  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    return { error: "Kon de factuurregels niet lezen." };
  }
  if (!Array.isArray(raw)) return { error: "Ongeldige factuurregels." };

  const validIds = new Set(invoice.lines.map((l) => l.id));
  const seen = new Set<string>();
  const updates: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
  }[] = [];
  for (const r of raw as Array<{
    id?: unknown;
    description?: unknown;
    quantity?: unknown;
    unitPrice?: unknown;
  }>) {
    const lineId = String(r.id ?? "");
    // Skip unknown ids AND duplicates (a duplicate would drop another line and
    // desync the subtotal — the count guard below then rejects the payload).
    if (!validIds.has(lineId) || seen.has(lineId)) continue;
    seen.add(lineId);
    const description = String(r.description ?? "").trim();
    const quantity = Number(r.quantity);
    const unitPrice = Number(r.unitPrice);
    if (!description) return { error: "Elke factuurregel heeft een omschrijving nodig." };
    if (
      !Number.isFinite(quantity) || quantity < 0 ||
      !Number.isFinite(unitPrice) || unitPrice < 0
    ) {
      return { error: "Vul geldige (niet-negatieve) aantallen en tarieven in." };
    }
    const amount = round2(quantity * unitPrice);
    if (!Number.isFinite(amount)) return { error: "Een bedrag is te groot om te verwerken." };
    updates.push({ id: lineId, description, quantity, unitPrice, amount });
  }
  // Every existing line must be present exactly once (the form submits all of
  // them); combined with the dedup above this guarantees a 1-to-1 mapping.
  if (updates.length !== invoice.lines.length) {
    return { error: "De factuurregels konden niet volledig worden gelezen." };
  }

  const subtotal = round2(updates.reduce((s, l) => s + l.amount, 0));
  const vatAmount = round2((subtotal * d.vatRate) / 100);
  const total = round2(subtotal + vatAmount);
  if (!Number.isFinite(subtotal) || !Number.isFinite(vatAmount) || !Number.isFinite(total)) {
    return { error: "Het totaalbedrag is te groot om te verwerken." };
  }

  const clash = await db.invoice.findFirst({
    where: { number, id: { not: id } },
    select: { id: true },
  });
  if (clash) return { fieldErrors: { number: "Dit factuurnummer is al in gebruik." } };

  await db.$transaction(async (tx) => {
    for (const l of updates) {
      await tx.invoiceLine.update({
        where: { id: l.id },
        data: {
          description: l.description,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
          amount: l.amount,
        },
      });
    }
    await tx.invoice.update({
      where: { id },
      data: {
        number,
        issueDate: d.issueDate,
        dueDate: d.dueDate,
        vatRate: d.vatRate,
        subtotal,
        vatAmount,
        total,
        notes: d.notes?.trim() || null,
      },
    });
    await reconcileInvoiceSequence(tx, number);
  });

  revalidatePath("/facturen");
  revalidatePath(`/facturen/${id}`);
  revalidatePath("/", "layout");
  redirect(`/facturen/${id}`);
}

/**
 * Generate a client invoice from selected APPROVED timesheets.
 * Delegates the computation/transaction to createSalesInvoice (shared with the
 * one-click "both invoices" flow); amounts are recomputed server-side.
 */
export async function generateInvoice(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const clientId = String(formData.get("clientId") ?? "");
  const issueDateRaw = String(formData.get("issueDate") ?? "");
  const notesRaw = formData.get("notes");
  const notes =
    typeof notesRaw === "string" && notesRaw.trim() ? notesRaw.trim() : null;
  const timesheetIds = formData
    .getAll("timesheetIds")
    .map(String)
    .filter(Boolean);
  const issueDate = issueDateRaw
    ? new Date(`${issueDateRaw}T00:00:00`)
    : new Date();

  const res = await createSalesInvoice({ clientId, timesheetIds, issueDate, notes });
  if (!res.ok) return { error: res.error };

  revalidatePath("/facturen");
  revalidatePath("/", "layout");
  revalidatePath("/uren");
  redirect(`/facturen/${res.invoiceId}`);
}

/** Change an invoice's status (sent / paid / cancelled / back to draft). */
export async function setInvoiceStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["DRAFT", "SENT", "PAID", "CANCELLED"].includes(status)) return;

  if (status === "CANCELLED") {
    // Cancelling voids the invoice: release its timesheets back to APPROVED and
    // drop the line→timesheet links so the hours can be re-invoiced (otherwise
    // the week is stuck at INVOICED with a live invoiceLine — a dead end).
    const inv = await db.invoice.findUnique({
      where: { id },
      include: { lines: true },
    });
    if (inv) {
      const tsIds = inv.lines
        .map((l) => l.timesheetId)
        .filter((x): x is string => Boolean(x));
      await db.$transaction([
        db.invoiceLine.updateMany({
          where: { invoiceId: id, timesheetId: { not: null } },
          data: { timesheetId: null },
        }),
        db.timesheet.updateMany({
          where: { id: { in: tsIds } },
          data: { status: "APPROVED" },
        }),
        db.invoice.update({
          where: { id },
          data: { status: "CANCELLED", paidDate: null },
        }),
      ]);
    }
  } else {
    await db.invoice.update({
      where: { id },
      data: {
        status,
        paidDate: status === "PAID" ? new Date() : null,
        // Back to concept "un-sends" it: clear the sent marker so it honestly
        // re-enters the verzendmap and can be (re)sent.
        ...(status === "DRAFT" ? { sentAt: null, sentTo: null } : {}),
      },
    });
  }

  revalidatePath("/facturen");
  revalidatePath("/", "layout");
  revalidatePath("/uren");
  revalidatePath(`/facturen/${id}`);
  redirect(`/facturen/${id}`);
}

/**
 * Delete a DRAFT/CANCELLED invoice and release its timesheets back to
 * APPROVED so they can be re-invoiced. Sent/paid invoices are protected.
 */
export async function deleteInvoice(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const inv = await db.invoice.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!inv) return;
  if (inv.status === "SENT" || inv.status === "PAID") {
    redirect(`/facturen/${id}?error=locked`);
  }

  const tsIds = inv.lines
    .map((l) => l.timesheetId)
    .filter((x): x is string => Boolean(x));

  await db.$transaction([
    db.timesheet.updateMany({
      where: { id: { in: tsIds } },
      data: { status: "APPROVED" },
    }),
    db.invoice.delete({ where: { id } }),
  ]);

  revalidatePath("/facturen");
  revalidatePath("/", "layout");
  revalidatePath("/uren");
  redirect("/facturen");
}
