"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createPurchaseInvoice } from "@/lib/invoicing";
import { reconcileInvoiceSequence } from "@/lib/numbering";
import { parseForm, type FormState } from "@/lib/form";
import { round2 } from "@/lib/utils";

/**
 * Generate a self-billing purchase invoice for a consultant from selected
 * approved/invoiced timesheets (cost rate). Computation/transaction lives in
 * createPurchaseInvoice (shared with the one-click "both invoices" flow).
 */
export async function generatePurchaseInvoice(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const consultantId = String(formData.get("consultantId") ?? "");
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

  const res = await createPurchaseInvoice({ consultantId, timesheetIds, issueDate, notes });
  if (!res.ok) return { error: res.error };

  revalidatePath("/inkoopfacturen");
  revalidatePath("/", "layout");
  revalidatePath("/uren");
  redirect(`/inkoopfacturen/${res.purchaseInvoiceId}`);
}

const EditPurchaseSchema = z.object({
  number: z.string().min(1, "Factuurnummer is verplicht"),
  issueDate: z.coerce.date({ message: "Factuurdatum is verplicht" }),
  dueDate: z.coerce.date({ message: "Vervaldatum is verplicht" }),
  vatRate: z.coerce.number().min(0, "BTW mag niet negatief zijn").max(100),
  notes: z.string().optional(),
});

/**
 * Corrigeer een bestaande inkoopfactuur (nummer, datums, BTW%, notitie én de
 * regels). Het nummer BLIJFT BEHOUDEN (je bewerkt hetzelfde record, geen nieuw
 * nummer) — cruciaal voor de archief-correctieflow. Een handmatig aangepast
 * nummer bumpt de per-jaar teller zodat auto-nummering doorloopt. Spiegelt
 * updateInvoice (verkoop) 1-op-1, inclusief de 1-op-1 regel-bijectie-guard.
 */
export async function updatePurchaseInvoice(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { error: "Onbekende inkoopfactuur." };

  const parsed = parseForm(EditPurchaseSchema, formData);
  if (!parsed.success) return parsed.state;
  const d = parsed.data;
  const number = d.number.trim();

  const invoice = await db.purchaseInvoice.findUnique({ where: { id }, include: { lines: true } });
  if (!invoice) return { error: "Onbekende inkoopfactuur." };

  let raw: unknown;
  try {
    raw = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    return { error: "Kon de factuurregels niet lezen." };
  }
  if (!Array.isArray(raw)) return { error: "Ongeldige factuurregels." };

  const validIds = new Set(invoice.lines.map((l) => l.id));
  const seen = new Set<string>();
  const updates: { id: string; description: string; quantity: number; unitPrice: number; amount: number }[] = [];
  for (const r of raw as Array<{ id?: unknown; description?: unknown; quantity?: unknown; unitPrice?: unknown }>) {
    const lineId = String(r.id ?? "");
    if (!validIds.has(lineId) || seen.has(lineId)) continue;
    seen.add(lineId);
    const description = String(r.description ?? "").trim();
    const quantity = Number(r.quantity);
    const unitPrice = Number(r.unitPrice);
    if (!description) return { error: "Elke factuurregel heeft een omschrijving nodig." };
    if (!Number.isFinite(quantity) || quantity < 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      return { error: "Vul geldige (niet-negatieve) aantallen en tarieven in." };
    }
    const amount = round2(quantity * unitPrice);
    if (!Number.isFinite(amount)) return { error: "Een bedrag is te groot om te verwerken." };
    updates.push({ id: lineId, description, quantity, unitPrice, amount });
  }
  if (updates.length !== invoice.lines.length) {
    return { error: "De factuurregels konden niet volledig worden gelezen." };
  }

  const subtotal = round2(updates.reduce((s, l) => s + l.amount, 0));
  const vatAmount = round2((subtotal * d.vatRate) / 100);
  const total = round2(subtotal + vatAmount);
  if (!Number.isFinite(subtotal) || !Number.isFinite(vatAmount) || !Number.isFinite(total)) {
    return { error: "Het totaalbedrag is te groot om te verwerken." };
  }

  const clash = await db.purchaseInvoice.findFirst({ where: { number, id: { not: id } }, select: { id: true } });
  if (clash) return { fieldErrors: { number: "Dit factuurnummer is al in gebruik." } };

  await db.$transaction(async (tx) => {
    for (const l of updates) {
      await tx.purchaseInvoiceLine.update({
        where: { id: l.id },
        data: { description: l.description, quantity: l.quantity, unitPrice: l.unitPrice, amount: l.amount },
      });
    }
    await tx.purchaseInvoice.update({
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
    await reconcileInvoiceSequence(tx, number, "purchase-invoice");
  });

  revalidatePath("/inkoopfacturen");
  revalidatePath(`/inkoopfacturen/${id}`);
  revalidatePath("/verwerken/archief");
  revalidatePath("/", "layout");
  redirect(`/inkoopfacturen/${id}`);
}

/** Change a purchase invoice's status (approve to pay / mark paid / cancel). */
export async function setPurchaseInvoiceStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["DRAFT", "APPROVED", "PAID", "CANCELLED"].includes(status)) return;

  if (status === "CANCELLED") {
    // Cancelling voids the inkoopfactuur: drop the line→timesheet links so the
    // hours can be purchase-invoiced again (otherwise the timesheet keeps its
    // purchaseLine and createPurchaseInvoice skips it forever).
    await db.$transaction([
      db.purchaseInvoiceLine.updateMany({
        where: { purchaseInvoiceId: id, timesheetId: { not: null } },
        data: { timesheetId: null },
      }),
      db.purchaseInvoice.update({
        where: { id },
        data: { status: "CANCELLED", paidDate: null },
      }),
    ]);
  } else {
    await db.purchaseInvoice.update({
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

  revalidatePath("/inkoopfacturen");
  revalidatePath("/", "layout");
  revalidatePath("/uren");
  revalidatePath(`/inkoopfacturen/${id}`);
  redirect(`/inkoopfacturen/${id}`);
}

/**
 * Delete a non-paid purchase invoice. Its lines cascade, which releases the
 * timesheets so they can be purchase-invoiced again.
 */
export async function deletePurchaseInvoice(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const inv = await db.purchaseInvoice.findUnique({ where: { id } });
  if (!inv) return;
  if (inv.status === "PAID") {
    redirect(`/inkoopfacturen/${id}?error=locked`);
  }

  await db.purchaseInvoice.delete({ where: { id } });
  revalidatePath("/inkoopfacturen");
  revalidatePath("/", "layout");
  revalidatePath("/uren");
  redirect("/inkoopfacturen");
}
