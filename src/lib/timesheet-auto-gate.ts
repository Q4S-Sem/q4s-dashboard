import { formatCurrency, formatHours } from "./utils";

// ---------------------------------------------------------------------------
// Auto-gate: mag een AI-uitgelezen weekstaat (TimesheetInbox) automatisch worden
// goedgekeurd, of moet er eerst een mens naar kijken? Dit is de 90/10-knop: het
// saaie werk gaat vanzelf door, de twijfelgevallen komen op de stapel "nakijken".
//
// PUUR en DETERMINISTISCH: geen Prisma, geen datum-van-nu, geen I/O. Alles wat
// nodig is wordt als platte data meegegeven, zodat elke beslissing herhaalbaar
// en uitlegbaar is. De redenen zijn Nederlands en concreet — ze worden 1-op-1
// aan de gebruiker getoond (net als de reviewFlags uit src/lib/inbox-extract.ts,
// die dezelfde { level, message }-vorm hebben).
// ---------------------------------------------------------------------------

/** Bovengrens voor het weektotaal: daarboven is het per definitie handwerk. */
export const GATE_MAX_WEEKLY_HOURS = 60;
/** Ondergrens voor het weektotaal (negatieve uren bestaan niet). */
export const GATE_MIN_WEEKLY_HOURS = 0;
/** Hoeveel keer het eigen gemiddelde nog "normaal" is. */
export const GATE_RELATIVE_FACTOR = 1.75;
/** Minder historie dan dit → geen betrouwbaar gemiddelde, dus geen relatieve check. */
export const GATE_MIN_HISTORY_WEEKS = 3;

export type GateFlag = { level: "warn" | "error"; message: string };

export type TimesheetGateDecision = "AUTO_APPROVE" | "NEEDS_REVIEW";

export type TimesheetGateInput = {
  /** high | medium | low, zoals de AI-uitlezing het vastlegde. */
  confidence: string | null;
  /** De gekoppelde plaatsing (TimesheetInbox.placementId). */
  placementId: string | null;
  /** Aantal actieve plaatsingen dat bij deze persoon paste — precies 1 is eenduidig. */
  matchedPlacementCount: number;
  /** Uitgelezen weektotaal aan (reguliere) uren. */
  totalHours: number | null;
  /** Gemiddeld weektotaal over de recente weken van deze persoon. */
  recentAvgHours: number | null;
  /** Hoeveel weken historie dat gemiddelde beslaat. */
  recentWeeks: number;
  /** Bestaat er al een weekstaat voor dezelfde plaatsing + week? */
  duplicateExists: boolean;
  /** Verkooptarief van de plaatsing (wat de klant betaalt). */
  chargeRate: number | null;
  /** Inkooptarief van de plaatsing (wat wij betalen). */
  costRate: number | null;
};

export type TimesheetGateOptions = {
  maxWeeklyHours?: number;
  minWeeklyHours?: number;
  relativeFactor?: number;
  minHistoryWeeks?: number;
};

export type TimesheetGateResult = {
  decision: TimesheetGateDecision;
  /** Waarom het NIET automatisch mag — leeg bij AUTO_APPROVE. */
  reasons: string[];
  /** Dezelfde redenen mét niveau: 'error' = duidelijk mis/onbepaalbaar,
   *  'warn' = plausibel maar wil menselijke ogen. Altijd 1-op-1 met reasons. */
  flags: GateFlag[];
};

/** Alleen echte getallen tellen: null, NaN en Infinity zijn "onbekend". */
function isNum(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Beslis of deze uitgelezen weekstaat automatisch door mag. AUTO_APPROVE alleen
 * als ALLE zes de controles slagen; anders NEEDS_REVIEW met per gefaalde controle
 * één uitlegbare Nederlandse reden (in vaste volgorde, zodat de UI stabiel is).
 */
export function evaluateTimesheetGate(
  input: TimesheetGateInput,
  options: TimesheetGateOptions = {},
): TimesheetGateResult {
  const maxHours = options.maxWeeklyHours ?? GATE_MAX_WEEKLY_HOURS;
  const minHours = options.minWeeklyHours ?? GATE_MIN_WEEKLY_HOURS;
  const factor = options.relativeFactor ?? GATE_RELATIVE_FACTOR;
  const minWeeks = options.minHistoryWeeks ?? GATE_MIN_HISTORY_WEEKS;

  const flags: GateFlag[] = [];
  const block = (level: GateFlag["level"], message: string) => flags.push({ level, message });

  // 1) Betrouwbaarheid van de uitlezing — alleen 'high' gaat vanzelf door.
  const confidence = (input.confidence ?? "").trim().toLowerCase();
  if (confidence !== "high") {
    if (confidence === "low") block("error", "confidence laag");
    else if (confidence === "medium")
      block("warn", "confidence gemiddeld — alleen 'hoog' gaat automatisch door");
    else block("error", "confidence ontbreekt");
  }

  // 2) Precies één actieve plaatsing, en die moet ook gekoppeld zijn.
  if (input.matchedPlacementCount > 1) {
    block(
      "error",
      `meerdere actieve plaatsingen gevonden (${input.matchedPlacementCount}) — kies handmatig de juiste`,
    );
  } else if (input.matchedPlacementCount < 1) {
    block("error", "geen actieve plaatsing gevonden");
  } else if (!input.placementId) {
    block("error", "geen plaatsing gekoppeld aan deze weekstaat");
  }

  // 3) Absolute bandbreedte voor het weektotaal.
  const hours = input.totalHours;
  if (!isNum(hours)) {
    block("error", "geen weektotaal uitgelezen");
  } else if (hours < minHours || hours > maxHours) {
    block(
      "error",
      `weektotaal ${formatHours(hours)} u valt buiten de bandbreedte ${formatHours(minHours)}–${formatHours(maxHours)} u`,
    );
  }

  // 4) Relatieve check tegen het eigen gemiddelde — alleen met genoeg historie
  //    (en een gemiddelde > 0; anders valt er niets te vergelijken).
  const avg = input.recentAvgHours;
  if (isNum(hours) && isNum(avg) && avg > 0 && input.recentWeeks >= minWeeks) {
    if (hours === 0) {
      block(
        "error",
        `0 uren terwijl het gemiddelde ${formatHours(avg)} u is (laatste ${input.recentWeeks} weken)`,
      );
    } else if (hours > factor * avg) {
      const ratio = Math.round((hours / avg) * 10) / 10;
      block(
        "warn",
        `uren ${formatHours(hours)} u is ~${formatHours(ratio)}x hoger dan het gemiddelde van ${formatHours(avg)} u (laatste ${input.recentWeeks} weken)`,
      );
    }
  }

  // 5) Dubbele weekstaat (placement + week bestaat al) — nooit automatisch.
  if (input.duplicateExists) block("error", "dubbele weekstaat voor deze plaatsing en week");

  // 6) De marge moet positief zijn: verkoop hoger dan inkoop.
  if (!isNum(input.chargeRate) || !isNum(input.costRate)) {
    block("error", "tarieven onbekend — marge niet te bepalen");
  } else if (input.chargeRate <= input.costRate) {
    block(
      "error",
      `marge niet positief (inkoop ${formatCurrency(input.costRate)} ≥ verkoop ${formatCurrency(input.chargeRate)})`,
    );
  }

  return {
    decision: flags.length === 0 ? "AUTO_APPROVE" : "NEEDS_REVIEW",
    reasons: flags.map((f) => f.message),
    flags,
  };
}
