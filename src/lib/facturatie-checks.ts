import { formatCurrency, formatDate, formatHours, round2, startOfISOWeek } from "./utils";
import { isDutchHoliday } from "./holidays";
import { nameMatches, normalizeName } from "./name-match";
import { canonicalWeekFromDates, weekMismatch, weekMismatchLabel } from "./week-koppeling";
import {
  isDagtarief,
  computeTimesheetMoney,
  isWeekendDate,
  saturdayHoursOf,
  sideSurcharges,
  sundayHoursOf,
  surchargeName,
  weekdayHoursOf,
  type SurchargeConfig,
  type SurchargeKind,
  type SurchargeType,
} from "./toeslag";
import {
  GATE_MAX_WEEKLY_HOURS,
  GATE_MIN_WEEKLY_HOURS,
  GATE_MIN_HISTORY_WEEKS,
  GATE_RELATIVE_FACTOR,
} from "./timesheet-auto-gate";
import { evaluateMargin } from "./facturatie-detecties";

// ---------------------------------------------------------------------------
// DE CONTROLE-MACHINE van "Week verwerken": één persoon, één ISO-week, álle
// controles die de eigenaar wil zien. Dit is de enige plek waar bepaald wordt of
// een week KLAAR, FOUT, WACHT of NIET_INGELEVERD is — het scherm toont alleen
// wat hier uitkomt, en de akkoord-knop draait dit server-side opnieuw.
//
// PUUR en DETERMINISTISCH, net als src/lib/timesheet-auto-gate.ts en
// src/lib/facturatie-detecties.ts: geen Prisma, geen `new Date()` van binnenuit,
// geen I/O. Alles (ook "nu") komt als platte data binnen, zodat het scherm, de
// server-actie en de tests exact hetzelfde uitrekenen.
//
// Er wordt hier GEEN eigen geldrekenwerk gedaan: het verwachte inkoopbedrag komt
// uit `computeTimesheetMoney` (src/lib/toeslag.ts) — dezelfde functie die de
// echte factuurregels bouwt — en de marge uit `evaluateMargin`. Zo kan het
// controle-scherm nooit iets anders zeggen dan de factuur straks doet.
//
// Elke controle komt ALTIJD in de lijst, ook als hij slaagt (level "ok"). Zo kan
// het dossier "Timesheet 5/6" tonen en ziet de mens wat er wél gecontroleerd is.
// ---------------------------------------------------------------------------

// ===========================================================================
// Vaste afspraken
// ===========================================================================

/** De inleverdeadline: dinsdag ná de gewerkte week. */
export const DEADLINE_WEEKDAG = 2;
/** …om 12:00 's middags. */
export const DEADLINE_UUR = 12;
/** Hoe de deadline op het scherm heet. */
export const DEADLINE_LABEL = "dinsdag 12:00";

/** Afrondingsverschillen mogen door; een heel uur (≥ €30) nooit. */
export const TOLERANTIE_EUR = 1;
/** Uren/aantallen vergelijken we op honderdsten. */
export const TOLERANTIE_AANTAL = 0.01;
/** Het normale Nederlandse btw-tarief op een ZZP-factuur. */
export const STANDAARD_BTW_PCT = 21;
/** Boven zoveel uur op één dag horen er overuren opgegeven te zijn. */
export const DAG_UREN_NORM = 8;
/** Idem voor de week. */
export const WEEK_UREN_NORM = 40;

/**
 * De dinsdag 12:00 ná de gewerkte week. `weekMonday` is de maandag VAN de
 * gewerkte week, dus de deadline ligt zes dagen na de zondag.
 */
export function weekDeadline(weekMonday: Date): Date {
  const d = startOfISOWeek(weekMonday);
  d.setDate(d.getDate() + 6 + DEADLINE_WEEKDAG);
  d.setHours(DEADLINE_UUR, 0, 0, 0);
  return d;
}

// ===========================================================================
// Invoer
// ===========================================================================

/** Wat er in het contract/de plaatsing staat. Erft de volledige toeslag-
 *  configuratie, zodat `computeTimesheetMoney` er rechtstreeks mee rekent. */
export type PlacementTerms = SurchargeConfig & {
  /** Inkoop-ordernummer van de klant; leeg = geen PO vereist. */
  poNumber: string | null;
  /** Staat de verkoop op "btw verlegd"? Dan hoort zijn factuur dat ook te doen. */
  vatReverseCharge: boolean;
  /** Maximaal uit te betalen uren per dag (pauze eraf). null = geen afspraak. */
  maxPaidHoursPerDay: number | null;
  /** Wie de urenstaat mag aftekenen. Leeg = niet vastgelegd (dan niet te toetsen). */
  approverNames: string[];
  /** De afgesproken valuta; alles anders op de factuur is een fout. */
  currency: string;
  clientName: string | null;
  workLocation: string | null;
  /** Heeft de plaatsing een gekoppelde klant? Zonder klant geen verkoopfactuur. */
  hasClient: boolean;
};

export type ConsultantInfo = {
  firstName: string;
  lastName: string;
  /** ZZP | LOONDIENST | UITZEND — alleen ZZP stuurt zelf een factuur. */
  employmentType: string;
  iban: string | null;
  kvkNumber: string | null;
  vatNumber: string | null;
  companyName: string | null;
};

/** Eén dag van de urenstaat zoals de AI hem las. */
export type DagUren = { date: string; hours: number };

export type TimesheetExtraction = {
  days: DagUren[];
  overtimeHours: number | null;
  kilometers: number | null;
  /** Reisuren apart vermeld (náást de kilometers) — dan loopt het door elkaar. */
  travelHours: number | null;
  /** Losse onkosten/bonnen die op de staat genoemd worden (€). */
  expenses: number | null;
  signaturePresent: boolean | null;
  signerName: string | null;
  /** Het weeknummer dat hij er zélf boven zette. */
  typedWeekNumber: number | null;
  name: string | null;
  clientName: string | null;
  projectName: string | null;
  location: string | null;
  poNumber: string | null;
  /** high | medium | low, zoals de uitlezing het vastlegde. */
  confidence: string | null;
  /** false = pagina's ontbreken / onleesbaar. */
  pagesComplete: boolean | null;
  receivedAt: Date | null;
};

/** Eén toeslagregel zoals die op zijn eigen factuur staat. */
export type FactuurToeslagRegel = {
  label: string;
  quantity: number | null;
  unit: string | null;
  amount: number | null;
};

export type InvoiceExtraction = {
  number: string | null;
  issueDate: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  hours: number | null;
  hourlyRate: number | null;
  overtimeHours: number | null;
  surchargeLines: FactuurToeslagRegel[];
  kilometers: number | null;
  vatPercent: number | null;
  vatShifted: boolean | null;
  currency: string | null;
  addressee: string | null;
  kvkNumber: string | null;
  vatId: string | null;
  iban: string | null;
  poNumber: string | null;
  mentionsAttachment: boolean | null;
  amountExclVat: number | null;
  totalAmount: number | null;
};

/** Een eerder van deze persoon ontvangen factuur (voor dubbel-detectie). */
export type EerdereFactuur = {
  number: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
};

export type PriorData = {
  /** Dagen (YYYY-MM-DD) die al op een ÁNDERE urenstaat van deze persoon staan. */
  otherTimesheetDays: string[];
  priorInvoices: EerdereFactuur[];
  /** Gemiddeld weektotaal over de recente weken van deze persoon. */
  recentAvgHours: number | null;
  recentWeeks: number;
};

export type CompanyInfo = {
  /** De bedrijfsnaam uit de instellingen — hier hoort de factuur aan gericht. */
  companyName: string;
  /** Schrijfwijzen die ook goed zijn ("Q4S", "Q4Solutions"). */
  aliases?: string[];
};

export type FacturatieCheckInput = {
  /** "2026-W40" — de week waar dit dossier over gaat. */
  weekKey: string;
  /** De maandag van die week. */
  weekMonday: Date;
  now: Date;
  company: CompanyInfo;
  consultant: ConsultantInfo;
  /** null = er is geen actieve plaatsing in deze week (dat is zelf een fout). */
  placement: PlacementTerms | null;
  timesheet: TimesheetExtraction | null;
  invoice: InvoiceExtraction | null;
  prior: PriorData;
  /**
   * Heeft een mens de fouten bewust geaccepteerd ("Toch accepteren", mét reden)?
   * De fouten blijven zichtbaar, maar blokkeren het akkoord niet meer.
   */
  acceptedErrors?: boolean;
};

