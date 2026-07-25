import { db } from "./db";
import { round2, getISOWeek } from "./utils";
import { nextInvoiceNumber, nextPurchaseInvoiceNumber } from "./numbering";
import { getCompanySettings } from "./settings";
import { buildTimesheetLines } from "./toeslag";

export type InvoiceResult =
  | { ok: true; invoiceId: string }
  | { ok: false; error: string };

export type PurchaseResult =
  | { ok: true; purchaseInvoiceId: string }
  | { ok: false; error: string };

/**
 * Create a SALES invoice (to the client) from APPROVED timesheets at the
 * placement's charge rate (incl. Q4S margin). Marks the timesheets INVOICED.
 * Amounts are computed server-side. Atomic: sequence + invoice + status update.
 */
export async function createSalesInvoice(opts: {
  clientId: string;
  timesheetIds: string[];
  issueDate: Date;
  notes: string | null;
}): Promise<InvoiceResult> {
  const { clientId, timesheetIds, issueDate, notes } = opts;
  if (!clientId) return { ok: false, error: "Geen klant geselecteerd." };
  if (timesheetIds.length === 0)
    return { ok: false, error: "Selecteer minimaal één goedgekeurde urenstaat." };

  const client = await db.client.findUnique({ where: { id: clientId } });
  if (!client) return { ok: false, error: "Onbekende klant." };

  const timesheets = await db.timesheet.findMany({
    where: { id: { in: timesheetIds }, status: "APPROVED", placement: { clientId } },
    include: { entries: true, placement: { include: { consultant: true } } },
  });
  if (timesheets.length === 0)
    return { ok: false, error: "Geen geldige (goedgekeurde) urenstaten gevonden." };

  const settings = await getCompanySettings();
  const vatRate = settings.defaultVatRate ?? 21;

  const lines = timesheets.flatMap((t) => {
    const consultantName = `${t.placement.consultant.firstName} ${t.placement.consultant.lastName}`;
    return buildTimesheetLines({
      timesheetId: t.id,
      placementId: t.placementId,
      weekNumber: getISOWeek(t.weekStart),
      location: t.placement.workLocation ?? null,
      baseDescription: `Totaal uren ${consultantName}`,
      entries: t.entries,
      overtimeHours: t.overtimeHours,
      kilometers: t.kilometers,
      rate: t.placement.chargeRate, // verkoop
      weekendPct: t.placement.weekendSurchargeSell,
      overtimePct: t.placement.overtimeSurchargeSell,
      kmRate: t.placement.kmRateSell,
    });
  });

  // Kop-velden (Subject/Services): één medewerker/functie per factuur → tonen; bij
  // een gebundelde factuur met meerdere personen/functies laten we ze leeg.
  const consultantNames = new Set(
    timesheets.map((t) => `${t.placement.consultant.firstName} ${t.placement.consultant.lastName}`),
  );
  const titles = new Set(timesheets.map((t) => t.placement.title));
  const subject = consultantNames.size === 1 ? [...consultantNames][0] : null;
  const services = titles.size === 1 ? [...titles][0] : null;

  const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  const vatAmount = round2((subtotal * vatRate) / 100);
  const total = round2(subtotal + vatAmount);
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + (client.paymentTermDays ?? 30));
  const year = issueDate.getFullYear();

  const invoice = await db.$transaction(async (tx) => {
    const number = await nextInvoiceNumber(tx, { year, prefix: settings.invoicePrefix || "" });
    const inv = await tx.invoice.create({
      data: {
        number, clientId, issueDate, dueDate, status: "DRAFT", vatRate, subtotal, vatAmount, total, notes,
        subject, services,
        lines: {
          create: lines.map((l) => ({
            description: l.description, quantity: l.quantity, unitPrice: l.unitPrice,
            amount: l.amount, placementId: l.placementId, timesheetId: l.timesheetId,
            weekNumber: l.weekNumber, location: l.location, lineKind: l.lineKind,
          })),
        },
      },
    });
    await tx.timesheet.updateMany({
      where: { id: { in: timesheets.map((t) => t.id) } },
      data: { status: "INVOICED" },
    });
    return inv;
  });

  return { ok: true, invoiceId: invoice.id };
}

/**
 * Create a PURCHASE (self-billing) invoice to pay the consultant, from their
 * APPROVED/INVOICED timesheets at the placement's COST rate. Only timesheets
 * that aren't already on a purchase invoice are eligible.
 */
export async function createPurchaseInvoice(opts: {
  consultantId: string;
  timesheetIds: string[];
  issueDate: Date;
  notes: string | null;
}): Promise<PurchaseResult> {
  const { consultantId, timesheetIds, issueDate, notes } = opts;
  if (!consultantId) return { ok: false, error: "Geen werknemer geselecteerd." };
  if (timesheetIds.length === 0)
    return { ok: false, error: "Selecteer minimaal één urenstaat." };

  const consultant = await db.consultant.findUnique({ where: { id: consultantId } });
  if (!consultant) return { ok: false, error: "Onbekende werknemer." };
  // Eigen loondienst-personeel krijgt GÉÉN inkoopfactuur — dat is salaris. Alleen
  // de verkoopfactuur naar de klant. (De verwerken-flow slaat dit al over; dit is
  // de vangnet-guard voor handmatige aanroepen.)
  if (consultant.employmentType === "LOONDIENST")
    return {
      ok: false,
      error: "Loondienst-personeel krijgt geen inkoopfactuur (salaris) — alleen de verkoopfactuur naar de klant.",
    };

  const timesheets = await db.timesheet.findMany({
    where: {
      id: { in: timesheetIds },
      status: { in: ["APPROVED", "INVOICED"] },
      placement: { consultantId },
      purchaseLine: null, // not already on a purchase invoice
    },
    include: { entries: true, placement: true },
  });
  if (timesheets.length === 0)
    return {
      ok: false,
      error: "Geen geldige urenstaten gevonden (niet goedgekeurd of al verwerkt).",
    };

  const settings = await getCompanySettings();
  const vatRate = settings.defaultVatRate ?? 21;

  const consultantName = `${consultant.firstName} ${consultant.lastName}`;
  const lines = timesheets.flatMap((t) =>
    buildTimesheetLines({
      timesheetId: t.id,
      placementId: t.placementId,
      weekNumber: getISOWeek(t.weekStart),
      location: t.placement.workLocation ?? null,
      baseDescription: `Totaal uren ${consultantName}`,
      entries: t.entries,
      overtimeHours: t.overtimeHours,
      kilometers: t.kilometers,
      rate: t.placement.costRate, // inkoop
      weekendPct: t.placement.weekendSurchargeBuy,
      overtimePct: t.placement.overtimeSurchargeBuy,
      kmRate: t.placement.kmRateBuy,
    }),
  );

  const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  const vatAmount = round2((subtotal * vatRate) / 100);
  const total = round2(subtotal + vatAmount);
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + 14);
  const year = issueDate.getFullYear();

  const pinv = await db.$transaction(async (tx) => {
    const number = await nextPurchaseInvoiceNumber(tx, { year });
    return tx.purchaseInvoice.create({
      data: {
        number, consultantId, issueDate, dueDate, status: "DRAFT", vatRate, subtotal, vatAmount, total, notes,
        lines: {
          create: lines.map((l) => ({
            description: l.description, quantity: l.quantity, unitPrice: l.unitPrice,
            amount: l.amount, placementId: l.placementId, timesheetId: l.timesheetId,
          })),
        },
      },
    });
  });

  return { ok: true, purchaseInvoiceId: pinv.id };
}
