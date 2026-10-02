import { round2 } from "./utils";
import { isDutchHoliday } from "./holidays";

// ---------------------------------------------------------------------------
// Toeslagen (weekend/overuren) + kilometervergoeding — per placement (persoon).
// THE single source of truth: invoicing (src/lib/invoicing.ts), the guided flow
// aggregations (src/lib/facturatie.ts) and the urenstaat detail all compute the
// same amounts here, so the wizard preview always equals the generated invoice.
//
// Model:
//  - WEEKEND-uren zitten al ín de dagregels (dus in de basis). De weekendtoeslag
//    is daarom een EXTRA bedrag BOVENOP de basis — alleen het toeslagdeel.
//    Datzelfde geldt voor alle ZES losse toeslagen (doordeweeks, zaterdag,
//    zondag, offshore, ploegendienst, buitenland): elk levert alleen een extra
//    toeslagBEDRAG per uur op, nooit een tweede keer de basis.
//  - OVERUREN staan NIET in de dagregels; ze worden apart opgegeven. Het zijn
//    dus EXTRA uren die volledig betaald/gefactureerd worden tegen het opgehoogde
//    uurtarief (tarief + toeslag), precies zoals de freelancer ze factureert
//    (3 u × €84,70 bij €77 + 10%). Bij 0% toeslag blijft dat uren × tarief.
// "Buy" = inkoop (what we pay the consultant), "Sell" = verkoop (what we charge
// the client). Zonder overuren en met alle percentages op 0 is dit identiek aan
// het oude uren×tarief-gedrag.
// ---------------------------------------------------------------------------

/** Hoe een toeslag gerekend wordt: percentage op het tarief, of een vast €/u. */
export type SurchargeUnit = "PCT" | "FIXED";

/** De zes losse toeslagsoorten, elk per plaatsing in te stellen. */
export type SurchargeKind =
  | "weekday"
  | "weekday2"
  | "saturday"
  | "sunday"
  | "offshore"
  | "shift"
  | "abroad";

/** Wat er op een regel kan staan: de zes soorten + de legacy weekendtoeslag. */
export type SurchargeType = SurchargeKind | "weekend";

/** The per-placement surcharge configuration (+ the base hourly rates).
 *  De zes toeslagvelden zijn OPTIONEEL met een veilige nulstand, zodat bestaande
 *  aanroepers (en oude rijen) exact hetzelfde bedrag houden. */
export type SurchargeConfig = {
  costRate: number;
  chargeRate: number;
  /** "DAY" = costRate/chargeRate zijn dagtarieven; anders per uur. */
  rateUnit?: string | null;
  weekendSurchargeBuy: number; // LEGACY: % uplift on cost rate for weekend hours
  weekendSurchargeSell: number; // LEGACY: % uplift on charge rate for weekend hours
  overtimeSurchargeBuy: number; // % uplift on cost rate for overtime hours (extra uren)
  overtimeSurchargeSell: number; // % uplift on charge rate for overtime hours (extra uren)
  // --- De zes losse toeslagen (waarde + unit "PCT" | "FIXED", per zijde) ------
  weekdaySurchargeBuy?: number;
  weekdaySurchargeSell?: number;
  weekdaySurchargeUnit?: string;
  weekdaySurchargeSellUnit?: string;
  /** Meeruren-treden (zie schema): null/undefined = oud gedrag. */
  otFromHours?: number | null;
  ot1Hours?: number;
  weekday2SurchargeBuy?: number;
  weekday2SurchargeSell?: number;
  weekday2SurchargeUnit?: string;
  weekday2SurchargeSellUnit?: string;
  saturdaySurchargeBuy?: number;
  saturdaySurchargeSell?: number;
  saturdaySurchargeUnit?: string;
  saturdaySurchargeSellUnit?: string;
  sundaySurchargeBuy?: number;
  sundaySurchargeSell?: number;
  sundaySurchargeUnit?: string;
  sundaySurchargeSellUnit?: string;
  /** Offshore/ploegendienst/buitenland zijn niet uit de datums af te leiden: staat
   *  de vlag aan, dan geldt de toeslag over ALLE reguliere uren van de week. */
  offshoreEnabled?: boolean;
  offshoreSurchargeBuy?: number;
  offshoreSurchargeSell?: number;
  offshoreSurchargeUnit?: string;
  offshoreSurchargeSellUnit?: string;
  shiftEnabled?: boolean;
  shiftSurchargeBuy?: number;
  shiftSurchargeSell?: number;
  shiftSurchargeUnit?: string;
  shiftSurchargeSellUnit?: string;
  abroadEnabled?: boolean;
  abroadSurchargeBuy?: number;
  abroadSurchargeSell?: number;
  abroadSurchargeUnit?: string;
  abroadSurchargeSellUnit?: string;
  /** Expliciet overuren-uurtarief (€/u), los van het percentage. null/leeg =
   *  val terug op de normale rate (geen uplift). Staat dit gevuld, dan WINT het
   *  van het percentage — het is dan het volle overuren-tarief per uur. */
  overtimeCostRate?: number | null;
  overtimeChargeRate?: number | null;
  kmRateBuy: number; // €/km reimbursed to the consultant
  kmRateSell: number; // €/km charged to the client
};

