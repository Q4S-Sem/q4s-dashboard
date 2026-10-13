import type { Prisma } from "@prisma/client";
import { factuurKlantInfo } from "./factuur-klant";
import { voegBonnenToe } from "./declaraties-doorbelasten";
import { db } from "./db";
import { round2, getISOWeek } from "./utils";
import { nextInvoiceNumber } from "./numbering";
import { getCompanySettings } from "./settings";
import { buildTimesheetLines, sideSurcharges } from "./toeslag";

type VerkoopUrenstaat = Prisma.TimesheetGetPayload<{
  include: { entries: true; placement: { include: { consultant: true } } };
}>;

/** De verkoopregels (Engels, tegen het verkooptarief) van één urenstaat. */
export function verkoopRegels(t: VerkoopUrenstaat) {
  const consultantName = `${t.placement.consultant.firstName} ${t.placement.consultant.lastName}`;
  return buildTimesheetLines({
    timesheetId: t.id,
    placementId: t.placementId,
    weekNumber: getISOWeek(t.weekStart),
    location: t.placement.workLocation ?? null,
    baseDescription: `${t.placement.rateUnit === "DAY" ? "Total days" : "Normal hours"} ${consultantName} · ${weekDatums(t.weekStart)}`,
    rateUnit: t.placement.rateUnit,
    otFromHours: t.placement.otFromHours,
    ot1Hours: t.placement.ot1Hours,
    uitsplitsen: true,
    entries: t.entries,
    overtimeHours: t.overtimeHours,
    kilometers: t.kilometers,
    rate: t.placement.chargeRate, // verkoop
    weekendPct: t.placement.weekendSurchargeSell,
    surcharges: sideSurcharges(t.placement, "sell"),
    overtimePct: t.placement.overtimeSurchargeSell,
    overtimeRate: t.placement.overtimeChargeRate,
    kmRate: t.placement.kmRateSell,
    // Verkoopfactuur is Engels → Engelse regelomschrijvingen.
    labels: {
      weekend: (p) => `Weekend hours ${p}%`,
      overtime: (p) => (p > 0 ? `Overtime +${p}%` : "Overtime"),
      km: "Kilometres",
      names: {
        weekday: "Overtime",
        weekday2: "Overtime",
        saturday: "Saturday hours",
        sunday: "Sunday hours",
        offshore: "Offshore surcharge",
        shift: "Shift surcharge",
        abroad: "Foreign posting surcharge",
      },
    },
  });
}

/** "5–11 Oct 2026" (ma t/m zo van de week). */
export function weekDatums(weekStart: Date): string {
  const eind = new Date(weekStart);
  eind.setDate(eind.getDate() + 6);
  const f = (d: Date, o: Intl.DateTimeFormatOptions) => d.toLocaleDateString("en-GB", { timeZone: "Europe/Amsterdam", ...o });
  const zelfdeMaand = f(weekStart, { month: "short" }) === f(eind, { month: "short" });
  return `${f(weekStart, zelfdeMaand ? { day: "numeric" } : { day: "numeric", month: "short" })}–${f(eind, { day: "numeric", month: "short", year: "numeric" })}`;
}

