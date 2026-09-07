import { round2 } from "./utils";

// ---------------------------------------------------------------------------
// Toeslagen (weekend/overuren) + kilometervergoeding — per placement (persoon).
// THE single source of truth: invoicing (src/lib/invoicing.ts), the guided flow
// aggregations (src/lib/facturatie.ts) and the urenstaat detail all compute the
// same amounts here, so the wizard preview always equals the generated invoice.
//
// Model:
//  - WEEKEND-uren zitten al ín de dagregels (dus in de basis). De weekendtoeslag
//    is daarom een EXTRA bedrag BOVENOP de basis — alleen het toeslagdeel.
//  - OVERUREN staan NIET in de dagregels; ze worden apart opgegeven. Het zijn
//    dus EXTRA uren die volledig betaald/gefactureerd worden tegen het opgehoogde
//    uurtarief (tarief + toeslag), precies zoals de freelancer ze factureert
//    (3 u × €84,70 bij €77 + 10%). Bij 0% toeslag blijft dat uren × tarief.
// "Buy" = inkoop (what we pay the consultant), "Sell" = verkoop (what we charge
// the client). Zonder overuren en met alle percentages op 0 is dit identiek aan
// het oude uren×tarief-gedrag.
// ---------------------------------------------------------------------------

/** The per-placement surcharge configuration (+ the base hourly rates). */
export type SurchargeConfig = {
  costRate: number;
  chargeRate: number;
  weekendSurchargeBuy: number; // % uplift on cost rate for weekend hours
  weekendSurchargeSell: number; // % uplift on charge rate for weekend hours
  overtimeSurchargeBuy: number; // % uplift on cost rate for overtime hours (extra uren)
  overtimeSurchargeSell: number; // % uplift on charge rate for overtime hours (extra uren)
  kmRateBuy: number; // €/km reimbursed to the consultant
  kmRateSell: number; // €/km charged to the client
};

export type TimesheetInput = {
  entries: { date: Date; hours: number }[];
  overtimeHours: number | null;
  kilometers: number | null;
};

/** Saturday or Sunday (local). Weekend hours usually carry a toeslag. */
export function isWeekendDate(d: Date): boolean {
  const g = new Date(d).getDay();
  return g === 0 || g === 6;
}

export function weekendHoursOf(entries: { date: Date; hours: number }[]): number {
  return round2(
    entries.filter((e) => isWeekendDate(e.date)).reduce((s, e) => s + e.hours, 0),
  );
}

/** Per-hour surcharge amount, e.g. €40/u at +50% → €20/u. Rounded to cents so
 *  the invoice line (qty × unitPrice) and any preview agree to the cent. */
export function surchargeUnit(rate: number, pct: number): number {
  return round2((rate * pct) / 100);
}

/** One side's (buy or sell) cost broken into its components.
 *  `weekend` = alléén het toeslagdeel (de uren zitten al in `base`).
 *  `overtime` = de VOLLEDIGE overurenbeloning (uren × opgehoogd tarief), want
 *  overuren staan niet in de dagregels en dus niet in `base`. */
export type SideBreakdown = {
  base: number;
  weekend: number;
  overtime: number;
  km: number;
  total: number;
};

/** Het uurtarief inclusief toeslag, bijv. €77 + 10% → €84,70. Op centen
 *  afgerond zodat regel (aantal × stukprijs) en totaal gelijk blijven. */
export function upliftedRate(rate: number, pct: number): number {
  return round2(rate + surchargeUnit(rate, pct));
}

function computeSide(
  hours: number,
  weekendHours: number,
  overtimeHours: number,
  kilometers: number,
  rate: number,
  weekendPct: number,
  overtimePct: number,
  kmRate: number,
): SideBreakdown {
  const base = round2(hours * rate);
  const weekend =
    weekendPct > 0 && weekendHours > 0
      ? round2(weekendHours * surchargeUnit(rate, weekendPct))
      : 0;
  // Overuren zijn EXTRA uren (niet in `hours`), dus inclusief het basistarief.
  const overtime =
    overtimeHours > 0 ? round2(overtimeHours * upliftedRate(rate, overtimePct)) : 0;
  const km = kmRate > 0 && kilometers > 0 ? round2(kilometers * kmRate) : 0;
  return { base, weekend, overtime, km, total: round2(base + weekend + overtime + km) };
}

export type TimesheetMoney = {
  hours: number; // reguliere (dag)uren — de basis voor het uurbedrag
  workedHours: number; // TOTAAL gewerkt = reguliere uren + overuren (voor de weergave)
  weekendHours: number;
  overtimeHours: number;
  kilometers: number;
  sell: SideBreakdown;
  buy: SideBreakdown;
  margin: number; // sell.total − buy.total
};