export type TimesheetInput = {
  entries: { date: Date; hours: number }[];
  overtimeHours: number | null;
  kilometers: number | null;
};

/** Uren standaard per dag — alleen gebruikt om bij een DAGtarief een overuur te
 *  prijzen als er geen expliciet overuren-uurtarief is ingesteld. */
export const UREN_PER_DAG = 8;

export function isDagtarief(p: { rateUnit?: string | null }): boolean {
  return p.rateUnit === "DAY";
}

/**
 * Bij een dagtarief telt elke gewerkte dag als 1 eenheid: de dagregels worden
 * "1 per dag met uren", zodat álle bestaande uur-rekenwerk (basis, za/zo-toeslag
 * per dag, offshore) vanzelf in dagen rekent.
 */
export function tariefEenheden(
  entries: { date: Date; hours: number }[],
  dagtarief: boolean,
): { date: Date; hours: number }[] {
  if (!dagtarief) return entries;
  // Eén per kalenderdag, ook als er (per ongeluk) twee regels op dezelfde dag staan.
  const gezien = new Set<string>();
  return entries.flatMap((e) => {
    const d = new Date(e.date);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    if (e.hours <= 0 || gezien.has(key)) return [];
    gezien.add(key);
    return [{ date: e.date, hours: 1 }];
  });
}

/** "/u" of "/dag" achter een tarief. */
export function tariefSuffix(p: { rateUnit?: string | null }): string {
  return isDagtarief(p) ? "/dag" : "/u";
}

/** Saturday or Sunday (local). Weekend hours usually carry a toeslag. */
export function isWeekendDate(d: Date): boolean {
  const g = new Date(d).getDay();
  return g === 0 || g === 6;
}

function hoursOn(
  entries: { date: Date; hours: number }[],
  matches: (day: number) => boolean,
): number {
  return round2(
    entries
      .filter((e) => matches(new Date(e.date).getDay()))
      .reduce((s, e) => s + e.hours, 0),
  );
}

export function weekendHoursOf(entries: { date: Date; hours: number }[]): number {
  return hoursOn(entries, (g) => g === 0 || g === 6);
}

/** Maandag t/m vrijdag — de uren waarop de doordeweekse toeslag geldt. */
export function weekdayHoursOf(entries: { date: Date; hours: number }[]): number {
  return hoursOn(entries, (g) => g >= 1 && g <= 5);
}

export function saturdayHoursOf(entries: { date: Date; hours: number }[]): number {
  return hoursOn(entries, (g) => g === 6);
}

export function sundayHoursOf(entries: { date: Date; hours: number }[]): number {
  return hoursOn(entries, (g) => g === 0);
}

export type ToeslagUren = {
  weekdayHours: number;
  weekday2Hours: number;
  saturdayHours: number;
  sundayHours: number;
  /** Tekst achter de naam op de regel, bijv. " (uur 9–10)". */
  suffix?: Partial<Record<SurchargeKind, string>>;
};