export type InvoiceResult =
  | { ok: true; invoiceId: string }
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
  const baseVatRate = settings.defaultVatRate ?? 21;
  // BTW verlegd: als ALLE plaatsingen op deze factuur "BTW verlegd" hebben, dan
  // is de hele factuur verlegd (0% BTW + verplichte vermelding). Zijn ze gemengd,
  // dan verleggen we niet automatisch — dat vraagt om een aparte factuur per
  // BTW-regime, wat de gebruiker bewust doet.
  // Alleen de VERKOOP-vlag telt: verlegt de ZZP'er de btw naar ons, dan krijgt de klant nog gewoon 21%.
  const reverseFlags = new Set(timesheets.map((t) => t.placement.salesVatReverseCharge));
  const vatReverseCharge = reverseFlags.size === 1 && reverseFlags.has(true);
  const vatRate = vatReverseCharge ? 0 : baseVatRate;

  // Geen werklocatie op de plaatsing → de plaats van de klant in de LOCATION-kolom.
  const lines = timesheets.flatMap(verkoopRegels).map((l) => ({ ...l, location: l.location || client.city || null }));

  // Kop-velden (Subject/Services): één medewerker/functie per factuur → tonen; bij
  // een gebundelde factuur met meerdere personen/functies laten we ze leeg.
  const consultantNames = new Set(
    timesheets.map((t) => `${t.placement.consultant.firstName} ${t.placement.consultant.lastName}`),
  );
  const titles = new Set(timesheets.map((t) => t.placement.title));
  const subject = consultantNames.size === 1 ? [...consultantNames][0] : null;
  const services = titles.size === 1 ? [...titles][0] : null;
  // Our ref = het vaste Q4S-quotationnummer uit de instellingen. PO = het inkoop-
  // ordernummer van de klant, per plaatsing; alleen tonen als alle regels dezelfde
  // (niet-lege) PO delen — anders laten we 'm leeg om verwarring te voorkomen.
  const ourReference = settings.quotationNumber?.trim() || null;
  const { purchaseOrder, attention, projectManager, emailTo } = factuurKlantInfo(
    client,
    timesheets.map((t) => t.placement),
  );

  const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  const vatAmount = round2((subtotal * vatRate) / 100);
  const total = round2(subtotal + vatAmount);
  const dueDate = new Date(issueDate);
  dueDate.setDate(dueDate.getDate() + (client.paymentTermDays ?? 30));
  const year = issueDate.getFullYear();

  const invoice = await db.$transaction(async (tx) => {
    const number = await nextInvoiceNumber(tx, {
      year,
      prefix: settings.invoicePrefix || "",
      startNumber: settings.invoiceStartNumber ?? 1,
    });
    const inv = await tx.invoice.create({
      data: {
        number, clientId, issueDate, dueDate, status: "DRAFT", vatRate, subtotal, vatAmount, total, notes,
        vatReverseCharge,
        subject, services, ourReference, purchaseOrder, attention, projectManager, emailTo,
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
    // Goedgekeurde declaraties met "doorbelasten" van deze personen gaan mee.
    const plaatsingVan = new Map(
      timesheets.map((t) => [
        t.placement.consultantId,
        {
          placementId: t.placementId,
          naam: `${t.placement.consultant.firstName} ${t.placement.consultant.lastName}`,
          location: t.placement.workLocation ?? null,
        },
      ]),
    );
    const erbij = await voegBonnenToe(tx, inv.id, plaatsingVan);
    if (erbij > 0) {
      const sub = round2(subtotal + erbij);
      const btw = round2((sub * vatRate) / 100);
      return tx.invoice.update({ where: { id: inv.id }, data: { subtotal: sub, vatAmount: btw, total: round2(sub + btw) } });
    }
    return inv;
  });

  return { ok: true, invoiceId: invoice.id };
}

/**
 * Plaatsing of bedrijf aangepast → nog niet verstuurde facturen (concept /
 * verzendmap) van dat bedrijf krijgen de nieuwe t.a.v./projectmanager/e-mail/
 * referentie. Verstuurde facturen blijven zoals ze de deur uit gingen.
 */
export async function verversFactuurKlantInfo(clientId: string | null | undefined) {
  if (!clientId) return;
  const [client, invoices] = await Promise.all([
    db.client.findUnique({ where: { id: clientId } }),
    db.invoice.findMany({
      where: { clientId, status: { in: ["DRAFT", "READY"] } },
      select: { id: true, lines: { select: { placement: true } } },
    }),
  ]);
  if (!client) return;
  for (const inv of invoices) {
    const ps = inv.lines.map((l) => l.placement).filter((p): p is NonNullable<typeof p> => p != null);
    if (!ps.length) continue; // handmatige factuur zonder plaatsing: niet aanraken
    await db.invoice.update({ where: { id: inv.id }, data: factuurKlantInfo(client, ps) });
  }
}