// ===========================================================================
// Uitvoer
// ===========================================================================

export type CheckGroup = "timesheet" | "factuur" | "match" | "contract" | "fraude";
export type CheckLevel = "ok" | "warn" | "error";

export type Check = {
  id: string;
  group: CheckGroup;
  level: CheckLevel;
  /** Korte Nederlandse kop, zoals hij in de lijst staat. */
  title: string;
  /** Concrete toelichting met de getallen erbij ("8 vs 10 overuren"). */
  detail: string;
};

/** Eén regel van de vergelijkingstabel (staat ↔ factuur ↔ contract). */
export type ComparisonRow = {
  key: string;
  label: string;
  /** Wat de urenstaat zegt; null = niet van toepassing. */
  timesheet: string | null;
  /** Wat zijn factuur zegt; null = staat er niet op. */
  invoice: string | null;
  /** Wat het contract zegt; null = niet van toepassing. */
  contract: string | null;
  /** false = de factuur wijkt af van de staat/het contract (rood tonen). */
  ok: boolean;
};

export type WeekStatus = "KLAAR" | "FOUT" | "WACHT" | "NIET_INGELEVERD";

export type FacturatieCheckResult = {
  status: WeekStatus;
  checks: Check[];
  comparison: ComparisonRow[];
};

// ===========================================================================
// Kleine, pure hulpstukken
// ===========================================================================