/**
 * Over welke uren gelden de dag-toeslagen?
 * - Geen treden (otFromHours leeg): oud gedrag — doordeweeks = alle ma–vr-uren.
 * - Met treden: per ma–vr-dag zijn de uren BOVEN `otFromHours` meeruren; de eerste
 *   `ot1Hours` daarvan → trede 1 (weekday), de rest → trede 2 (weekday2). Een
 *   feestdag op ma–vr telt als zondag (contract: "Zon/Feestdag").
 */
export function toeslagUren(
  entries: { date: Date; hours: number }[],
  p: { otFromHours?: number | null; ot1Hours?: number },
): ToeslagUren {
  if (p.otFromHours == null) {
    return {
      weekdayHours: weekdayHoursOf(entries),
      weekday2Hours: 0,
      saturdayHours: saturdayHoursOf(entries),
      sundayHours: sundayHoursOf(entries),
    };
  }
  const vanaf = Math.max(0, p.otFromHours);
  const t1 = Math.max(0, p.ot1Hours ?? 2);
  let w1 = 0;
  let w2 = 0;
  let za = 0;
  let zo = 0;
  for (const e of entries) {
    const d = new Date(e.date);
    const g = d.getDay();
    if (g === 6) za += e.hours;
    else if (g === 0 || isDutchHoliday(d)) zo += e.hours;
    else {
      const meer = Math.max(0, e.hours - vanaf);
      w1 += Math.min(meer, t1);
      w2 += Math.max(0, meer - t1);
    }
  }
  const fmt = (n: number) => String(Math.round(n * 100) / 100).replace(".", ",");
  return {
    weekdayHours: round2(w1),
    weekday2Hours: round2(w2),
    saturdayHours: round2(za),
    sundayHours: round2(zo),
    // Taalneutraal: staat ook op de Engelse verkoopfactuur.
    suffix: {
      weekday: ` (h ${fmt(vanaf + 1)}–${fmt(vanaf + t1)})`,
      weekday2: ` (h ${fmt(vanaf + t1 + 1)}+)`,
    },
  };
}

/** Per-hour surcharge amount, e.g. €40/u at +50% → €20/u. Rounded to cents so
 *  the invoice line (qty × unitPrice) and any preview agree to the cent. */
export function surchargeUnit(rate: number, pct: number): number {
  return round2((rate * pct) / 100);
}

/** Het toeslagbedrag per uur volgens de schakelaar: een percentage van het
 *  tarief, of het ingevulde vaste bedrag (€/u) zelf. */
export function surchargeAmount(rate: number, value: number, unit: SurchargeUnit): number {
  return unit === "FIXED" ? round2(value) : surchargeUnit(rate, value);
}

/** Eén toeslag zoals ingesteld voor één zijde (inkoop of verkoop). */
export type SurchargeSetting = {
  value: number;
  unit: SurchargeUnit;
  /** Alleen voor offshore/ploegendienst/buitenland; de dag-toeslagen staan altijd
   *  "aan" en gelden zodra hun waarde > 0 is én er zulke uren zijn. */
  enabled: boolean;
};

/** De zes toeslagen van één zijde bij elkaar. */
export type SideSurcharges = Record<SurchargeKind, SurchargeSetting>;

const GEEN_TOESLAG: SurchargeSetting = { value: 0, unit: "PCT", enabled: false };

/** Alles uit — de nulstand voor aanroepers die (nog) geen toeslagen meegeven. */
export const NO_SURCHARGES: SideSurcharges = {
  weekday: GEEN_TOESLAG,
  weekday2: GEEN_TOESLAG,
  saturday: GEEN_TOESLAG,
  sunday: GEEN_TOESLAG,
  offshore: GEEN_TOESLAG,
  shift: GEEN_TOESLAG,
  abroad: GEEN_TOESLAG,
};

function setting(value: number | undefined, unit: string | undefined, enabled: boolean): SurchargeSetting {
  return { value: value ?? 0, unit: unit === "FIXED" ? "FIXED" : "PCT", enabled };
}

/** De zes toeslagen van de plaatsing voor één zijde: "buy" = wat we de freelancer
 *  betalen, "sell" = wat we de klant rekenen. De unit (%/vast) is per toeslag
 *  gedeeld — het is één afspraak, alleen het bedrag verschilt per zijde. */
