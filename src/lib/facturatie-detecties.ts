import { formatCurrency, formatWeekLabel, round2 } from "./utils";

// ---------------------------------------------------------------------------
// Weekverwerking facturatie — vier losse detecties die de wekelijkse controle
// van binnengekomen ZZP-facturen en weekstaten grotendeels automatiseren:
//
//   1) evaluateMargin           — verdienen we er nog wat aan? (marge per uur)
//   2) summarizeRecurringFaults — is dit dezelfde fout als vorige keer?
//   3) findMissingTimesheets    — wie moet er nog een weekstaat inleveren?
//   4) detectDuplicates         — hebben we deze factuur al eens gezien?
//
// PUUR en DETERMINISTISCH, net als src/lib/timesheet-auto-gate.ts: geen Prisma,
// geen datum-van-nu, geen I/O. Alles komt als platte data binnen, zodat elke
// uitkomst herhaalbaar en los te testen is. De teksten zijn Nederlands en worden
// 1-op-1 aan de gebruiker getoond; de vlaggen hebben dezelfde { level, message }-
// vorm als de auto-gate en src/lib/inbox-extract.ts.
// ---------------------------------------------------------------------------

/** Vlag zoals de rest van de facturatie hem kent: 'error' = duidelijk mis,
 *  'warn' = plausibel maar wil menselijke ogen. */
export type DetectieFlag = { level: "warn" | "error"; message: string };