/** Full money breakdown for one timesheet under a placement's config. */
export function computeTimesheetMoney(
  t: TimesheetInput,
  p: SurchargeConfig,
): TimesheetMoney {
  const hours = round2(t.entries.reduce((s, e) => s + e.hours, 0));
  const weekendHours = weekendHoursOf(t.entries);
  const overtimeHours = t.overtimeHours ?? 0;
  const kilometers = t.kilometers ?? 0;
  const sell = computeSide(
    hours, weekendHours, overtimeHours, kilometers,
    p.chargeRate, p.weekendSurchargeSell, p.overtimeSurchargeSell, p.kmRateSell,
  );
  const buy = computeSide(
    hours, weekendHours, overtimeHours, kilometers,
    p.costRate, p.weekendSurchargeBuy, p.overtimeSurchargeBuy, p.kmRateBuy,
  );
  return {
    hours,
    workedHours: round2(hours + overtimeHours),
    weekendHours,
    overtimeHours,
    kilometers,
    sell,
    buy,
    margin: round2(sell.total - buy.total),
  };
}

/** An invoice/purchase line, shaped for both InvoiceLine and PurchaseInvoiceLine.
 *  weekNumber/location/lineKind vullen de Q4S-factuurkolommen WEEK/LOCATION (alleen
 *  de sales-InvoiceLine slaat ze op; PurchaseInvoiceLine negeert ze). */
export type BuiltLine = {
  timesheetId: string | null;
  placementId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  weekNumber: number | null;
  location: string | null;
  /** HOURS | KM | SURCHARGE */
  lineKind: string;
};

/**
 * Build the invoice lines for ONE timesheet on a given side. The BASE line keeps
 * the `timesheetId` link (used for the invoiced-lock and dedup); the surcharge
 * and km lines carry `timesheetId: null` (the @unique on timesheetId allows only
 * one linked line per timesheet, and SQLite treats NULLs as distinct).
 */
export function buildTimesheetLines(opts: {
  timesheetId: string;
  placementId: string;
  weekNumber: number | null;
  location: string | null;
  baseDescription: string;
  entries: { date: Date; hours: number }[];
  overtimeHours: number | null;
  kilometers: number | null;
  rate: number;
  weekendPct: number;
  overtimePct: number;
  kmRate: number;
  /** Optionele label-overrides (bijv. Engels voor de verkoopfactuur). Default NL. */
  labels?: {
    weekend?: (pct: number) => string;
    overtime?: (pct: number) => string;
    km?: string;
  };
}): BuiltLine[] {
  const wkLabel = opts.labels?.weekend ?? ((p: number) => `Weekendtoeslag ${p}%`);
  const otLabel =
    opts.labels?.overtime ?? ((p: number) => (p > 0 ? `Overuren +${p}%` : "Overuren"));
  const kmLabel = opts.labels?.km ?? "Kilometers";
  const hours = round2(opts.entries.reduce((s, e) => s + e.hours, 0));
  const weekendHours = weekendHoursOf(opts.entries);
  const ot = opts.overtimeHours ?? 0;
  const km = opts.kilometers ?? 0;
  // Week/locatie komen op elke regel; de WEEK/AMOUNT-kolommen tonen het weeknr en
  // aantal, dus de omschrijving blijft kort (geen weeklabel/aantal in de tekst).
  const meta = { weekNumber: opts.weekNumber, location: opts.location };

  const lines: BuiltLine[] = [
    {
      timesheetId: opts.timesheetId,
      placementId: opts.placementId,
      description: opts.baseDescription,
      quantity: hours,
      unitPrice: opts.rate,
      amount: round2(hours * opts.rate),
      lineKind: "HOURS",
      ...meta,
    },
  ];

  if (opts.weekendPct > 0 && weekendHours > 0) {
    const unit = surchargeUnit(opts.rate, opts.weekendPct);
    lines.push({
      timesheetId: null,
      placementId: opts.placementId,
      description: wkLabel(opts.weekendPct),
      quantity: weekendHours,
      unitPrice: unit,
      amount: round2(weekendHours * unit),
      lineKind: "SURCHARGE",
      ...meta,
    });
  }

  // Overuren als eigen regel tegen het volle opgehoogde tarief — zo leest de
  // factuur hetzelfde als die van de freelancer ("Overuren 3,00 × €84,70").
  if (ot > 0) {
    const unit = upliftedRate(opts.rate, opts.overtimePct);
    lines.push({
      timesheetId: null,
      placementId: opts.placementId,
      description: otLabel(opts.overtimePct),
      quantity: ot,
      unitPrice: unit,
      amount: round2(ot * unit),
      lineKind: "SURCHARGE",
      ...meta,
    });
  }

  if (opts.kmRate > 0 && km > 0) {
    lines.push({
      timesheetId: null,
      placementId: opts.placementId,
      description: kmLabel,
      quantity: km,
      unitPrice: opts.kmRate,
      amount: round2(km * opts.kmRate),
      lineKind: "KM",
      ...meta,
    });
  }

  return lines;
}