export function sideSurcharges(p: SurchargeConfig, side: "buy" | "sell"): SideSurcharges {
  const buy = side === "buy";
  // De unit mag per zijde verschillen: inkoop gebruikt *SurchargeUnit, verkoop
  // *SurchargeSellUnit (met terugval op de inkoop-unit voor oude rijen).
  const unitFor = (buyUnit?: string, sellUnit?: string) =>
    buy ? buyUnit : (sellUnit ?? buyUnit);
  return {
    weekday: setting(buy ? p.weekdaySurchargeBuy : p.weekdaySurchargeSell, unitFor(p.weekdaySurchargeUnit, p.weekdaySurchargeSellUnit), true),
    weekday2: setting(buy ? p.weekday2SurchargeBuy : p.weekday2SurchargeSell, unitFor(p.weekday2SurchargeUnit, p.weekday2SurchargeSellUnit), true),
    saturday: setting(buy ? p.saturdaySurchargeBuy : p.saturdaySurchargeSell, unitFor(p.saturdaySurchargeUnit, p.saturdaySurchargeSellUnit), true),
    sunday: setting(buy ? p.sundaySurchargeBuy : p.sundaySurchargeSell, unitFor(p.sundaySurchargeUnit, p.sundaySurchargeSellUnit), true),
    offshore: setting(
      buy ? p.offshoreSurchargeBuy : p.offshoreSurchargeSell,
      unitFor(p.offshoreSurchargeUnit, p.offshoreSurchargeSellUnit),
      p.offshoreEnabled ?? false,
    ),
    shift: setting(
      buy ? p.shiftSurchargeBuy : p.shiftSurchargeSell,
      unitFor(p.shiftSurchargeUnit, p.shiftSurchargeSellUnit),
      p.shiftEnabled ?? false,
    ),
    abroad: setting(
      buy ? p.abroadSurchargeBuy : p.abroadSurchargeSell,
      unitFor(p.abroadSurchargeUnit, p.abroadSurchargeSellUnit),
      p.abroadEnabled ?? false,
    ),
  };
}

/** Eén berekende toeslag: het EXTRA bedrag bovenop de basis-uren. */
export type SurchargeRow = {
  type: SurchargeType;
  label: string;
  hours: number;
  /** Toeslagbedrag per uur (€) — de stukprijs op de factuurregel. */
  unitAmount: number;
  amount: number;
};

/** Optionele naamgeving; de verkoopfactuur gebruikt Engelse namen. */
export type SurchargeLabels = {
  /** De VOLLEDIGE tekst van de legacy weekendregel (inclusief percentage). */
  weekend?: (pct: number) => string;
  /** Alleen de naam per soort; het percentage plakt de renderer er zelf achter. */
  names?: Partial<Record<SurchargeKind, string>>;
};

const TOESLAG_NAMEN: Record<SurchargeKind, string> = {
  weekday: "Toeslag doordeweeks",
  weekday2: "Toeslag doordeweeks",
  saturday: "Zaterdagtoeslag",
  sunday: "Zondagtoeslag",
  offshore: "Offshoretoeslag",
  shift: "Ploegendiensttoeslag",
  abroad: "Buitenlandtoeslag",
};

/** De Nederlandse naam van een toeslagsoort, zonder percentage — voor schermen
 *  die de bedragen in eigen kolommen zetten. */
export function surchargeName(type: SurchargeType): string {
  return type === "weekend" ? "Weekendtoeslag" : TOESLAG_NAMEN[type];
}

function toeslagLabel(
  type: SurchargeKind,
  set: SurchargeSetting,
  names?: Partial<Record<SurchargeKind, string>>,
): string {
  const naam = names?.[type] ?? TOESLAG_NAMEN[type];
  // Bij een percentage hoort het percentage in de omschrijving ("… 50%"); een
  // vast bedrag staat al als stukprijs op de regel.
  return set.unit === "PCT" ? `${naam} ${set.value}%` : naam;
}