/** Alleen echte getallen tellen: null, NaN en Infinity zijn "onbekend". */
function isNum(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Een bruikbare datum (geen null, geen Invalid Date). */
function isDate(value: Date | null | undefined): value is Date {
  return value instanceof Date && Number.isFinite(value.getTime());
}

// ===========================================================================
// 1) MARGEBEWAKING
// ===========================================================================

export type MarginInput = {
  /** Uren die op de (ZZP-)factuur staan. */
  hoursOnInvoice: number | null;
  /** Totaalbedrag van die factuur (ex BTW). */
  invoiceAmount: number | null;
  /** Inkooptarief van de plaatsing (Placement.costRate) — terugval als er geen
   *  uren/bedrag op de factuur staan om mee te rekenen. */
  costRate: number | null;
  /** Verkooptarief van de plaatsing (Placement.chargeRate) — wat de klant betaalt. */
  chargeRate: number | null;
  /** Ondergrens die Q4S per uur wil overhouden; null = alleen "positief moet". */
  expectedMarginPerHour: number | null;
};

export type MarginResult = {
  /** Verkooptarief min het werkelijk gefactureerde uurbedrag; null = onbepaalbaar. */
  marginPerHour: number | null;
  belowNorm: boolean;
  /** Waarom het onder de norm ligt — ontbreekt als de marge in orde is. */
  reason?: string;
};

/**
 * Reken de ECHTE marge per uur uit: wat de klant per uur betaalt (`chargeRate`)
 * min wat de medewerker per uur factureert (`invoiceAmount / hoursOnInvoice`).
 * Die twee lopen in de praktijk uiteen — een ZZP'er die meer factureert dan het
 * afgesproken inkooptarief eet de marge op zonder dat het tarief in het systeem
 * verandert. Staan er geen bruikbare uren/bedragen op de factuur, dan valt de
 * berekening terug op het afgesproken `costRate` (en zegt dat er dan bij).
 *
 * Gemarkeerd (`belowNorm`) als de marge niet positief is, of onder de norm ligt.
 */
export function evaluateMargin(input: MarginInput): MarginResult {
  const charge = isNum(input.chargeRate) && input.chargeRate >= 0 ? input.chargeRate : null;

  // Wat de medewerker per uur in rekening brengt. Uren > 0 en een niet-negatief
  // bedrag zijn nodig om te kunnen delen; anders het afgesproken inkooptarief.
  const hours = isNum(input.hoursOnInvoice) && input.hoursOnInvoice > 0 ? input.hoursOnInvoice : null;
  const amount = isNum(input.invoiceAmount) && input.invoiceAmount >= 0 ? input.invoiceAmount : null;
  const fromInvoice = hours !== null && amount !== null ? round2(amount / hours) : null;
  const fallback = isNum(input.costRate) && input.costRate >= 0 ? input.costRate : null;
  const buyPerHour = fromInvoice ?? fallback;

  if (charge === null || buyPerHour === null) {
    return {
      marginPerHour: null,
      belowNorm: true,
      reason: "marge niet te bepalen — tarieven of factuurbedrag onbekend",
    };
  }

  const marginPerHour = round2(charge - buyPerHour);
  const norm = isNum(input.expectedMarginPerHour) ? input.expectedMarginPerHour : null;
  const normSuffix = norm !== null ? ` (norm ${formatCurrency(norm)}/u)` : "";
  // Rekenden we met het inkooptarief i.p.v. de factuur? Dat hoort de gebruiker te weten.
  const basisSuffix =
    fromInvoice === null ? " — geen uren op de factuur, gerekend met het inkooptarief" : "";

  if (marginPerHour <= 0) {
    return {
      marginPerHour,
      belowNorm: true,
      reason: `marge ${formatCurrency(marginPerHour)}/u is niet positief${normSuffix}${basisSuffix}`,
    };
  }

  if (norm !== null && marginPerHour < norm) {
    return {
      marginPerHour,
      belowNorm: true,
      reason: `marge ${formatCurrency(marginPerHour)}/u${normSuffix}${basisSuffix}`,
    };
  }

  return { marginPerHour, belowNorm: false };
}

// ===========================================================================
// 2) TERUGKERENDE FOUT
// ===========================================================================

/** Eén eerder geconstateerde fout; `type` is de omschrijving van het soort fout. */
export type PastFault = { type: string };

export type RecurringFaultResult = {
  /** Hoe vaak deze fout nu in totaal is voorgekomen (deze keer meegerekend). */
  count: number;
  /** "3e keer tarief te hoog" — ontbreekt bij de eerste keer. */
  label?: string;
};

/** Vergelijken doen we op de kale tekst: hoofdletters en spaties zijn ruis. */
function normalizeType(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/**
 * Tel hoe vaak dezelfde fout deze medewerker/klant al is aangerekend. Een tweede
 * of derde keer dezelfde fout is een ander gesprek dan een eenmalige misser —
 * daarom een expliciet label ("3e keer tarief te hoog") dat 1-op-1 getoond wordt.
 *
 * De eerste keer krijgt bewust géén label (dan is er nog geen patroon). Een leeg
 * `currentType` telt niets: er valt dan niets te vergelijken.
 */
export function summarizeRecurringFaults(
  pastFaults: PastFault[],
  currentType: string,
): RecurringFaultResult {
  const key = normalizeType(currentType);
  if (key === "") return { count: 0 };

  const earlier = pastFaults.reduce(
    (sum, fault) => sum + (normalizeType(fault?.type) === key ? 1 : 0),
    0,
  );
  const count = earlier + 1;
  if (count < 2) return { count };

  return { count, label: `${count}e keer ${currentType.trim()}` };
}

// ===========================================================================
// 3) ONTBREKENDE WEEKSTATEN
// ===========================================================================

/** Eén actieve plaatsing, teruggebracht tot wie er uren moet inleveren. */
export type ActivePlacementRef = { consultantId: string; consultantName: string };

export type MissingTimesheetsInput = {
  activePlacements: ActivePlacementRef[];
  /** Consultant-ids die deze week wél een weekstaat instuurden. */
  submittedConsultantIds: string[];
};

export type MissingTimesheetsResult = {
  /** Wie nog moet inleveren, in de volgorde waarin de plaatsingen binnenkwamen. */
  missing: ActivePlacementRef[];
  /** Aantal unieke mensen met een actieve plaatsing. */
  total: number;
  /** Hoeveel daarvan al inleverden (inzendingen zonder actieve plaatsing tellen niet). */
  submitted: number;
};

/**
 * Wie heeft een actieve plaatsing maar (nog) geen weekstaat ingestuurd? Iemand
 * met twee plaatsingen telt één keer — het gaat om de persoon, niet om de regel.
 * Plaatsingen zonder consultant-id worden overgeslagen; ingestuurde uren van
 * iemand zónder actieve plaatsing tellen niet mee in `submitted`, anders zou het
 * overzicht "12 van de 10" kunnen melden.
 */
export function findMissingTimesheets(input: MissingTimesheetsInput): MissingTimesheetsResult {
  const submittedIds = new Set(
    input.submittedConsultantIds.map((id) => (typeof id === "string" ? id.trim() : "")).filter(Boolean),
  );

  const seen = new Set<string>();
  const missing: ActivePlacementRef[] = [];
  let submitted = 0;

  for (const placement of input.activePlacements) {
    const consultantId = typeof placement?.consultantId === "string" ? placement.consultantId.trim() : "";
    if (consultantId === "" || seen.has(consultantId)) continue;
    seen.add(consultantId);

    if (submittedIds.has(consultantId)) submitted++;
    else missing.push({ consultantId, consultantName: placement.consultantName });
  }

  return { missing, total: seen.size, submitted };
}

// ===========================================================================
// 4) DUBBELE FACTUUR
// ===========================================================================

/** Een eerder ontvangen factuur, teruggebracht tot de drie velden die tellen. */
export type PriorInvoiceRef = {
  number: string | null;
  amount: number | null;
  weekStart: Date | null;
};

export type DuplicateInput = {
  invoiceNumber: string | null;
  invoiceAmount: number | null;
  /** Maandag van de week die deze factuur beslaat. */
  weekStart: Date | null;
  priorInvoices: PriorInvoiceRef[];
};

export type DuplicateResult = { flags: DetectieFlag[] };

/** Factuurnummers vergelijken we zonder hoofdletters en randspaties. */
function normalizeNumber(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

/** Bedragen op centen vergelijken — Float-ruis mag geen dubbele missen. */
function sameAmount(a: number | null | undefined, b: number | null | undefined): boolean {
  return isNum(a) && isNum(b) && round2(a) === round2(b);
}

/**
 * Kwam deze factuur al eens langs? Bewust TERUGHOUDEND: bijna alles is een
 * `warn`, zodat een terecht tweede factuur met toevallig hetzelfde bedrag niet
 * geblokkeerd wordt. Alleen als nummer, bedrag én week alle drie gelijk zijn is
 * het onmiskenbaar dezelfde factuur — dat is een `error`.
 *
 * Zonder factuurnummer, zonder bedrag of zonder week wordt die betreffende
 * controle overgeslagen (liever geen melding dan een valse).
 */
export function detectDuplicates(input: DuplicateInput): DuplicateResult {
  const flags: DetectieFlag[] = [];
  const priors = Array.isArray(input.priorInvoices) ? input.priorInvoices : [];

  // a) Zelfde factuurnummer — het duidelijkste signaal.
  const number = typeof input.invoiceNumber === "string" ? input.invoiceNumber.trim() : "";
  const numberKey = normalizeNumber(number);
  if (numberKey !== "") {
    const sameNumber = priors.filter((prior) => normalizeNumber(prior?.number) === numberKey);
    if (sameNumber.length > 0) {
      const exact = sameNumber.some(
        (prior) =>
          sameAmount(prior.amount, input.invoiceAmount) &&
          isDate(prior.weekStart) &&
          isDate(input.weekStart) &&
          prior.weekStart.getTime() === input.weekStart.getTime(),
      );
      flags.push(
        exact
          ? {
              level: "error",
              message: `factuurnummer ${number} kwam eerder langs met hetzelfde bedrag en dezelfde week — vrijwel zeker een dubbele`,
            }
          : { level: "warn", message: `factuurnummer ${number} kwam eerder langs` },
      );
    }
  }

  // b) Zelfde bedrag in een ANDERE week — ziet eruit als een hersturing. Alleen
  //    bij een echt bedrag (> 0) en met beide weken bekend; anders zwijgen we.
  const amount = input.invoiceAmount;
  if (isNum(amount) && amount > 0 && isDate(input.weekStart)) {
    const week = input.weekStart.getTime();
    const resends = priors.filter(
      (prior) =>
        sameAmount(prior?.amount, amount) &&
        isDate(prior.weekStart) &&
        prior.weekStart.getTime() !== week,
    );
    if (resends.length > 0) {
      // De oudste match: dáár begon het, en dat is de factuur om naast te leggen.
      const oldest = resends.reduce((best, prior) =>
        (prior.weekStart as Date).getTime() < (best.weekStart as Date).getTime() ? prior : best,
      );
      flags.push({
        level: "warn",
        message: `zelfde bedrag ${formatCurrency(amount)} als ${formatWeekLabel(oldest.weekStart as Date)} — mogelijk dezelfde factuur nogmaals gestuurd`,
      });
    }
  }

  return { flags };
}
