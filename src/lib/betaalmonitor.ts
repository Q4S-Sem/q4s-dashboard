import { db } from "./db";
import { round2 } from "./utils";
import { ZZP_PAYMENT_TERM_DAYS } from "./betalingen";

// ---------------------------------------------------------------------------
// Betaalmonitor: houdt de INKOMENDE betalingen (verkoopfacturen — klanten betalen
// Q4S) én de UITGAANDE (inkoopfacturen — Q4S betaalt ZZP'ers) bij, signaleert wat
// te laat is, en levert de lijst facturen die een betalingsherinnering verdienen.
// ---------------------------------------------------------------------------

/** Standaard: stuur een herinnering vanaf X dagen te laat. */
export const REMINDER_THRESHOLD_DAYS = Number(process.env.REMINDER_THRESHOLD_DAYS) || 5;
/** Niet vaker dan eens per zoveel dagen opnieuw herinneren (anti-spam). */
const REMINDER_COOLDOWN_DAYS = 7;

const DAY = 86_400_000;

export type MonitorRow = {
  id: string;
  number: string;
  partyName: string;
  issueDate: Date;
  dueDate: Date;
  total: number;
  status: string;
  paidDate: Date | null;
  daysOverdue: number;
  reminderCount: number;
  reminderSentAt: Date | null;
};

export type MonitorSide = {
  openCount: number;
  openTotal: number;
  overdueCount: number;
  overdueTotal: number;
  paidCount: number;
  paidTotal: number;
  open: MonitorRow[];
  overdue: MonitorRow[];
};

export type PaymentMonitor = {
  incoming: MonitorSide;
  outgoing: MonitorSide;
  reminderThresholdDays: number;
  remindable: MonitorRow[];
};

function daysOverdue(dueDate: Date, now: Date): number {
  const diff = now.getTime() - new Date(dueDate).getTime();
  return diff > 0 ? Math.floor(diff / DAY) : 0;
}

function summarize(open: MonitorRow[], paid: { total: number }[]): MonitorSide {
  const overdue = open
    .filter((r) => r.daysOverdue > 0)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);
  return {
    openCount: open.length,
    openTotal: round2(open.reduce((s, r) => s + r.total, 0)),
    overdueCount: overdue.length,
    overdueTotal: round2(overdue.reduce((s, r) => s + r.total, 0)),
    paidCount: paid.length,
    paidTotal: round2(paid.reduce((s, r) => s + r.total, 0)),
    open,
    overdue,
  };
}

export async function paymentMonitor(now = new Date()): Promise<PaymentMonitor> {
  const [sales, purchases] = await Promise.all([
    db.invoice.findMany({
      where: { status: { in: ["SENT", "PAID"] } },
      include: { client: { select: { companyName: true } } },
    }),
    db.purchaseInvoice.findMany({
      where: { status: { in: ["DRAFT", "APPROVED", "PAID"] } },
      include: { consultant: { select: { firstName: true, lastName: true, companyName: true } } },
    }),
  ]);

  // Inkomend (verkoop): open = SENT, betaald = PAID; te laat = SENT + vervaldatum verstreken.
  const salesOpen = sales
    .filter((i) => i.status === "SENT")
    .map<MonitorRow>((i) => ({
      id: i.id,
      number: i.number,
      partyName: i.client.companyName,
      issueDate: i.issueDate,
      dueDate: i.dueDate,
      total: i.total,
      status: i.status,
      paidDate: i.paidDate,
      daysOverdue: daysOverdue(i.dueDate, now),
      reminderCount: i.reminderCount,
      reminderSentAt: i.reminderSentAt,
    }));
  const incoming = summarize(
    salesOpen,
    sales.filter((i) => i.status === "PAID"),
  );

  // Uitgaand (inkoop): open = DRAFT/APPROVED, betaald = PAID. "Moet betaald zijn"-datum
  // = factuurdatum + ZZP-termijn (30d), consistent met de SEPA-betalingen.
  const purchOpen = purchases
    .filter((p) => p.status !== "PAID")
    .map<MonitorRow>((p) => {
      const payBy = new Date(p.issueDate);
      payBy.setDate(payBy.getDate() + ZZP_PAYMENT_TERM_DAYS);
      const name = p.consultant.companyName?.trim() || `${p.consultant.firstName} ${p.consultant.lastName}`;
      return {
        id: p.id,
        number: p.number,
        partyName: name,
        issueDate: p.issueDate,
        dueDate: payBy,
        total: p.total,
        status: p.status,
        paidDate: p.paidDate,
        daysOverdue: daysOverdue(payBy, now),
        reminderCount: 0,
        reminderSentAt: null,
      };
    });
  const outgoing = summarize(
    purchOpen,
    purchases.filter((p) => p.status === "PAID"),
  );

  // Herinnerbaar: inkomende facturen >= drempel te laat die niet recent al herinnerd zijn.
  const cooldownMs = REMINDER_COOLDOWN_DAYS * DAY;
  const remindable = incoming.overdue.filter(
    (r) =>
      r.daysOverdue >= REMINDER_THRESHOLD_DAYS &&
      (!r.reminderSentAt || now.getTime() - new Date(r.reminderSentAt).getTime() >= cooldownMs),
  );

  return { incoming, outgoing, reminderThresholdDays: REMINDER_THRESHOLD_DAYS, remindable };
}