/**
 * De losse toeslagen van één zijde, in factuurvolgorde. Elke toeslag is een
 * EXTRA bedrag bovenop de basis-uren — nooit een tweede keer het uurtarief.
 *
 * Zaterdag/zondag winnen van de LEGACY weekendtoeslag; staan ze op 0 en is er
 * nog een oude weekendtoeslag, dan geldt die voor die dag. Staan ze allebéi op 0,
 * dan blijft het exact de oude, gecombineerde weekendregel (backwards compatibel).
 */
export function buildSurchargeRows(opts: {
  rate: number;
  /** Alle reguliere (dag)uren — de basis voor offshore/ploegendienst/buitenland. */
  hours: number;
  weekdayHours: number;
  /** Trede 2 van de meeruren (0 zonder treden). */
  weekday2Hours?: number;
  saturdayHours: number;
  sundayHours: number;
  /** De legacy weekendtoeslag (%) van deze zijde. */
  weekendPct: number;
  settings?: SideSurcharges;
  labels?: SurchargeLabels;
  suffix?: Partial<Record<SurchargeKind, string>>;
}): SurchargeRow[] {
  const s = opts.settings ?? NO_SURCHARGES;
  const rows: SurchargeRow[] = [];

  const add = (type: SurchargeKind, set: SurchargeSetting, hours: number) => {
    if (set.value <= 0 || hours <= 0) return;
    const unitAmount = surchargeAmount(opts.rate, set.value, set.unit);
    if (unitAmount <= 0) return;
    rows.push({
      type,
      label: toeslagLabel(type, set, opts.labels?.names) + (opts.suffix?.[type] ?? ""),
      hours,
      unitAmount,
      amount: round2(hours * unitAmount),
    });
  };

  add("weekday", s.weekday, opts.weekdayHours);
  add("weekday2", s.weekday2, opts.weekday2Hours ?? 0);

  const legacyPct = opts.weekendPct > 0 ? opts.weekendPct : 0;
  const satLegacy = s.saturday.value <= 0 && legacyPct > 0;
  const sunLegacy = s.sunday.value <= 0 && legacyPct > 0;
  if (satLegacy && sunLegacy) {
    // Er is niets apart ingesteld → één weekendregel over za + zo, zoals altijd.
    const hours = round2(opts.saturdayHours + opts.sundayHours);
    const unitAmount = surchargeUnit(opts.rate, legacyPct);
    if (hours > 0 && unitAmount > 0) {
      rows.push({
        type: "weekend",
        label: opts.labels?.weekend?.(legacyPct) ?? `Weekendtoeslag ${legacyPct}%`,
        hours,
        unitAmount,
        amount: round2(hours * unitAmount),
      });
    }
  } else {
    const legacy: SurchargeSetting = { value: legacyPct, unit: "PCT", enabled: true };
    add("saturday", satLegacy ? legacy : s.saturday, opts.saturdayHours);
    add("sunday", sunLegacy ? legacy : s.sunday, opts.sundayHours);
  }

  // Offshore/ploegendienst/buitenland: niet uit de datums af te leiden, dus een
  // vlag per plaatsing — aan = over ALLE reguliere uren (niet over de overuren,
  // nooit over de kilometers).
  for (const type of ["offshore", "shift", "abroad"] as const) {
    if (s[type].enabled) add(type, s[type], opts.hours);
  }

  return rows;
}

/** One side's (buy or sell) cost broken into its components.
 *  `surcharges` = elke ingestelde toeslag apart (alléén het toeslagdeel; de uren
 *  zitten al in `base`), `weekend` = daarvan het za/zo-deel (voor de bestaande
 *  schermen), `surchargeTotal` = alle toeslagen samen.
 *  `overtime` = de VOLLEDIGE overurenbeloning (uren × opgehoogd tarief), want
 *  overuren staan niet in de dagregels en dus niet in `base`. */
