import type { Prisma } from "@prisma/client";

/** De melding bij een factuurnummer dat al bestaat — overal dezelfde tekst. */
export const DUPLICAAT_FACTUURNUMMER = "Dit factuurnummer bestaat al.";

/** Langer dan dit is geen factuurnummer meer maar een typefout. */
const MAX_NUMBER_LENGTH = 64;

const toCount = (n: number) => (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);

/**
 * PUUR. Het volgnummer dat de VOLGENDE automatische factuur moet krijgen, gegeven
 * de huidige stand van de jaarteller (`current`) en het ingestelde startnummer
 * (`start`, instelling "Facturen doorlopend nummeren vanaf").
 *
 * Twee regels die niet mogen wankelen:
 *   - Staat de teller nog onder het startnummer, dan springt de nummering naar
 *     het startnummer.
 *   - De uitkomst is ALTIJD groter dan `current`: een al uitgegeven nummer wordt
 *     nooit hergebruikt, ook niet als iemand het startnummer verlaagt.
 */
export function effectiveNextSequence(opts: { current: number; start: number }): number {
  const current = toCount(opts.current);
  const start = Math.max(1, toCount(opts.start) || 1);
  return Math.max(current + 1, start);
}

/**
 * PUUR. De tellerstand die de NumberSequence minimaal moet hebben vóór het
 * ophogen, zodat het ophogen precies `effectiveNextSequence` oplevert. Nooit
 * lager dan de huidige stand — de teller loopt geen enkele keer terug.
 */
export function sequenceBaseline(opts: { current: number; start: number }): number {
  return effectiveNextSequence(opts) - 1;
}

export type ManualNumberResult =
  | { ok: true; number: string }
  | { ok: false; error: string };

/**
 * PUUR. Een handmatig ingetypt factuurnummer opschonen en controleren. `taken`
 * bevat de nummers van de ANDERE facturen (de factuur zelf mag zijn eigen nummer
 * houden); zit het nummer daartussen, dan wordt het geweigerd. De database heeft
 * daarnaast nog een unieke index als laatste vangnet.
 */
export function parseManualInvoiceNumber(
  raw: unknown,
  opts?: { taken?: Iterable<string> },
): ManualNumberResult {
  if (typeof raw !== "string") return { ok: false, error: "Factuurnummer is verplicht." };
  const number = raw.trim().replace(/\s+/g, " ");
  if (!number) return { ok: false, error: "Factuurnummer is verplicht." };
  if (number.length > MAX_NUMBER_LENGTH)
    return {
      ok: false,
      error: `Dit factuurnummer is te lang (maximaal ${MAX_NUMBER_LENGTH} tekens).`,
    };
  for (const t of opts?.taken ?? []) {
    if (t.trim() === number) return { ok: false, error: DUPLICAAT_FACTUURNUMMER };
  }
  return { ok: true, number };
}

/**
 * Generate the next sequential invoice number for a given year, atomically.
 * MUST be called inside a Prisma transaction (`tx`) so the counter and the
 * invoice are created together. Produces e.g. "Q4S-2026-0001".
 *
 * `startNumber` = de instelling "Facturen doorlopend nummeren vanaf". De teller
 * wordt daarvoor eerst OPGETROKKEN naar `startNumber - 1` — alleen als hij lager
 * staat (`value < baseline`), zodat een al verder gelopen jaar nooit terugvalt en
 * er dus nooit een nummer hergebruikt wordt.
 */
export async function nextInvoiceNumber(
  tx: Prisma.TransactionClient,
  opts: { year: number; prefix?: string; startNumber?: number },
): Promise<string> {
  const key = `invoice-${opts.year}`;
  // current: 0 → de baseline die het startnummer alléén eist; de `lt`-filter
  // hieronder zorgt dat een hogere bestaande stand blijft staan.
  const baseline = sequenceBaseline({ current: 0, start: opts.startNumber ?? 1 });
  if (baseline > 0) {
    await tx.numberSequence.upsert({ where: { key }, create: { key, value: baseline }, update: {} });
    await tx.numberSequence.updateMany({
      where: { key, value: { lt: baseline } },
      data: { value: baseline },
    });
  }
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
