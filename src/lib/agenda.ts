import { db } from "./db";

// Helpers + derived data for the Agenda app.

const WEEKDAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const MONTHS = [
  "januari",
  "februari",
  "maart",
  "april",
  "mei",
  "juni",
  "juli",
  "augustus",
  "september",
  "oktober",
  "november",
  "december",
];

export { WEEKDAYS, MONTHS };

export function monthLabel(year: number, month: number): string {
  return `${MONTHS[month]} ${year}`;
}

/** "YYYY-MM" key for month navigation links. */
export function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

/** Build the Monday-first 6×7 day matrix that covers `month` (0-based). */
export function monthMatrix(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7; // 0 = Monday
  const weeks: Date[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: Date[] = [];
    for (let d = 0; d < 7; d++) {
      row.push(new Date(year, month, 1 - startOffset + w * 7 + d));
    }
    weeks.push(row);
  }
  return weeks;
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** Stable per-day grouping key. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function formatTime(d: Date | string): string {
  return new Date(d).toLocaleTimeString("nl-NL", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// --- Derived deadlines: open invoices + expiring certificates ---

export type DeadlineKind = "SALES_INVOICE" | "PURCHASE_INVOICE" | "CERTIFICATE";

export type AgendaDeadline = {
  date: Date;
  kind: DeadlineKind;
  title: string;
  href: string;
  overdue: boolean;
};

/**
 * Automatic agenda items derived from the rest of the system: open sales
 * invoices (their due dates), self-billing purchase invoices still to be paid,
 * and certificates that expire. Computed live — no stored rows — so they stay
 * in sync with Facturatie and the personeelsdossier.
 */
export async function getDeadlines(
  start: Date,
  end: Date,
): Promise<AgendaDeadline[]> {
  const today = startOfDay(new Date());

  const [sales, purchases, certs] = await Promise.all([
    db.invoice.findMany({
      where: { status: { in: ["SENT", "OVERDUE"] }, dueDate: { gte: start, lt: end } },
      include: { client: true },
    }),
    db.purchaseInvoice.findMany({
      where: { status: "APPROVED", dueDate: { gte: start, lt: end } },
      include: { consultant: true },
    }),
    db.certificate.findMany({
      where: { expiryDate: { gte: start, lt: end } },
      include: { consultant: true },
    }),
  ]);

  const out: AgendaDeadline[] = [];

  for (const inv of sales) {
    out.push({
      date: inv.dueDate,
      kind: "SALES_INVOICE",
      title: `Factuur ${inv.number} — ${inv.client.companyName}`,
      href: `/facturen/${inv.id}`,
      overdue: inv.dueDate < today,
    });
  }
  for (const p of purchases) {
    out.push({
      date: p.dueDate,
      kind: "PURCHASE_INVOICE",
      title: `Inkoopfactuur ${p.number} betalen — ${p.consultant.firstName} ${p.consultant.lastName}`,
      href: `/inkoopfacturen/${p.id}`,
      overdue: p.dueDate < today,
    });
  }
  for (const c of certs) {
    if (!c.expiryDate) continue;
    out.push({
      date: c.expiryDate,
      kind: "CERTIFICATE",
      title: `Certificaat verloopt: ${c.name} — ${c.consultant.firstName} ${c.consultant.lastName}`,
      href: `/werknemers/${c.consultantId}`,
      overdue: c.expiryDate < today,
    });
  }

  return out.sort((a, b) => a.date.getTime() - b.date.getTime());
}