export type SideBreakdown = {
  base: number;
  surcharges: SurchargeRow[];
  surchargeTotal: number;
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

/**
 * Het effectieve overuren-uurtarief. Een EXPLICIETE rate (€/u) wint altijd:
 * dat is het volle bedrag per overuur, het percentage telt dan niet meer mee.
 * Leeg/0/negatief → val terug op het opgehoogde normale tarief (rate + pct);
 * met pct 0 is dat gewoon de normale rate, dus geen margeverlies.
 */
export function overtimeUnit(
  rate: number,
  pct: number,
  explicitRate?: number | null,
): number {
  if (explicitRate != null && explicitRate > 0) return round2(explicitRate);
  return upliftedRate(rate, pct);
}

function computeSide(opts: {
  hours: number;
  weekdayHours: number;
  weekday2Hours: number;
  saturdayHours: number;
  sundayHours: number;
  suffix?: Partial<Record<SurchargeKind, string>>;
  overtimeHours: number;
  kilometers: number;
  rate: number;
  weekendPct: number;
  overtimePct: number;
  kmRate: number;
  overtimeRate?: number | null;
  settings?: SideSurcharges;
  /** Tarief per UUR voor overuren zonder expliciete rate (bij dagtarief: dag/8). */
  overtimeBaseRate?: number;
}): SideBreakdown {
  const { hours, rate, overtimeHours, kilometers, kmRate } = opts;
  const base = round2(hours * rate);
  const surcharges = buildSurchargeRows({
    rate,
    hours,
    weekdayHours: opts.weekdayHours,
    weekday2Hours: opts.weekday2Hours,
    saturdayHours: opts.saturdayHours,
    sundayHours: opts.sundayHours,
    weekendPct: opts.weekendPct,
    settings: opts.settings,
    suffix: opts.suffix,
  });
  const surchargeTotal = round2(surcharges.reduce((s, r) => s + r.amount, 0));
  // `weekend` blijft het za/zo-deel: legacy weekendregel of de losse za/zo-rijen.
  const weekend = round2(
    surcharges
      .filter((r) => r.type === "weekend" || r.type === "saturday" || r.type === "sunday")
      .reduce((s, r) => s + r.amount, 0),
  );
  // Overuren zijn EXTRA uren (niet in `hours`), dus tegen het volle overuren-
  // tarief: een expliciete €/u wint, anders het opgehoogde normale tarief.
  const overtime =
    overtimeHours > 0
      ? round2(overtimeHours * overtimeUnit(opts.overtimeBaseRate ?? rate, opts.overtimePct, opts.overtimeRate))
      : 0;
  const km = kmRate > 0 && kilometers > 0 ? round2(kilometers * kmRate) : 0;
  return {
    base,
    surcharges,
    surchargeTotal,
    weekend,
    overtime,
    km,
    total: round2(base + surchargeTotal + overtime + km),
  };
}

export type TimesheetMoney = {
  hours: number; // reguliere (dag)uren — de basis voor het uurbedrag
  /** Gewerkte dagen bij een dagtarief (de basis voor het bedrag); null bij uurtarief. */
  days: number | null;
  workedHours: number; // TOTAAL gewerkt = reguliere uren + overuren (voor de weergave)
  weekendHours: number;
  weekdayHours: number;
  saturdayHours: number;
  sundayHours: number;
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
  const weekdayHours = weekdayHoursOf(t.entries);
  const saturdayHours = saturdayHoursOf(t.entries);
  const sundayHours = sundayHoursOf(t.entries);
  const overtimeHours = t.overtimeHours ?? 0;
  const kilometers = t.kilometers ?? 0;
  // Geld rekent in tariefeenheden: uren, of bij een dagtarief gewerkte dagen.
  const dagtarief = isDagtarief(p);
  const eenheden = tariefEenheden(t.entries, dagtarief);
  // Treden gelden alleen per uur; bij een dagtarief is er geen "9e uur".
  const tu = toeslagUren(eenheden, dagtarief ? {} : p);
  const dagen = {
    hours: dagtarief ? round2(eenheden.length) : hours,
    weekdayHours: tu.weekdayHours,
    weekday2Hours: tu.weekday2Hours,
    saturdayHours: tu.saturdayHours,
    sundayHours: tu.sundayHours,
    suffix: tu.suffix,
    overtimeHours,
    kilometers,
  };
  // ponytail: overuur bij dagtarief zonder expliciet overuren-uurtarief = dag/8.
  const perUur = (rate: number) => (dagtarief ? rate / UREN_PER_DAG : rate);
  const sell = computeSide({
    ...dagen,
    overtimeBaseRate: perUur(p.chargeRate),
    rate: p.chargeRate,
    weekendPct: p.weekendSurchargeSell,
    overtimePct: p.overtimeSurchargeSell,
    kmRate: p.kmRateSell,
    overtimeRate: p.overtimeChargeRate,
    settings: sideSurcharges(p, "sell"),
  });
  const buy = computeSide({
    ...dagen,
    overtimeBaseRate: perUur(p.costRate),
    rate: p.costRate,
    weekendPct: p.weekendSurchargeBuy,
    overtimePct: p.overtimeSurchargeBuy,
    kmRate: p.kmRateBuy,
    overtimeRate: p.overtimeCostRate,
    settings: sideSurcharges(p, "buy"),
  });
  return {
    hours,
    days: dagtarief ? eenheden.length : null,
    workedHours: round2(hours + overtimeHours),
    weekendHours,
    weekdayHours,
    saturdayHours,
    sundayHours,
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
  /** De LEGACY weekendtoeslag (%) van deze zijde; terugval voor za/zo. */
  weekendPct: number;
  /** De zes losse toeslagen van deze zijde (`sideSurcharges(p, "buy"|"sell")`). */
  surcharges?: SideSurcharges;
  overtimePct: number;
  /** Expliciet overuren-uurtarief (€/u); wint van het percentage. Leeg = uplift. */
  overtimeRate?: number | null;
  kmRate: number;
  /** "DAY" = `rate` is een dagtarief: de basisregel telt gewerkte dagen. */
  rateUnit?: string | null;
  /** Meeruren-treden van de plaatsing (zie toeslagUren). */
  otFromHours?: number | null;
  ot1Hours?: number;
  /** Optionele label-overrides (bijv. Engels voor de verkoopfactuur). Default NL. */
  labels?: {
    weekend?: (pct: number) => string;
    overtime?: (pct: number) => string;
    km?: string;
    /** Namen van de zes losse toeslagen; het percentage komt er zelf achter. */
    names?: Partial<Record<SurchargeKind, string>>;
  };
}): BuiltLine[] {
  const otLabel =
    opts.labels?.overtime ??
    ((p: number) =>
      opts.overtimeRate != null && opts.overtimeRate > 0
        ? "Overuren"
        : p > 0
          ? `Overuren +${p}%`
          : "Overuren");
  const kmLabel = opts.labels?.km ?? "Kilometers";
  const dagtarief = isDagtarief(opts);
  const eenheden = tariefEenheden(opts.entries, dagtarief);
  const hours = round2(eenheden.reduce((s, e) => s + e.hours, 0));
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

  // Elke ingestelde toeslag krijgt zijn eigen regel — dezelfde rijen die
  // computeTimesheetMoney optelt, dus preview en factuur kunnen niet uiteenlopen.
  for (const row of buildSurchargeRows({
    rate: opts.rate,
    hours,
    ...(() => {
      const tu = toeslagUren(eenheden, dagtarief ? {} : opts);
      return {
        weekdayHours: tu.weekdayHours,
        weekday2Hours: tu.weekday2Hours,
        saturdayHours: tu.saturdayHours,
        sundayHours: tu.sundayHours,
        suffix: tu.suffix,
      };
    })(),
    weekendPct: opts.weekendPct,
    settings: opts.surcharges,
    labels: { weekend: opts.labels?.weekend, names: opts.labels?.names },
  })) {
    lines.push({
      timesheetId: null,
      placementId: opts.placementId,
      description: row.label,
      quantity: row.hours,
      unitPrice: row.unitAmount,
      amount: row.amount,
      lineKind: "SURCHARGE",
      ...meta,
    });
  }

  // Overuren als eigen regel tegen het volle opgehoogde tarief — zo leest de
  // factuur hetzelfde als die van de freelancer ("Overuren 3,00 × €84,70").
  if (ot > 0) {
    const unit = overtimeUnit(dagtarief ? opts.rate / UREN_PER_DAG : opts.rate, opts.overtimePct, opts.overtimeRate);
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
