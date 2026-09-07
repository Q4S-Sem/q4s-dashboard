import { formatCurrency, round2 } from "./utils";

// ---------------------------------------------------------------------------
// De denk-stukjes van de wizard "Week verwerken" (/verwerken/nieuw): welke stap
// mag open, klopt zijn factuurbedrag met de uren, en hoe gezond is de marge.
//
// PUUR en DETERMINISTISCH, net als src/lib/facturatie-detecties.ts: geen Prisma,
// geen datum-van-nu, geen I/O. Zo rekenen het scherm (client) en de akkoord-actie
// (server) gegarandeerd hetzelfde uit en is alles los te testen
// (tests/week-wizard.test.ts).
//
// Hier wordt GEEN factuurbedrag opgebouwd: uren × tarief (incl. toeslagen en km)
// komt onverkort uit computeTimesheetMoney (src/lib/toeslag.ts), dezelfde functie
// die de echte verkoopfactuur maakt. Deze module vergelijkt alleen.
// ---------------------------------------------------------------------------

/** Alleen echte getallen tellen: null, NaN en Infinity zijn "onbekend". */
function isNum(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

// ===========================================================================
// 1) STAPPEN — welke stap is af, en hoe ver mag je?
// ===========================================================================

export type WizardStapStatus = "todo" | "done";

export type WizardVoortgang = {
  /** Stap 1 — verplicht: zonder uren valt er niets te verwerken. */
  timesheet: WizardStapStatus;
  /** Stap 2 — optioneel: zijn eigen factuur (de inkoop) mag later komen. */
  factuur: WizardStapStatus;
  /** Hoogste stap die de gebruiker mag openen (1–3). */
  maxStap: 1 | 2 | 3;
  /** Mag stap 3 met "akkoord" afgesloten worden? */
  kanAfronden: boolean;
  /** Tonen we de vlag "factuur ontbreekt nog"? */
  factuurOntbreekt: boolean;
};

/**
 * Wat is er af en hoe ver mag de gebruiker? De timesheet is de enige harde eis:
 * zonder uren is er geen urenstaat en dus ook geen verkoopfactuur. De factuur van
 * de freelancer is bewust optioneel — die komt in de praktijk vaak later binnen —
 * maar het ontbreken ervan blijft wél zichtbaar.
 */
export function wizardVoortgang(input: {
  heeftTimesheet: boolean;
  heeftFactuur: boolean;
}): WizardVoortgang {
  const heeftTimesheet = input.heeftTimesheet === true;
  const heeftFactuur = input.heeftFactuur === true;
  return {
    timesheet: heeftTimesheet ? "done" : "todo",
    factuur: heeftFactuur ? "done" : "todo",
    maxStap: heeftTimesheet ? 3 : 1,
    kanAfronden: heeftTimesheet,
    factuurOntbreekt: !heeftFactuur,
  };
}

// ===========================================================================
// 2) BEDRAG-CONTROLE — klopt zijn factuur met de uren?
// ===========================================================================

/** Vaste ondergrens: onder een euro verschil gaan we niet moeilijk doen. */
export const BEDRAG_TOLERANTIE_EUR = 1;
/** Relatieve marge (%) — vangt afrondingen en een cent-per-uur-verschil op. */
export const BEDRAG_TOLERANTIE_PCT = 1;

export type FactuurMatchStatus = "klopt" | "afwijking" | "onbekend";

export type FactuurMatchInput = {
  /** Het bedrag dat op ZIJN factuur staat (ex btw / verlegd). */
  factuurBedrag: number | null;
  /** Wat wij verwachten: uren × inkooptarief incl. toeslagen en km. */
  verwachtBedrag: number | null;
  /** Afwijkende ondergrens in euro's (default {@link BEDRAG_TOLERANTIE_EUR}). */
  tolerantieEur?: number;
  /** Afwijkende relatieve marge in % (default {@link BEDRAG_TOLERANTIE_PCT}). */
  tolerantiePct?: number;
};

export type FactuurMatch = {
  status: FactuurMatchStatus;
  /** Het verwachte bedrag; null als het niet te bepalen was. */
  verwacht: number | null;
  /** factuurbedrag − verwacht (positief = hij factureert méér). Null = onbekend. */
  verschil: number | null;
  /** Hoeveel verschil nog "klopt". Null bij een onbepaalbare vergelijking. */
  tolerantie: number | null;
  /** Nederlandse melding, 1-op-1 te tonen. */
  message: string;
};

/**
 * Vergelijk het factuurbedrag van de freelancer met uren × inkooptarief. De
 * tolerantie is de GROOTSTE van een vast bedrag en een percentage: bij kleine
 * bedragen zou 1% al op centenruis vlaggen, bij grote bedragen is een euro te
 * streng. Ontbreekt één van beide bedragen, dan zeggen we niets (liever geen
 * oordeel dan een vals alarm) — de mens ziet dan gewoon beide getallen.
 */
export function matchFactuurBedrag(input: FactuurMatchInput): FactuurMatch {
  const factuur = isNum(input.factuurBedrag) ? round2(input.factuurBedrag) : null;
  const verwacht =
    isNum(input.verwachtBedrag) && input.verwachtBedrag > 0 ? round2(input.verwachtBedrag) : null;

  if (factuur === null || verwacht === null) {
    return {
      status: "onbekend",
      verwacht,
      verschil: null,
      tolerantie: null,
      message: "Nog niet te vergelijken — factuurbedrag of uren × tarief onbekend.",
    };
  }

  const tolEur = isNum(input.tolerantieEur) && input.tolerantieEur >= 0 ? input.tolerantieEur : BEDRAG_TOLERANTIE_EUR;
  const tolPct = isNum(input.tolerantiePct) && input.tolerantiePct >= 0 ? input.tolerantiePct : BEDRAG_TOLERANTIE_PCT;
  const tolerantie = round2(Math.max(tolEur, (verwacht * tolPct) / 100));
  const verschil = round2(factuur - verwacht);
  const richting = verschil > 0 ? "meer" : "minder";
  const bedrag = formatCurrency(Math.abs(verschil));

  if (verschil === 0) {
    return {
      status: "klopt",
      verwacht,
      verschil,
      tolerantie,
      message: "Klopt: zijn factuurbedrag = uren × tarief. Geen afwijking.",
    };
  }

  if (Math.abs(verschil) <= tolerantie) {
    return {
      status: "klopt",
      verwacht,
      verschil,
      tolerantie,
      message: `Klopt: ${bedrag} ${richting} dan uren × tarief (${formatCurrency(verwacht)}) — binnen de marge.`,
    };
  }

  return {
    status: "afwijking",
    verwacht,
    verschil,
    tolerantie,
    message: `Afwijking: hij factureert ${bedrag} ${richting} dan uren × tarief (${formatCurrency(verwacht)}).`,
  };
}

// ===========================================================================
// 3) MARGE-BADGE — gezond, laag of weg
// ===========================================================================

/** Wat Q4S per gewerkt uur wil overhouden (de norm uit het wizard-ontwerp). */
export const STANDAARD_MARGENORM = 10;

/** De badge-kleuren die src/components/ui/badge.tsx kent. */
export type MargeKleur = "green" | "amber" | "red" | "slate";

export type MargeGezondheid = { color: MargeKleur; label: string };

/**
 * Zet de uitkomst van `evaluateMargin` (src/lib/facturatie-detecties.ts) om in
 * één badge. Bewust hier en niet in het scherm: de grens tussen "gezond" en
 * "laag" is een afspraak, geen opmaak. Een onbepaalbare marge wordt neutraal
 * (grijs) getoond — nooit als "gezond".
 */
export function margeGezondheid(input: {
  marginPerHour: number | null;
  belowNorm: boolean;
  normPerHour: number | null;
}): MargeGezondheid {
  const marge = isNum(input.marginPerHour) ? input.marginPerHour : null;
  if (marge === null) return { color: "slate", label: "marge onbekend" };

  const norm = isNum(input.normPerHour) ? input.normPerHour : null;
  const staart = norm !== null ? ` — norm ${formatCurrency(norm)}/u` : "";
  const perUur = `${formatCurrency(marge)}/u`;

  if (marge <= 0) return { color: "red", label: `geen marge (${perUur})` };
  if (input.belowNorm === true) return { color: "amber", label: `marge laag (${perUur}${staart})` };
  return { color: "green", label: `marge gezond (${perUur}${staart})` };
}

// ===========================================================================
// 4) BEDRAG INLEZEN — wat de mens (of de AI-uitlezing) in het veld zet
// ===========================================================================

/**
 * Lees een ingetypt/voorgevuld bedrag: "3840", "3.840,00", "€ 2.718,10",
 * "3840.50". Spiegelt `parseAmount` uit ontvangen-facturen/actions.ts, maar geeft
 * `null` terug in plaats van NaN zodat "nog niets ingevuld" en "onleesbaar" op
 * dezelfde manier door de wizard heen lopen.
 */
export function parseBedrag(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number") return Number.isFinite(value) ? round2(value) : null;

  let s = value.replace(/[€\s ]/g, "").trim();
  if (!s) return null;

  if (s.includes(",")) {
    // NL-notatie: punten zijn duizendtallen, de komma is het decimaalteken.
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) {
    // Alleen punten in een duizendtal-patroon ("3.840", "12.345") → duizendtallen.
    s = s.replace(/\./g, "");
  }
  s = s.replace(/[^\d.-]/g, "");

  const n = Number(s);
  return Number.isFinite(n) ? round2(n) : null;
}
