"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSalesInvoice } from "@/lib/invoicing";
import {
  DUPLICAAT_FACTUURNUMMER,
  parseManualInvoiceNumber,
  reconcileInvoiceSequence,
} from "@/lib/numbering";
import {
  isDeletableInvoice,
  isReleasableInvoice,
  isSendableInvoice,
  parseBulkIds,
  partitionBulk,
} from "@/lib/factuur-bulk";
import { sendSalesInvoiceById, type SendOutcome } from "@/lib/send-invoice";
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
  const cleaned = parseManualInvoiceNumber(d.number);
  if (!cleaned.ok) return { fieldErrors: { number: cleaned.error } };
  const number = cleaned.number;

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

  // Dubbel nummer? Eerst netjes controleren (leesbare melding), en daarna nóg een
  // keer opvangen op de unieke index — die is het echte slot, ook als iemand er
  // tussendoor dezelfde nummer opslaat.
  const clash = await db.invoice.findFirst({
    where: { number, id: { not: id } },
    select: { id: true },
  });
  if (clash) return { fieldErrors: { number: DUPLICAAT_FACTUURNUMMER } };

  try {
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
      // Handmatig nummer → de jaarteller meetrekken, zodat de automatische
      // nummering hierna verdergaat NA dit nummer (nooit er weer overheen).
      await reconcileInvoiceSequence(tx, number);
    });
  } catch (cause) {
    if ((cause as { code?: string }).code === "P2002")
      return { fieldErrors: { number: DUPLICAAT_FACTUURNUMMER } };
    throw cause;
  }

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

/** Change an invoice's status (concept / klaar voor verzending / sent / paid / cancelled). */
export async function setInvoiceStatus(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !["DRAFT", "READY", "SENT", "PAID", "CANCELLED"].includes(status)) return;

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
  revalidatePath("/verzenden");
  revalidatePath("/", "layout");
  revalidatePath("/uren");
  revalidatePath(`/facturen/${id}`);
  redirect(`/facturen/${id}`);
}

function revalidateFacturen() {
  revalidatePath("/facturen");
  revalidatePath("/verzenden");
  revalidatePath("/", "layout");
  revalidatePath("/uren");
}

/**
 * Verwijder één factuur en zet haar urenstaten terug op APPROVED, zodat de uren
 * opnieuw gefactureerd kunnen worden. Alleen concept/geannuleerd mag weg
 * (`isDeletableInvoice`) — verstuurd/betaald is administratie. Deze kern draait
 * onder zowel de losse verwijderknop als de bulkactie, zodat de grens overal
 * dezelfde is.
 */
async function removeInvoice(id: string): Promise<"deleted" | "locked" | "missing"> {
  const inv = await db.invoice.findUnique({
    where: { id },
    include: { lines: true },
  });
  if (!inv) return "missing";
  if (!isDeletableInvoice(inv.status)) return "locked";

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
  return "deleted";
}

/**
 * Delete a DRAFT/CANCELLED invoice and release its timesheets back to
 * APPROVED so they can be re-invoiced. Sent/paid invoices are protected.
 */
export async function deleteInvoice(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;

  const res = await removeInvoice(id);
  if (res === "missing") return;
  if (res === "locked") redirect(`/facturen/${id}?error=locked`);

  revalidateFacturen();
  redirect("/facturen");
}

/**
 * Bulk: verwijder de aangevinkte facturen op /facturen. Loopt dezelfde bewaakte
 * `removeInvoice` af, dus verstuurde/betaalde facturen worden overgeslagen (en
 * geteld) in plaats van verwijderd. De bevestiging staat in de UI (ConfirmSubmit).
 */
export async function bulkDeleteInvoices(formData: FormData) {
  const requested = parseBulkIds(formData.get("ids"));
  if (requested.length === 0) redirect("/facturen");

  const rows = await db.invoice.findMany({
    where: { id: { in: requested } },
    select: { id: true, status: true },
  });
  const { ids, skipped } = partitionBulk(requested, rows, isDeletableInvoice);

  let deleted = 0;
  for (const id of ids) {
    if ((await removeInvoice(id)) === "deleted") deleted++;
  }

  revalidateFacturen();
  const p = new URLSearchParams({ verwijderd: String(deleted) });
  if (skipped + (ids.length - deleted) > 0)
    p.set("overgeslagen", String(skipped + (ids.length - deleted)));
  redirect(`/facturen?${p.toString()}`);
}

/**
 * Bulk: verstuur de aangevinkte CONCEPT-facturen. Gebruikt exact de bestaande
 * verzendweg van de verzendmap (`sendSalesInvoiceById`: PDF + mail + atomair
 * claimen van DRAFT → SENT) — geen tweede verzendmechanisme. Alleen concepten
 * gaan mee; al verstuurde/betaalde facturen worden geteld als overgeslagen.
 * Menselijke goedkeuring: dit draait alleen na een expliciete klik + bevestiging.
 */
export async function bulkSendInvoices(formData: FormData) {
  const requested = parseBulkIds(formData.get("ids"));
  if (requested.length === 0) redirect("/facturen");

  const rows = await db.invoice.findMany({
    where: { id: { in: requested } },
    select: { id: true, status: true },
  });
  const { ids, skipped } = partitionBulk(requested, rows, isSendableInvoice);

  let live = 0;
  let simulated = 0;
  let noEmail = 0;
  let failed = 0;
  for (const id of ids) {
    const outcome: SendOutcome = await sendSalesInvoiceById(id);
    if (outcome === "sent") live++;
    else if (outcome === "simulated") simulated++;
    else if (outcome === "no-email") noEmail++;
    else if (outcome === "error") failed++;
    // "already" → een gelijktijdige verzending was ons voor; stil overslaan.
  }

  revalidateFacturen();
  const verstuurd = live + simulated;
  const p = new URLSearchParams({ verzonden: String(verstuurd) });
  p.set("modus", verstuurd > 0 && live === 0 ? "sim" : "live");
  if (skipped > 0) p.set("overgeslagen", String(skipped));
  if (noEmail > 0) p.set("geenmail", String(noEmail));
  if (failed > 0) p.set("mislukt", String(failed));
  redirect(`/facturen?${p.toString()}`);
}

/**
 * Bulk: geef de aangevinkte CONCEPT-facturen vrij naar de verzendmap (DRAFT →
 * READY). Dit VERSTUURT niets — het zet ze klaar zodat je ze vanuit de
 * verzendmap, na een laatste blik op de PDF, echt naar de klant stuurt. Zo is de
 * flow: concept nakijken op /facturen → "Naar verzendmap" → daar versturen.
 * Alleen concepten gaan mee; al vrijgegeven/verzonden facturen worden geteld als
 * overgeslagen.
 */
export async function bulkReleaseInvoices(formData: FormData) {
  const requested = parseBulkIds(formData.get("ids"));
  if (requested.length === 0) redirect("/facturen");

  const rows = await db.invoice.findMany({
    where: { id: { in: requested } },
    select: { id: true, status: true },
  });
  const { ids, skipped } = partitionBulk(requested, rows, isReleasableInvoice);

  // Atomair per rij: alleen een echte DRAFT schuift door naar READY.
  let released = 0;
  for (const id of ids) {
    const res = await db.invoice.updateMany({
      where: { id, status: "DRAFT" },
      data: { status: "READY" },
    });
    released += res.count;
  }

  revalidateFacturen();
  const p = new URLSearchParams({ vrijgegeven: String(released) });
  if (skipped > 0) p.set("overgeslagen", String(skipped));
  redirect(`/facturen?${p.toString()}`);
}