function isNum(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isDatum(value: Date | null | undefined): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

/** Lege tekst, spaties of null → gewoon niets. */
function schoon(value: string | null | undefined): string | null {
  const t = typeof value === "string" ? value.trim() : "";
  return t === "" ? null : t;
}

/** Codes (PO, IBAN, KvK) vergelijken we zonder spaties, streepjes en hoofdletters. */
function normCode(value: string | null | undefined): string {
  return (typeof value === "string" ? value : "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/**
 * Twee namen (klant, locatie) die "hetzelfde bedrijf" zijn. Bewust mild: "Sif"
 * en "Sif Group B.V." horen bij elkaar, dus bevat-de-één-de-ander is genoeg.
 * Is één van beide onbekend, dan valt er niets te vergelijken → geen afwijking.
 */
function tekstMatcht(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = normalizeName(a ?? "");
  const y = normalizeName(b ?? "");
  if (!x || !y) return true;
  return x.includes(y) || y.includes(x);
}

/** "YYYY-MM-DD" → lokale middernacht (nooit via UTC: dat schuift een dag). */
function alsDatum(value: string | null | undefined): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((value ?? "").trim());
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  d.setHours(0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → "YYYY-MM-DD" in de lokale tijdzone. */
function alsSleutel(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * De bevoegde ondertekenaars uit het ene komma-veld van de plaatsing. Ook een
 * puntkomma of nieuwe regel scheidt — HR typt het zoals het uitkomt.
 */
export function parseApproverNames(value: string | null | undefined): string[] {
  return (typeof value === "string" ? value : "")
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Is de ondertekenaar één van de bevoegden? Vergelijken op ACHTERNAAM plus de
 * voorletter, zodat "P. Jansen" op de staat en "Piet Jansen" in de plaatsing
 * elkaar vinden — maar "Klaas Jansen" niet.
 */
export function ondertekenaarBevoegd(
  signer: string | null | undefined,
  approvers: string[],
): boolean {
  const s = normalizeName(signer ?? "").split(" ").filter(Boolean);
  if (s.length === 0) return false;
  for (const approver of approvers ?? []) {
    const a = normalizeName(approver).split(" ").filter(Boolean);
    if (a.length === 0) continue;
    if (s[s.length - 1] !== a[a.length - 1]) continue; // andere achternaam
    // Eén van beide noemt alleen de achternaam → dan is de achternaam genoeg.
    if (s.length === 1 || a.length === 1) return true;
    if (s[0][0] === a[0][0]) return true;
  }
  return false;
}

/**
 * De dagregels als echte entries voor `computeTimesheetMoney`. Dagen zonder
 * bruikbare datum vallen terug op hun positie (ma..zo) vanaf de maandag.
 *
 * Geëxporteerd omdat de dossierpagina de bedragen van de week met EXACT dezelfde
 * dagregels moet uitrekenen als de controles — anders kan het scherm een ander
 * weekbedrag tonen dan waar de controle op afging.
 */
export function timesheetEntries(
  days: DagUren[] | null | undefined,
  monday: Date,
): { date: Date; hours: number }[] {
  return entriesVan(days, monday);
}

function entriesVan(days: DagUren[] | null | undefined, monday: Date): { date: Date; hours: number }[] {
  const start = startOfISOWeek(monday);
  const out: { date: Date; hours: number }[] = [];
  (Array.isArray(days) ? days : []).forEach((d, i) => {
    const hours = isNum(d?.hours) ? d.hours : 0;
    if (hours <= 0) return;
    let datum = alsDatum(d?.date);
    if (!datum) {
      datum = new Date(start);
      datum.setDate(datum.getDate() + Math.min(Math.max(i, 0), 6));
    }
    out.push({ date: datum, hours });
  });
  return out;
}

/** Het factuurbedrag EXCLUSIEF btw — de maat waarin wij rekenen. */
function factuurExBtw(inv: InvoiceExtraction): number | null {
  const excl = isNum(inv.amountExclVat) && inv.amountExclVat > 0 ? inv.amountExclVat : null;
  if (excl !== null) return round2(excl);
  const totaal = isNum(inv.totalAmount) && inv.totalAmount > 0 ? inv.totalAmount : null;
  if (totaal === null) return null;
  if (inv.vatShifted === true) return round2(totaal); // verlegd: totaal ís ex btw
  const pct = isNum(inv.vatPercent) && inv.vatPercent > 0 ? inv.vatPercent : null;
  if (pct !== null) return round2(totaal / (1 + pct / 100));
  return round2(totaal);
}

/** Hoeveel ISO-weken beslaat deze periode (op maandagen geteld, minimaal 1)? */
function wekenInPeriode(start: Date, end: Date): number {
  const van = startOfISOWeek(start);
  const tot = startOfISOWeek(end);
  if (tot.getTime() < van.getTime()) return 1;
  return Math.round((tot.getTime() - van.getTime()) / (7 * 86_400_000)) + 1;
}

/** Valt de maandag van de week binnen deze factuurperiode? */
function periodeDektWeek(start: Date | null, end: Date | null, monday: Date): boolean {
  if (!isDatum(start) || !isDatum(end)) return false;
  const a = startOfISOWeek(start).getTime();
  const b = startOfISOWeek(end).getTime();
  const m = startOfISOWeek(monday).getTime();
  return m >= a && m <= b;
}

/** Trefwoorden waarmee we een toeslagregel op zijn eigen factuur herkennen. */
const TOESLAG_TREFWOORD: Record<SurchargeType, RegExp> = {
  weekday: /doordeweeks|weekday/i,
  saturday: /zaterdag|saturday|\bza\b/i,
  sunday: /zondag|sunday|\bzo\b/i,
  weekend: /weekend/i,
  offshore: /offshore/i,
  shift: /ploegen|shift|nacht|night/i,
  abroad: /buitenland|abroad|foreign/i,
};

/** De toeslagregel op zijn factuur die bij deze soort hoort. */
function factuurToeslag(
  lines: FactuurToeslagRegel[] | null | undefined,
  type: SurchargeType,
): FactuurToeslagRegel | null {
  const patroon = TOESLAG_TREFWOORD[type];
  return (Array.isArray(lines) ? lines : []).find((l) => patroon.test(l?.label ?? "")) ?? null;
}

/** De toeslagsoorten die wij kennen, in vaste volgorde (stabiele uitvoer). */
const TOESLAG_SOORTEN: SurchargeKind[] = [
  "weekday",
  "saturday",
  "sunday",
  "offshore",
  "shift",
  "abroad",
];
/** Offshore/ploegendienst/buitenland worden per DAG gefactureerd, niet per uur. */
const PER_DAG: SurchargeKind[] = ["offshore", "shift", "abroad"];

/** Hoe het contract deze toeslag omschrijft ("+50%" of "€ 25,00/u"). */
function contractToeslagLabel(value: number, unit: "PCT" | "FIXED"): string {
  return unit === "FIXED" ? `${formatCurrency(value)}/u` : `+${formatHours(value)}%`;
}

// ===========================================================================
// De machine
// ===========================================================================

type Verzamelaar = {
  add: (group: CheckGroup, id: string, level: CheckLevel, title: string, detail: string) => void;
  checks: Check[];
};

function verzamelaar(): Verzamelaar {
  const checks: Check[] = [];
  return {
    checks,
    add: (group, id, level, title, detail) => checks.push({ id, group, level, title, detail }),
  };
}

/**
 * Beoordeel één persoon in één week: alle controles op de urenstaat, zijn eigen
 * factuur, de koppeling ertussen, het contract en de fraude-indicatoren — plus
 * de vergelijkingstabel die het dossier toont.
 *
 * Statusregels (in deze volgorde):
 *   1. niets ontvangen            → NIET_INGELEVERD
 *   2. een niet-geaccepteerde fout → FOUT
 *   3. ZZP met uren, zonder factuur → WACHT
 *   4. anders                      → KLAAR
 * Waarschuwingen blokkeren nooit; ze worden wél altijd getoond.
 */
export function evaluateFacturatieWeek(input: FacturatieCheckInput): FacturatieCheckResult {
  const { add, checks } = verzamelaar();
  const p = input.placement;
  const ts = input.timesheet;
  const inv = input.invoice;
  const monday = startOfISOWeek(input.weekMonday);
  const deadline = weekDeadline(monday);
  const isZZP = (input.consultant.employmentType ?? "").toUpperCase() === "ZZP";
  const volledigeNaam = `${input.consultant.firstName} ${input.consultant.lastName}`.trim();
  const echteWeek = canonicalWeekFromDates(monday);
  const weekNr = echteWeek ? String(echteWeek.isoWeek) : input.weekKey;

  // Alles wat uit de plaatsing komt één keer veilig uitpakken — zonder plaatsing
  // blijft het op de nulstand staan en vallen die controles vanzelf weg.
  const bevoegden = (p?.approverNames ?? []).filter(Boolean);
  const maxDag = p && isNum(p.maxPaidHoursPerDay) && p.maxPaidHoursPerDay > 0 ? p.maxPaidHoursPerDay : null;
  const overurenAfspraak = !!p && ((p.overtimeSurchargeBuy ?? 0) > 0 || (p.overtimeCostRate ?? 0) > 0);
  const weekendAfspraak =
    !!p &&
    ((p.weekendSurchargeBuy ?? 0) > 0 ||
      (p.saturdaySurchargeBuy ?? 0) > 0 ||
      (p.sundaySurchargeBuy ?? 0) > 0);
  const kmTarief = p && isNum(p.kmRateBuy) ? p.kmRateBuy : 0;
  const contractTarief = p && isNum(p.costRate) && p.costRate > 0 ? p.costRate : null;
  // Dagtarief: de factuur noemt dagen × dagtarief; teksten zeggen dan "per dag".
  const dagtarief = !!p && isDagtarief(p);
  const perEenheid = dagtarief ? "per dag" : "per uur";
  const pe = dagtarief ? "p/dag" : "p/u";

  // --- de uren, één keer uitgerekend ---------------------------------------
  const entries = ts ? entriesVan(ts.days, monday) : [];
  const dagUren = round2(entries.reduce((s, e) => s + e.hours, 0));
  const overuren = ts && isNum(ts.overtimeHours) ? round2(ts.overtimeHours) : 0;
  const km = ts && isNum(ts.kilometers) ? round2(ts.kilometers) : 0;
  const gewerkteDagen = entries.length;
  const weekendUren = round2(
    entries.filter((e) => isWeekendDate(e.date)).reduce((s, e) => s + e.hours, 0),
  );
  const feestdagUren = round2(
    entries
      .filter((e) => !isWeekendDate(e.date) && isDutchHoliday(e.date))
      .reduce((s, e) => s + e.hours, 0),
  );
  const bijzondereUren = round2(weekendUren + feestdagUren);

  // Het verwachte INKOOPbedrag komt uit dezelfde functie die de factuurregels
  // bouwt — nooit een eigen formule (zie src/lib/toeslag.ts).
  const geld = p
    ? computeTimesheetMoney({ entries, overtimeHours: overuren, kilometers: km }, p)
    : null;

  // =========================================================================
  // CONTRACT
  // =========================================================================
  if (!p) {
    add(
      "contract",
      "contract-plaatsing",
      "error",
      "Geen actieve plaatsing",
      `${volledigeNaam || "Deze persoon"} heeft geen actieve plaatsing in deze week — koppel de persoon eerst aan een plaatsing voordat de week verwerkt kan worden.`,
    );
  } else {
    add(
      "contract",
      "contract-plaatsing",
      "ok",
      "Actieve plaatsing",
      `${volledigeNaam} werkt deze week bij ${schoon(p.clientName) ?? "de opdrachtgever"}${
        schoon(p.workLocation) ? ` (${schoon(p.workLocation)})` : ""
      }.`,
    );

    const tarievenOk = isNum(p.costRate) && p.costRate > 0 && isNum(p.chargeRate) && p.chargeRate > 0;
    add(
      "contract",
      "contract-tarieven",
      tarievenOk ? "ok" : "error",
      "Tarieven vastgelegd",
      tarievenOk
        ? `Inkoop ${formatCurrency(p.costRate)} ${pe}, verkoop ${formatCurrency(p.chargeRate)} ${pe}.`
        : `Inkoop- of verkooptarief ontbreekt op de plaatsing (inkoop ${formatCurrency(
            p.costRate ?? 0,
          )}, verkoop ${formatCurrency(p.chargeRate ?? 0)}) — zonder tarieven valt er niets te controleren.`,
    );

    // De marge wordt op de ECHTE weekbedragen beoordeeld (verkoop − inkoop uit
    // computeTimesheetMoney), niet op een omgerekend uurtarief: met toeslagen of
    // kilometers erbij komt een "bedrag ÷ uren" boven het kale verkooptarief uit
    // en zou een gezonde week vals als negatieve marge gemeld worden. Zonder
    // uren valt er nog niets te berekenen — dan toetsen we alleen de tarieven.
    if (geld && geld.hours > 0) {
      const marge = geld.margin;
      add(
        "contract",
        "contract-marge",
        marge > 0 ? "ok" : "error",
        marge > 0 ? "Marge positief" : "Marge niet positief",
        marge > 0
          ? `Verkoop ${formatCurrency(geld.sell.total)} tegenover inkoop ${formatCurrency(
              geld.buy.total,
            )} — marge ${formatCurrency(marge)} deze week.`
          : `Verkoop ${formatCurrency(geld.sell.total)} is niet hoger dan inkoop ${formatCurrency(
              geld.buy.total,
            )} (marge ${formatCurrency(marge)}) — controleer de tarieven en toeslagen op de plaatsing.`,
      );
    } else {
      const marge = evaluateMargin({
        hoursOnInvoice: null,
        invoiceAmount: null,
        costRate: p.costRate,
        chargeRate: p.chargeRate,
        expectedMarginPerHour: null,
      });
      add(
        "contract",
        "contract-marge",
        marge.belowNorm ? "error" : "ok",
        marge.belowNorm ? "Marge niet positief" : "Marge positief",
        marge.belowNorm
          ? `De ${marge.reason ?? "marge klopt niet"} — controleer het tarief op de plaatsing.`
          : `Afgesproken marge ${formatCurrency(marge.marginPerHour ?? 0)} per uur; er zijn nog geen uren om op te rekenen.`,
      );
    }

    add(
      "contract",
      "contract-klant",
      p.hasClient ? "ok" : "error",
      "Klant gekoppeld",
      p.hasClient
        ? `Verkoopfactuur gaat naar ${schoon(p.clientName) ?? "de gekoppelde klant"}.`
        : "De plaatsing heeft geen gekoppelde klant — er kan geen verkoopfactuur gemaakt worden.",
    );
  }

  // =========================================================================
  // TIMESHEET
  // =========================================================================
  if (!ts) {
    const telaat = input.now.getTime() > deadline.getTime();
    add(
      "timesheet",
      "timesheet-tijdig",
      telaat ? "warn" : "ok",
      telaat ? "Deadline verstreken" : "Nog binnen de deadline",
      telaat
        ? `Er is nog niets ontvangen; de deadline (${DEADLINE_LABEL}, ${formatDate(deadline)}) is verstreken.`
        : `Er is nog niets ontvangen; de deadline is ${DEADLINE_LABEL} (${formatDate(deadline)}).`,
    );
  } else {
    // 1) Handtekening -------------------------------------------------------
    add(
      "timesheet",
      "timesheet-handtekening",
      ts.signaturePresent === true ? "ok" : ts.signaturePresent === false ? "error" : "warn",
      ts.signaturePresent === false ? "Handtekening ontbreekt" : "Ondertekend",
      ts.signaturePresent === true
        ? `Getekend${schoon(ts.signerName) ? ` door ${schoon(ts.signerName)}` : ""}.`
        : ts.signaturePresent === false
          ? "Er staat geen handtekening van de opdrachtgever op de urenstaat — vraag een getekende versie op."
          : "Er is niet vast te stellen of de urenstaat getekend is — kijk het document zelf na.",
    );

    // 2) Bevoegde ondertekenaar --------------------------------------------
    const signer = schoon(ts.signerName);
    if (bevoegden.length === 0) {
      add(
        "timesheet",
        "timesheet-ondertekenaar",
        "warn",
        "Bevoegdheid niet te toetsen",
        `Er zijn geen bevoegde ondertekenaars vastgelegd bij de plaatsing${
          signer ? `; getekend door ${signer}` : ""
        } — vul ze in bij de plaatsing zodat dit automatisch gecontroleerd wordt.`,
      );
    } else if (!signer) {
      add(
        "timesheet",
        "timesheet-ondertekenaar",
        "warn",
        "Ondertekenaar onbekend",
        `Er is geen naam van de ondertekenaar uitgelezen; bevoegd zijn: ${bevoegden.join(", ")}.`,
      );
    } else {
      const bevoegd = ondertekenaarBevoegd(signer, bevoegden);
      add(
        "timesheet",
        "timesheet-ondertekenaar",
        bevoegd ? "ok" : "error",
        bevoegd ? "Getekend door een bevoegde" : "Ondertekenaar niet bevoegd",
        bevoegd
          ? `${signer} staat op de plaatsing als bevoegde ondertekenaar.`
          : `${signer} staat niet op de plaatsing als bevoegde ondertekenaar; bevoegd zijn: ${bevoegden.join(", ")}.`,
      );
    }

    // 3) Weeknummer ---------------------------------------------------------
    const afwijking = weekMismatch({ canonicalWeek: echteWeek, typedWeek: ts.typedWeekNumber });
    add(
      "timesheet",
      "timesheet-weeknummer",
      afwijking ? "warn" : "ok",
      afwijking ? "Weeknummer wijkt af" : "Weeknummer klopt",
      afwijking
        ? weekMismatchLabel(afwijking)
        : `De gewerkte dagen vallen in week ${weekNr} — dat is de week die wij aanhouden.`,
    );

    // 4) Uren binnen band / t.o.v. het eigen gemiddelde ----------------------
    const avg = input.prior.recentAvgHours;
    const genoegHistorie = isNum(avg) && avg > 0 && input.prior.recentWeeks >= GATE_MIN_HISTORY_WEEKS;
    if (dagUren < GATE_MIN_WEEKLY_HOURS || dagUren > GATE_MAX_WEEKLY_HOURS) {
      add(
        "timesheet",
        "timesheet-urenband",
        "error",
        "Weektotaal buiten de bandbreedte",
        `Weektotaal ${formatHours(dagUren)} u valt buiten ${formatHours(GATE_MIN_WEEKLY_HOURS)}–${formatHours(
          GATE_MAX_WEEKLY_HOURS,
        )} u — controleer de uitlezing.`,
      );
    } else if (genoegHistorie && dagUren === 0) {
      add(
        "timesheet",
        "timesheet-urenband",
        "error",
        "Geen uren op de staat",
        `0 uren terwijl het eigen gemiddelde ${formatHours(avg)} u is (laatste ${input.prior.recentWeeks} weken).`,
      );
    } else if (genoegHistorie && dagUren > GATE_RELATIVE_FACTOR * avg) {
      add(
        "timesheet",
        "timesheet-urenband",
        "warn",
        "Uren wijken af van het eigen gemiddelde",
        `${formatHours(dagUren)} u tegenover een gemiddelde van ${formatHours(avg)} u (laatste ${
          input.prior.recentWeeks
        } weken).`,
      );
    } else {
      add(
        "timesheet",
        "timesheet-urenband",
        "ok",
        "Weektotaal plausibel",
        genoegHistorie
          ? `${formatHours(dagUren)} u, in lijn met het eigen gemiddelde van ${formatHours(avg)} u.`
          : `${formatHours(dagUren)} u — nog te weinig historie voor een vergelijking met het eigen gemiddelde.`,
      );
    }

    // 5) Pauze verrekend ----------------------------------------------------
    if (maxDag === null) {
      add(
        "timesheet",
        "timesheet-pauze",
        "ok",
        "Pauzeregel",
        "Er is geen maximum aan uit te betalen uren per dag afgesproken, dus hier valt niets te verrekenen.",
      );
    } else {
      const teLang = entries.filter((e) => e.hours > maxDag + TOLERANTIE_AANTAL);
      add(
        "timesheet",
        "timesheet-pauze",
        teLang.length > 0 ? "error" : "ok",
        teLang.length > 0 ? "Pauze niet verrekend" : "Pauze verrekend",
        teLang.length > 0
          ? `${teLang.length} ${teLang.length === 1 ? "dag" : "dagen"} van ${formatHours(
              Math.max(...teLang.map((e) => e.hours)),
            )} u, terwijl het contract maximaal ${formatHours(maxDag)} u per dag uitbetaalt.`
          : `Geen dag boven het contractmaximum van ${formatHours(maxDag)} u.`,
      );
    }

    // 6) Overuren gespecificeerd -------------------------------------------
    const langeDag = entries.find((e) => e.hours > DAG_UREN_NORM + TOLERANTIE_AANTAL) ?? null;
    const langeWeek = dagUren > WEEK_UREN_NORM + TOLERANTIE_AANTAL;
    if (overurenAfspraak && overuren <= 0 && (langeDag !== null || langeWeek)) {
      add(
        "timesheet",
        "timesheet-overuren",
        "warn",
        "Overuren niet gespecificeerd",
        langeDag
          ? `Er is ${formatHours(langeDag.hours)} u op ${formatDate(langeDag.date)} geschreven (norm ${formatHours(
              DAG_UREN_NORM,
            )} u), maar er staan geen overuren op de staat.`
          : `Het weektotaal is ${formatHours(dagUren)} u (norm ${formatHours(
              WEEK_UREN_NORM,
            )} u), maar er staan geen overuren op de staat.`,
      );
    } else {
      add(
        "timesheet",
        "timesheet-overuren",
        "ok",
        "Overuren",
        overuren > 0
          ? `${formatHours(overuren)} overuren apart opgegeven.`
          : overurenAfspraak
            ? "Geen overuren deze week, en de dagen blijven binnen de norm."
            : "Er is geen overuren-afspraak op de plaatsing.",
      );
    }

    // 7) Weekend-/feestdaguren apart ---------------------------------------
    if (bijzondereUren > 0 && weekendAfspraak) {
      const delen = [
        weekendUren > 0 ? `${formatHours(weekendUren)} u in het weekend` : null,
        feestdagUren > 0 ? `${formatHours(feestdagUren)} u op een feestdag` : null,
      ].filter(Boolean);
      add(
        "timesheet",
        "timesheet-weekend",
        "warn",
        "Weekend-/feestdaguren automatisch gesplitst",
        `${delen.join(" en ")} — wij hebben ze op basis van de datums zelf als toeslaguren gesplitst; controleer het even.`,
      );
    } else {
      add(
        "timesheet",
        "timesheet-weekend",
        "ok",
        "Weekend-/feestdaguren",
        bijzondereUren > 0
          ? `${formatHours(bijzondereUren)} u in het weekend of op een feestdag, maar de plaatsing kent daar geen toeslag voor.`
          : "Er is niet in het weekend of op een feestdag gewerkt.",
      );
    }

    // 8) Projectgegevens ----------------------------------------------------
    const projectFouten: string[] = [];
    if (p && !tekstMatcht(ts.clientName, p.clientName)) {
      projectFouten.push(
        `klant "${schoon(ts.clientName)}" op de staat tegenover "${schoon(p.clientName)}" op de plaatsing`,
      );
    }
    if (p && !tekstMatcht(ts.location, p.workLocation)) {
      projectFouten.push(
        `locatie "${schoon(ts.location)}" op de staat tegenover "${schoon(p.workLocation)}" op de plaatsing`,
      );
    }
    const staatPo = normCode(ts.poNumber);
    const contractPo = normCode(p?.poNumber);
    if (staatPo && contractPo && staatPo !== contractPo) {
      projectFouten.push(
        `PO ${schoon(ts.poNumber)} op de staat tegenover PO ${schoon(p?.poNumber)} in het contract`,
      );
    }
    add(
      "timesheet",
      "timesheet-project",
      projectFouten.length > 0 ? "error" : "ok",
      projectFouten.length > 0 ? "Onjuiste projectgegevens" : "Projectgegevens kloppen",
      projectFouten.length > 0
        ? `${projectFouten.join("; ")} — controleer of deze uren bij de juiste plaatsing horen.`
        : "Klant, locatie en PO op de staat komen overeen met de plaatsing.",
    );

    // 9) Reiskosten ---------------------------------------------------------
    const reisUren = isNum(ts.travelHours) && ts.travelHours > 0 ? ts.travelHours : 0;
    const onkosten = isNum(ts.expenses) && ts.expenses > 0 ? ts.expenses : 0;
    if (km > 0 && kmTarief <= 0) {
      add(
        "timesheet",
        "timesheet-reiskosten",
        "warn",
        "Kilometers zonder vergoeding",
        `Er staan ${formatHours(km)} km op de staat, maar de plaatsing kent geen kilometervergoeding — die km worden niet uitbetaald.`,
      );
    } else if (km > 0 && (reisUren > 0 || onkosten > 0)) {
      const delen = [
        reisUren > 0 ? `${formatHours(reisUren)} reisuren` : null,
        onkosten > 0 ? `${formatCurrency(onkosten)} onkosten` : null,
      ].filter(Boolean);
      add(
        "timesheet",
        "timesheet-reiskosten",
        "warn",
        "Reiskosten lopen door elkaar",
        `Naast ${formatHours(km)} km staan er ook ${delen.join(" en ")} op de staat — controleer of dit niet dubbel vergoed wordt.`,
      );
    } else {
      add(
        "timesheet",
        "timesheet-reiskosten",
        "ok",
        "Reiskosten",
        km > 0
          ? `${formatHours(km)} km à ${formatCurrency(kmTarief)} per km.`
          : "Er zijn geen kilometers of reiskosten gemeld.",
      );
    }

    // 10) Dubbele urenregistratie ------------------------------------------
    const anderen = new Set((input.prior.otherTimesheetDays ?? []).filter(Boolean));
    const dubbeleDagen = entries.filter((e) => anderen.has(alsSleutel(e.date)));
    add(
      "timesheet",
      "timesheet-dubbel",
      dubbeleDagen.length > 0 ? "error" : "ok",
      dubbeleDagen.length > 0 ? "Dubbele urenregistratie" : "Geen dubbele uren",
      dubbeleDagen.length > 0
        ? `${dubbeleDagen.map((d) => formatDate(d.date)).join(", ")} ${
            dubbeleDagen.length === 1 ? "staat" : "staan"
          } ook al op een andere urenstaat van ${volledigeNaam}.`
        : "Geen van deze dagen staat op een andere urenstaat.",
    );

    // 11) Op tijd ingeleverd ------------------------------------------------
    const ontvangen = isDatum(ts.receivedAt) ? ts.receivedAt : null;
    const telaat = ontvangen !== null && ontvangen.getTime() > deadline.getTime();
    add(
      "timesheet",
      "timesheet-tijdig",
      telaat ? "warn" : "ok",
      telaat ? "Te laat ingestuurd" : "Op tijd ingestuurd",
      telaat
        ? `Ontvangen op ${formatDate(ontvangen)}, ná de deadline van ${DEADLINE_LABEL} (${formatDate(deadline)}).`
        : ontvangen
          ? `Ontvangen op ${formatDate(ontvangen)}, binnen de deadline van ${DEADLINE_LABEL}.`
          : `Er is geen ontvangstdatum bekend; de deadline is ${DEADLINE_LABEL} (${formatDate(deadline)}).`,
    );

    // 12) Leesbaarheid ------------------------------------------------------
    const confidence = (ts.confidence ?? "").trim().toLowerCase();
    const onleesbaar = confidence === "low";
    const paginasWeg = ts.pagesComplete === false;
    add(
      "timesheet",
      "timesheet-leesbaar",
      onleesbaar || paginasWeg ? "error" : "ok",
      onleesbaar || paginasWeg ? "Staat niet goed leesbaar" : "Staat goed leesbaar",
      paginasWeg
        ? "Er ontbreken pagina's of delen van de urenstaat — vraag een complete versie op."
        : onleesbaar
          ? "De uitlezing was onzeker (lage betrouwbaarheid) — controleer elk getal met het document ernaast."
          : `De uitlezing was ${confidence === "medium" ? "redelijk" : "goed"} leesbaar en compleet.`,
    );

    // 13) Naam --------------------------------------------------------------
    const gelezenNaam = schoon(ts.name);
    if (!gelezenNaam) {
      add(
        "timesheet",
        "timesheet-naam",
        "warn",
        "Geen naam op de staat",
        `Er is geen naam uitgelezen — controleer of deze staat van ${volledigeNaam} is.`,
      );
    } else {
      const klopt = nameMatches(
        { firstName: input.consultant.firstName, lastName: input.consultant.lastName },
        gelezenNaam,
      );
      add(
        "timesheet",
        "timesheet-naam",
        klopt ? "ok" : "error",
        klopt ? "Naam klopt" : "Verkeerde naam",
        klopt
          ? `De staat staat op naam van ${gelezenNaam}.`
          : `Op de staat staat "${gelezenNaam}", maar deze week hoort bij ${volledigeNaam}.`,
      );
    }
  }

  // =========================================================================
  // FACTUUR (alleen ZZP: een medewerker in dienst stuurt geen factuur)
  // =========================================================================
  if (isZZP && !inv) {
    if (ts) {
      add(
        "factuur",
        "factuur-ontbreekt",
        "warn",
        "Factuur nog niet ontvangen",
        `De urenstaat is binnen, maar ${volledigeNaam} heeft nog geen factuur gestuurd voor deze week.`,
      );
    }
  } else if (isZZP && inv) {
    const exBtw = factuurExBtw(inv);

    // PO --------------------------------------------------------------------
    const factuurPo = normCode(inv.poNumber);
    const vereistPo = normCode(p?.poNumber);
    if (!vereistPo) {
      add("factuur", "factuur-po", "ok", "PO-nummer", "De plaatsing vereist geen PO-nummer op de factuur.");
    } else if (!factuurPo) {
      add(
        "factuur",
        "factuur-po",
        "error",
        "PO ontbreekt op de factuur",
        `De plaatsing werkt met PO ${schoon(p?.poNumber)}; dat nummer staat niet op zijn factuur.`,
      );
    } else if (factuurPo !== vereistPo) {
      add(
        "factuur",
        "factuur-po",
        "error",
        "Verkeerde PO op de factuur",
        `Op de factuur staat PO ${schoon(inv.poNumber)}, in het contract staat PO ${schoon(p?.poNumber)}.`,
      );
    } else {
      add("factuur", "factuur-po", "ok", "PO klopt", `PO ${schoon(inv.poNumber)} staat op de factuur.`);
    }

    // Geadresseerde ---------------------------------------------------------
    const aan = schoon(inv.addressee);
    const namen = [input.company.companyName, ...(input.company.aliases ?? [])].filter(Boolean);
    if (!aan) {
      add(
        "factuur",
        "factuur-geadresseerde",
        "warn",
        "Geadresseerde onbekend",
        `Er is geen geadresseerde uitgelezen; de factuur hoort aan ${input.company.companyName} gericht te zijn.`,
      );
    } else {
      const juist = namen.some((n) => tekstMatcht(aan, n));
      add(
        "factuur",
        "factuur-geadresseerde",
        juist ? "ok" : "error",
        juist ? "Aan Q4S gericht" : "Verkeerde geadresseerde",
        juist
          ? `Gericht aan ${aan}.`
          : `De factuur is gericht aan "${aan}" in plaats van aan ${input.company.companyName}.`,
      );
    }

    // Factuurnummer ---------------------------------------------------------
    const nummer = schoon(inv.number);
    const nummerSleutel = (nummer ?? "").toLowerCase();
    const zelfdeNummer = nummerSleutel
      ? (input.prior.priorInvoices ?? []).filter(
          (q) => (schoon(q.number) ?? "").toLowerCase() === nummerSleutel,
        )
      : [];
    if (!nummer) {
      add(
        "factuur",
        "factuur-nummer",
        "error",
        "Factuurnummer ontbreekt",
        "Er staat geen factuurnummer op de factuur — zonder nummer kan hij niet geboekt worden.",
      );
    } else if (zelfdeNummer.length > 0) {
      add(
        "factuur",
        "factuur-nummer",
        "error",
        "Dubbel factuurnummer",
        `Factuurnummer ${nummer} is eerder gebruikt door ${volledigeNaam}.`,
      );
    } else {
      add("factuur", "factuur-nummer", "ok", "Factuurnummer", `Factuurnummer ${nummer} is nieuw.`);
    }

    // Uurtarief -------------------------------------------------------------
    const factuurTarief = isNum(inv.hourlyRate) && inv.hourlyRate > 0 ? inv.hourlyRate : null;
    const tariefWijktAf =
      factuurTarief !== null &&
      contractTarief !== null &&
      Math.abs(round2(factuurTarief - contractTarief)) > TOLERANTIE_AANTAL;
    if (factuurTarief === null) {
      add(
        "factuur",
        "factuur-tarief",
        "warn",
        dagtarief ? "Geen dagtarief op de factuur" : "Geen uurtarief op de factuur",
        `Er staat geen tarief op de factuur; afgesproken is ${formatCurrency(contractTarief ?? 0)} ${perEenheid}.`,
      );
    } else {
      add(
        "factuur",
        "factuur-tarief",
        tariefWijktAf ? "error" : "ok",
        tariefWijktAf ? (dagtarief ? "Verkeerd dagtarief" : "Verkeerd uurtarief") : dagtarief ? "Dagtarief klopt" : "Uurtarief klopt",
        tariefWijktAf
          ? `Op de factuur staat ${formatCurrency(factuurTarief)} ${perEenheid}, afgesproken is ${formatCurrency(
              contractTarief ?? 0,
            )} ${perEenheid}.`
          : `${formatCurrency(factuurTarief)} ${perEenheid}, zoals afgesproken.`,
      );
    }

    // Uren ------------------------------------------------------------------
    const factuurUren = isNum(inv.hours) ? round2(inv.hours) : null;
    // Bij een dagtarief mag de factuur dagen tellen in plaats van uren.
    const klopt = (n: number) => Math.abs(round2(factuurUren! - n)) <= TOLERANTIE_AANTAL;
    const urenWijktAf =
      factuurUren !== null && ts !== null && !klopt(dagUren) && !(dagtarief && klopt(gewerkteDagen));
    if (factuurUren === null) {
      add(
        "factuur",
        "factuur-uren",
        "warn",
        "Geen uren op de factuur",
        `Er is geen urenaantal van de factuur uitgelezen; de staat telt ${formatHours(dagUren)} u.`,
      );
    } else {
      add(
        "factuur",
        "factuur-uren",
        urenWijktAf ? "error" : "ok",
        urenWijktAf ? "Afwijkende uren" : "Uren kloppen",
        urenWijktAf
          ? `${formatHours(dagUren)} u op de urenstaat tegenover ${formatHours(factuurUren)} u op de factuur.`
          : `${formatHours(factuurUren)} u, gelijk aan de urenstaat.`,
      );
    }

    // Overuren --------------------------------------------------------------
    const factuurOveruren = isNum(inv.overtimeHours) ? round2(inv.overtimeHours) : 0;
    const overurenWijktAf =
      ts !== null && Math.abs(round2(factuurOveruren - overuren)) > TOLERANTIE_AANTAL;
    add(
      "factuur",
      "factuur-overuren",
      overurenWijktAf ? "error" : "ok",
      overurenWijktAf ? "Afwijkende overuren" : "Overuren kloppen",
      overurenWijktAf
        ? `${formatHours(overuren)} overuren op de urenstaat tegenover ${formatHours(
            factuurOveruren,
          )} op de factuur.`
        : `${formatHours(factuurOveruren)} overuren, gelijk aan de urenstaat.`,
    );

    // BTW -------------------------------------------------------------------
    const buitenlandsBtwNr =
      !!schoon(input.consultant.vatNumber) &&
      !/^NL/i.test((input.consultant.vatNumber ?? "").trim());
    const verlegdVerwacht = p?.vatReverseCharge === true || buitenlandsBtwNr;
    const reden = p?.vatReverseCharge === true ? "de plaatsing staat op btw verlegd" : "het btw-nummer is buitenlands";
    const factuurVerlegd = inv.vatShifted === true;
    const pct = isNum(inv.vatPercent) ? inv.vatPercent : null;
    if (verlegdVerwacht) {
      const juist = factuurVerlegd && (pct === null || pct === 0);
      add(
        "factuur",
        "factuur-btw",
        juist ? "ok" : "error",
        juist ? "BTW verlegd, zoals afgesproken" : "Onjuiste btw",
        juist
          ? "De factuur vermeldt btw verlegd (0%), zoals afgesproken."
          : `De factuur rekent ${pct === null ? "een niet-uitgelezen btw-percentage" : `${formatHours(pct)}% btw`}, terwijl de btw verlegd hoort te zijn (${reden}).`,
      );
    } else {
      const juist = !factuurVerlegd && pct !== null && pct === STANDAARD_BTW_PCT;
      add(
        "factuur",
        "factuur-btw",
        juist ? "ok" : "error",
        juist ? "BTW klopt" : "Onjuiste btw",
        juist
          ? `${formatHours(STANDAARD_BTW_PCT)}% btw, zoals verwacht.`
          : factuurVerlegd
            ? `De factuur vermeldt btw verlegd, maar er is geen verleggingsregeling afgesproken — verwacht ${formatHours(STANDAARD_BTW_PCT)}% btw.`
            : `De factuur vermeldt ${pct === null ? "geen btw-percentage" : `${formatHours(pct)}% btw`}, verwacht is ${formatHours(STANDAARD_BTW_PCT)}%.`,
      );
    }

    // Bedrijfsgegevens ------------------------------------------------------
    const ontbreekt: string[] = [];
    if (!schoon(inv.kvkNumber)) ontbreekt.push("KvK-nummer");
    if (!schoon(inv.vatId)) ontbreekt.push("btw-identificatienummer");
    add(
      "factuur",
      "factuur-bedrijfsgegevens",
      ontbreekt.length > 0 ? "error" : "ok",
      ontbreekt.length > 0 ? "Bedrijfsgegevens ontbreken" : "Bedrijfsgegevens compleet",
      ontbreekt.length > 0
        ? `${ontbreekt.join(" en ")} ${ontbreekt.length === 1 ? "ontbreekt" : "ontbreken"} op de factuur; dat is wettelijk verplicht.`
        : `KvK ${schoon(inv.kvkNumber)} en btw-id ${schoon(inv.vatId)} staan op de factuur.`,
    );

    // Periode over meerdere weken -------------------------------------------
    const weken =
      isDatum(inv.periodStart) && isDatum(inv.periodEnd)
        ? wekenInPeriode(inv.periodStart, inv.periodEnd)
        : null;
    if (weken === null) {
      add(
        "factuur",
        "factuur-periode",
        "ok",
        "Factuurperiode",
        "De factuur noemt geen periode, dus er valt geen week-specificatie te vragen.",
      );
    } else if (weken > 1) {
      add(
        "factuur",
        "factuur-periode",
        "warn",
        "Factuurperiode beslaat meerdere weken",
        `De periode ${formatDate(inv.periodStart)} – ${formatDate(inv.periodEnd)} beslaat ${weken} weken; vraag een specificatie per week zodat elke week los af te boeken is.`,
      );
    } else {
      add(
        "factuur",
        "factuur-periode",
        "ok",
        "Factuurperiode",
        `Eén week: ${formatDate(inv.periodStart)} – ${formatDate(inv.periodEnd)}.`,
      );
    }

    // Dubbele facturatie ----------------------------------------------------
    const alGefactureerd = (input.prior.priorInvoices ?? []).filter((q) =>
      periodeDektWeek(q.periodStart, q.periodEnd, monday),
    );
    add(
      "factuur",
      "factuur-dubbele-facturatie",
      alGefactureerd.length > 0 ? "error" : "ok",
      alGefactureerd.length > 0 ? "Dubbele facturatie" : "Nog niet eerder gefactureerd",
      alGefactureerd.length > 0
        ? `Deze week is al gefactureerd op ${alGefactureerd
            .map((q) => schoon(q.number) ?? `factuur van ${formatDate(q.periodStart)}`)
            .join(", ")}.`
        : "Er is nog geen eerdere factuur van deze persoon die deze week beslaat.",
    );

    // Valuta ----------------------------------------------------------------
    const valuta = schoon(inv.currency);
    const afgesproken = schoon(p?.currency) ?? "EUR";
    const valutaFout = valuta !== null && valuta.toUpperCase() !== afgesproken.toUpperCase();
    add(
      "factuur",
      "factuur-valuta",
      valutaFout ? "error" : "ok",
      valutaFout ? "Verkeerde valuta" : "Valuta klopt",
      valutaFout
        ? `De factuur staat in ${valuta}, afgesproken is ${afgesproken}.`
        : `${valuta ?? afgesproken} — zoals afgesproken.`,
    );

    // Bijlage / onderbouwing -------------------------------------------------
    add(
      "factuur",
      "factuur-bijlage",
      ts ? "ok" : "error",
      ts ? "Urenstaat als onderbouwing" : "Onderbouwing ontbreekt",
      ts
        ? `De urenstaat van deze week ligt ernaast${inv.mentionsAttachment === true ? " en de factuur verwijst ernaar" : ""}.`
        : "Er is voor deze week geen urenstaat ontvangen — de factuur mist zijn onderbouwing.",
    );

    // Toeslagen vs. contract -------------------------------------------------
    const toeslagFouten: string[] = [];
    const toeslagMissers: string[] = [];
    const buyKant = p ? sideSurcharges(p, "buy") : null;
    for (const soort of TOESLAG_SOORTEN) {
      const regel = factuurToeslag(inv.surchargeLines, soort);
      const instelling = buyKant?.[soort];
      const perDag = PER_DAG.includes(soort);
      const actief =
        !!instelling &&
        instelling.value > 0 &&
        (perDag ? instelling.enabled : true) &&
        (perDag ? gewerkteDagen > 0 : verwachtToeslagUren(soort, entries) > 0);

      if (regel && !actief) {
        toeslagFouten.push(
          `${surchargeName(soort).toLowerCase()} staat op de factuur${
            isNum(regel.quantity) ? ` (${formatHours(regel.quantity)}${regel.unit ? ` ${regel.unit}` : ""})` : ""
          } maar is niet in het contract afgesproken`,
        );
        continue;
      }
      if (!actief) continue;
      if (!regel) {
        toeslagMissers.push(`${surchargeName(soort).toLowerCase()} staat niet op de factuur`);
        continue;
      }
      if (!isNum(regel.quantity)) continue; // geen aantal uitgelezen → niets te vergelijken
      const verwachtDagen = gewerkteDagen;
      const verwachtUren = perDag ? dagUren : verwachtToeslagUren(soort, entries);
      const klopt = perDag
        ? dichtbij(regel.quantity, verwachtDagen) || dichtbij(regel.quantity, verwachtUren)
        : dichtbij(regel.quantity, verwachtUren);
      if (!klopt) {
        toeslagFouten.push(
          perDag
            ? `${surchargeName(soort).toLowerCase()}: ${formatHours(regel.quantity)} op de factuur tegenover ${formatHours(
                verwachtDagen,
              )} gewerkte dagen`
            : `${surchargeName(soort).toLowerCase()}: ${formatHours(regel.quantity)} u op de factuur tegenover ${formatHours(
                verwachtUren,
              )} u op de staat`,
        );
      }
    }
    add(
      "factuur",
      "factuur-toeslagen",
      toeslagFouten.length > 0 ? "error" : toeslagMissers.length > 0 ? "warn" : "ok",
      toeslagFouten.length > 0
        ? "Toeslagen wijken af van het contract"
        : toeslagMissers.length > 0
          ? "Toeslag niet gefactureerd"
          : "Toeslagen kloppen",
      toeslagFouten.length > 0
        ? `${toeslagFouten.join("; ")}.`
        : toeslagMissers.length > 0
          ? `${toeslagMissers.join("; ")} — hij laat daarmee geld liggen; stem het even af.`
          : "De toeslagregels op de factuur komen overeen met het contract.",
    );

    // Totaal vs. verwacht inkoop ---------------------------------------------
    const verwacht = geld ? geld.buy.total : null;
    if (verwacht === null || exBtw === null) {
      add(
        "factuur",
        "factuur-totaal",
        "warn",
        "Totaal niet te vergelijken",
        verwacht === null
          ? "Zonder actieve plaatsing is er geen verwacht inkoopbedrag om tegen te vergelijken."
          : "Er is geen bedrag van de factuur uitgelezen om tegen de urenstaat te leggen.",
      );
    } else {
      const verschil = round2(exBtw - verwacht);
      const fout = Math.abs(verschil) > TOLERANTIE_EUR;
      add(
        "factuur",
        "factuur-totaal",
        fout ? "error" : "ok",
        fout ? "Factuurtotaal wijkt af" : "Factuurtotaal klopt",
        fout
          ? `De factuur komt op ${formatCurrency(exBtw)} ex btw, volgens de urenstaat verwachten wij ${formatCurrency(
              verwacht,
            )} — een verschil van ${formatCurrency(verschil)}.`
          : `${formatCurrency(exBtw)} ex btw, gelijk aan wat de urenstaat oplevert.`,
      );
    }

    // =======================================================================
    // KOPPELING (match)
    // =======================================================================
    if (!isDatum(inv.periodStart) || !isDatum(inv.periodEnd)) {
      add(
        "match",
        "match-week",
        "warn",
        "Geen periode op de factuur",
        `De factuur noemt geen periode; de koppeling aan week ${weekNr} is handmatig gelegd.`,
      );
    } else {
      const dekt = periodeDektWeek(inv.periodStart, inv.periodEnd, monday);
      add(
        "match",
        "match-week",
        dekt ? "ok" : "error",
        dekt ? "Factuurperiode dekt de week" : "Factuurperiode dekt deze week niet",
        dekt
          ? `${formatDate(inv.periodStart)} – ${formatDate(inv.periodEnd)} valt over week ${weekNr}.`
          : `De factuurperiode ${formatDate(inv.periodStart)} – ${formatDate(
              inv.periodEnd,
            )} valt buiten week ${weekNr} (maandag ${formatDate(monday)}).`,
      );
    }

    // =======================================================================
    // FRAUDE
    // =======================================================================
    const factuurIban = normCode(inv.iban);
    const bekendIban = normCode(input.consultant.iban);
    if (!bekendIban) {
      add(
        "fraude",
        "fraude-iban",
        "warn",
        "Geen IBAN geregistreerd",
        `Er staat geen IBAN bij ${volledigeNaam} in het dossier${
          factuurIban ? `; op de factuur staat ${schoon(inv.iban)}` : ""
        } — leg het bankrekeningnummer eerst vast.`,
      );
    } else if (!factuurIban) {
      add(
        "fraude",
        "fraude-iban",
        "warn",
        "Geen IBAN op de factuur",
        "Er is geen IBAN van de factuur uitgelezen — controleer het rekeningnummer handmatig vóór betaling.",
      );
    } else {
      const gelijk = factuurIban === bekendIban;
      add(
        "fraude",
        "fraude-iban",
        gelijk ? "ok" : "error",
        gelijk ? "IBAN klopt" : "Ander IBAN dan geregistreerd",
        gelijk
          ? `Het IBAN op de factuur is hetzelfde als het geregistreerde rekeningnummer.`
          : `Op de factuur staat ${schoon(inv.iban)}, geregistreerd staat ${schoon(
              input.consultant.iban,
            )} — verifieer dit telefonisch via het bij ons bekende nummer vóór je betaalt. Een gewijzigd IBAN wordt nooit automatisch overgenomen.`,
      );
    }
  }

  // =========================================================================
  // DE VERGELIJKINGSTABEL
  // =========================================================================
  const comparison = bouwVergelijking({
    placement: p,
    timesheet: ts,
    invoice: isZZP ? inv : null,
    dagUren,
    overuren,
    km,
    bijzondereUren,
    gewerkteDagen,
  });

  // =========================================================================
  // STATUS
  // =========================================================================
  const heeftFout = checks.some((c) => c.level === "error");
  let status: WeekStatus;
  if (!ts && !inv) status = "NIET_INGELEVERD";
  else if (heeftFout && input.acceptedErrors !== true) status = "FOUT";
  else if (isZZP && ts && !inv) status = "WACHT";
  else status = "KLAAR";

  return { status, checks, comparison };
}

/** De uren waarover een dag-gebonden toeslag (doordeweeks/za/zo) hoort te gelden. */
function verwachtToeslagUren(soort: SurchargeKind, entries: { date: Date; hours: number }[]): number {
  if (soort === "weekday") return weekdayHoursOf(entries);
  if (soort === "saturday") return saturdayHoursOf(entries);
  if (soort === "sunday") return sundayHoursOf(entries);
  return 0;
}

function dichtbij(a: number, b: number): boolean {
  return Math.abs(round2(a - b)) <= TOLERANTIE_AANTAL;
}

/**
 * De vergelijkingstabel uit het ontwerp: per onderdeel wat de urenstaat zegt,
 * wat de factuur zegt en wat het contract zegt. `ok: false` kleurt de regel rood.
 * Zonder factuur valt er niets te vergelijken — dan is elke regel gewoon "ok".
 */
function bouwVergelijking(args: {
  placement: PlacementTerms | null;
  timesheet: TimesheetExtraction | null;
  invoice: InvoiceExtraction | null;
  dagUren: number;
  overuren: number;
  km: number;
  bijzondereUren: number;
  gewerkteDagen: number;
}): ComparisonRow[] {
  const { placement: p, timesheet: ts, invoice: inv } = args;
  const rows: ComparisonRow[] = [];
  const uren = (v: number | null) => (v === null ? null : formatHours(v));

  const factuurUren = inv && isNum(inv.hours) ? round2(inv.hours) : null;
  rows.push({
    key: "uren",
    label: "Normale uren",
    timesheet: ts ? uren(args.dagUren) : null,
    invoice: uren(factuurUren),
    contract: null,
    ok: !(ts && factuurUren !== null) || dichtbij(factuurUren, args.dagUren),
  });

  const factuurOveruren = inv ? round2(isNum(inv.overtimeHours) ? inv.overtimeHours : 0) : null;
  rows.push({
    key: "overuren",
    label: "Overuren",
    timesheet: ts ? uren(args.overuren) : null,
    invoice: uren(factuurOveruren),
    contract:
      p && (p.overtimeSurchargeBuy ?? 0) > 0 ? `+${formatHours(p.overtimeSurchargeBuy)}%` : null,
    ok: !(ts && factuurOveruren !== null) || dichtbij(factuurOveruren, args.overuren),
  });

  const weekendRegel = inv ? factuurToeslag(inv.surchargeLines, "weekend") : null;
  const zaRegel = inv ? factuurToeslag(inv.surchargeLines, "saturday") : null;
  const zoRegel = inv ? factuurToeslag(inv.surchargeLines, "sunday") : null;
  const weekendFactuur = round2(
    [weekendRegel, zaRegel, zoRegel].reduce(
      (s, r) => s + (r && isNum(r.quantity) ? r.quantity : 0),
      0,
    ),
  );
  const weekendOpFactuur = Boolean(weekendRegel || zaRegel || zoRegel);
  rows.push({
    key: "weekend",
    label: "Weekend-/feestdaguren",
    timesheet: ts ? uren(args.bijzondereUren) : null,
    invoice: weekendOpFactuur ? uren(weekendFactuur) : null,
    contract: p
      ? toeslagContractLabel(p, "saturday") ?? toeslagContractLabel(p, "sunday") ?? null
      : null,
    ok: !(ts && weekendOpFactuur) || dichtbij(weekendFactuur, args.bijzondereUren),
  });

  // Per aan-/uitgeschakelde dagtoeslag (offshore/ploegendienst/buitenland) een regel.
  if (p) {
    const buyKant = sideSurcharges(p, "buy");
    for (const soort of PER_DAG) {
      const instelling = buyKant[soort];
      const regel = inv ? factuurToeslag(inv.surchargeLines, soort) : null;
      if (!instelling.enabled && !regel) continue;
      const opFactuur = regel && isNum(regel.quantity) ? round2(regel.quantity) : null;
      const verwacht = instelling.enabled ? args.gewerkteDagen : null;
      rows.push({
        key: `toeslag-${soort}`,
        label: `${surchargeName(soort).replace("toeslag", "")}-dagen`,
        timesheet: verwacht === null ? null : `${formatHours(verwacht)} dagen`,
        invoice: opFactuur === null ? null : `${formatHours(opFactuur)} dagen`,
        contract: toeslagContractLabel(p, soort),
        ok:
          opFactuur === null ||
          verwacht === null ||
          dichtbij(opFactuur, verwacht) ||
          dichtbij(opFactuur, args.dagUren),
      });
    }
  }

  const factuurKm = inv && isNum(inv.kilometers) ? round2(inv.kilometers) : null;
  const kmTarief = p && isNum(p.kmRateBuy) ? p.kmRateBuy : 0;
  rows.push({
    key: "kilometers",
    label: "Kilometers",
    timesheet: ts ? uren(args.km) : null,
    invoice: uren(factuurKm),
    contract: kmTarief > 0 ? `${formatCurrency(kmTarief)}/km` : null,
    ok: !(ts && factuurKm !== null) || dichtbij(factuurKm, args.km),
  });

  const reisStaat = ts ? round2(args.km * kmTarief + (isNum(ts.expenses) ? ts.expenses : 0)) : null;
  const reisFactuur = factuurKm === null ? null : round2(factuurKm * kmTarief);
  rows.push({
    key: "reiskosten",
    label: "Reiskosten",
    timesheet: reisStaat === null ? null : formatCurrency(reisStaat),
    invoice: reisFactuur === null ? null : formatCurrency(reisFactuur),
    contract: kmTarief > 0 ? `${formatCurrency(kmTarief)}/km` : null,
    ok:
      reisStaat === null ||
      reisFactuur === null ||
      Math.abs(round2(reisStaat - reisFactuur)) <= TOLERANTIE_AANTAL,
  });

  const factuurTarief = inv && isNum(inv.hourlyRate) && inv.hourlyRate > 0 ? inv.hourlyRate : null;
  const contractTarief = p && isNum(p.costRate) && p.costRate > 0 ? p.costRate : null;
  rows.push({
    key: "uurtarief",
    label: p && isDagtarief(p) ? "Dagtarief" : "Uurtarief",
    timesheet: null,
    invoice: factuurTarief === null ? null : formatCurrency(factuurTarief),
    contract: contractTarief === null ? null : formatCurrency(contractTarief),
    ok:
      factuurTarief === null ||
      contractTarief === null ||
      Math.abs(round2(factuurTarief - contractTarief)) <= TOLERANTIE_AANTAL,
  });

  return rows;
}

/** Hoe het contract deze toeslag omschrijft; null als hij niet is ingesteld. */
function toeslagContractLabel(p: PlacementTerms, soort: SurchargeKind): string | null {
  const instelling = sideSurcharges(p, "buy")[soort];
  if (instelling.value <= 0) return null;
  return contractToeslagLabel(instelling.value, instelling.unit);
}
