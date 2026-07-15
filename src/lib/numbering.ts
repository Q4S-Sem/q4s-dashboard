import type { Prisma } from "@prisma/client";

/**
 * Generate the next sequential invoice number for a given year, atomically.
 * MUST be called inside a Prisma transaction (`tx`) so the counter and the
 * invoice are created together. Produces e.g. "Q4S-2026-0001".
 */
export async function nextInvoiceNumber(
  tx: Prisma.TransactionClient,
  opts: { year: number; prefix?: string },
): Promise<string> {
  const key = `invoice-${opts.year}`;
  const seq = await tx.numberSequence.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  const seqNo = String(seq.value).padStart(4, "0");
  return `${opts.prefix ?? ""}${opts.year}-${seqNo}`;
}

/**
 * Next sequential PURCHASE (self-billing) invoice number for a year, atomically.
 * MUST run inside a Prisma transaction. Produces e.g. "INK-2026-0001".
 */
export async function nextPurchaseInvoiceNumber(
  tx: Prisma.TransactionClient,
  opts: { year: number; prefix?: string },
): Promise<string> {
  const key = `purchase-invoice-${opts.year}`;
  const seq = await tx.numberSequence.upsert({
    where: { key },
    create: { key, value: 1 },
    update: { value: { increment: 1 } },
  });
  const seqNo = String(seq.value).padStart(4, "0");
  return `${opts.prefix ?? "INK-"}${opts.year}-${seqNo}`;
}

/**
 * After a manually-edited invoice number, bump the per-year sequence counter so
 * auto-generated numbers keep running AFTER it (no future collisions). Parses a
 * trailing "YYYY-NNNN" from the number; free-form numbers are ignored. MUST run
 * inside a transaction.
 */
export async function reconcileInvoiceSequence(
  tx: Prisma.TransactionClient,
  number: string,
  keyPrefix: "invoice" | "purchase-invoice" = "invoice",
): Promise<void> {
  const m = /(\d{4})-(\d+)\s*$/.exec(number);
  if (!m) return;
  const year = Number(m[1]);
  const seq = Number(m[2]);
  // Ignore implausible manual sequences (more digits than the NNNN padding) so a
  // fat-finger like "...-99999" can't poison the year's auto-counter.
  if (m[2].length > 4 || seq > 9999) return;
  const key = `${keyPrefix}-${year}`;
  const existing = await tx.numberSequence.findUnique({ where: { key } });
  if (!existing) {
    await tx.numberSequence.create({ data: { key, value: seq } });
  } else if (seq > existing.value) {
    await tx.numberSequence.update({ where: { key }, data: { value: seq } });
  }
}
