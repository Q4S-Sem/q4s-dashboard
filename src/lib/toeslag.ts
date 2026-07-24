import { round2 } from "./utils";

// ---------------------------------------------------------------------------
// Toeslagen (weekend/overuren) + kilometervergoeding — per placement (persoon).
// THE single source of truth: invoicing (src/lib/invoicing.ts), the guided flow
// aggregations (src/lib/facturatie.ts) and the urenstaat detail all compute the
// same amounts here, so the wizard preview always equals the generated invoice.
//
// Model: surcharges are EXTRA amounts ON TOP of the base (hours × rate), never a
// re-rate of the base, so nothing is double-counted. "Buy" = inkoop (what we pay
// the consultant), "Sell" = verkoop (what we charge the client). All config
// defaults to 0 → identical to the old hours×rate behaviour.
// ---------------------------------------------------------------------------

/** The per-placement surcharge configuration (+ the base hourly rates). */
export type SurchargeConfig = {
  costRate: number;
  chargeRate: number;
  weekendSurchargeBuy: number; // % uplift on cost rate for weekend hours
  weekendSurchargeSell: number; // % uplift on charge rate for weekend hours
  overtimeSurchargeBuy: number; // % uplift on cost rate for overtime hours
  overtimeSurchargeSell: number; // % uplift on charge rate for overtime hours
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

/** One side's (buy or sell) cost broken into its components. */
export type SideBreakdown = {
  base: number;
  weekend: number;
  overtime: number;
  km: number;
  total: number;
};

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
  const overtime =
    overtimePct > 0 && overtimeHours > 0
      ? round2(overtimeHours * surchargeUnit(rate, overtimePct))
      : 0;
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

/** An invoice/purchase line, shaped for both InvoiceLine and PurchaseInvoiceLine. */
export type BuiltLine = {
  timesheetId: string | null;
  placementId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
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
  weekLabel: string;
  baseDescription: string;
  entries: { date: Date; hours: number }[];
  overtimeHours: number | null;
  kilometers: number | null;
  rate: number;
  weekendPct: number;
  overtimePct: number;
  kmRate: number;
}): BuiltLine[] {
  const hours = round2(opts.entries.reduce((s, e) => s + e.hours, 0));
  const weekendHours = weekendHoursOf(opts.entries);
  const ot = opts.overtimeHours ?? 0;
  const km = opts.kilometers ?? 0;

  const lines: BuiltLine[] = [
    {
      timesheetId: opts.timesheetId,
      placementId: opts.placementId,
      description: opts.baseDescription,
      quantity: hours,
      unitPrice: opts.rate,
      amount: round2(hours * opts.rate),
    },
  ];

  if (opts.weekendPct > 0 && weekendHours > 0) {
    const unit = surchargeUnit(opts.rate, opts.weekendPct);
    lines.push({
      timesheetId: null,
      placementId: opts.placementId,
      description: `Weekendtoeslag ${opts.weekendPct}% — ${opts.weekLabel} (${weekendHours} u)`,
      quantity: weekendHours,
      unitPrice: unit,
      amount: round2(weekendHours * unit),
    });
  }

  if (opts.overtimePct > 0 && ot > 0) {
    const unit = surchargeUnit(opts.rate, opts.overtimePct);
    lines.push({
      timesheetId: null,
      placementId: opts.placementId,
      description: `Overurentoeslag ${opts.overtimePct}% — ${opts.weekLabel} (${ot} u)`,
      quantity: ot,
      unitPrice: unit,
      amount: round2(ot * unit),
    });
  }

  if (opts.kmRate > 0 && km > 0) {
    lines.push({
      timesheetId: null,
      placementId: opts.placementId,
      description: `Kilometervergoeding — ${opts.weekLabel} (${km} km)`,
      quantity: km,
      unitPrice: opts.kmRate,
      amount: round2(km * opts.kmRate),
    });
  }

  return lines;
}
