import { getISOWeek, startOfISOWeek } from "./utils";

// ---------------------------------------------------------------------------
// WEEK-KOPPELING — welke week is het écht, en welke weken zijn per persoon al
// verwerkt?
//
// DE AFSPRAAK (van de eigenaar): de week volgt ALTIJD uit de GEWERKTE DAGEN.
// Wat er in een koptekst, een factuurregel of een bestandsnaam getypt staat
// ("week 35") is hooguit een aanwijzing — geen waarheid. Staat de urenstaat op
// 24-08 t/m 30-08, dan is dat de week van maandag 18-08 = ISO-week 34, ook als
// er "week 35" boven staat. De mens hoeft daar NIETS over te kiezen: wij tonen
// alleen een kleine, niet-blokkerende melding dat de nummers verschillen.
//
// PUUR: geen Prisma, geen `new Date()` van binnenuit, geen I/O. Alles wat met
// "nu" te maken heeft komt als parameter binnen, zodat het scherm (client), de
// pagina (server) en de tests (tests/week-koppeling.test.ts) exact hetzelfde
// uitrekenen.
//
// Er wordt hier NIETS zelf geteld of gedateerd: startOfISOWeek en getISOWeek
// (src/lib/utils.ts) blijven de enige rekenaars — dit is de betekenislaag.
// ---------------------------------------------------------------------------

/** De week zoals hij ÉCHT is: afgeleid uit de gewerkte dagen. */
export type CanoniekeWeek = {
  /** ISO-weeknummer 1–53. */
  isoWeek: number;
  /** ISO-week-JAAR (het jaar van de donderdag) — 29-12-2025 hoort bij 2026. */
  year: number;
  /** De maandag (lokale middernacht) van die week. */
  monday: Date;
};

/** "YYYY-MM-DD" → Date op lokale middernacht (nooit UTC: dat schuift een dag). */
function alsDatum(value: Date | string): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const s = value.trim();
  if (!s) return null;
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const d = iso ? new Date(`${s}T00:00:00`) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Date → "YYYY-MM-DD" in de LOKALE tijdzone (zoals een date-input hem wil). */
function alsIsoDatum(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * DE BRON VAN WAARHEID. Zet een gewerkte datum (de maandag van de weekstaat, de
 * periodeStart van een factuur, of zomaar een dag uit de week) om in de week
 * waar hij bij hoort. Een datum midden in de week wordt naar zijn ISO-maandag
 * getrokken — dus een periode die op zondag 24-08 begint, valt gewoon in de week
 * van maandag 18-08.
 *
 * Onbekende of onleesbare datum → null: dan is er simpelweg nog geen week, en
 * valt er ook niets te vergelijken.
 */
export function canonicalWeekFromDates(
  date: Date | string | null | undefined,
): CanoniekeWeek | null {
  if (date === null || date === undefined) return null;
  const d = alsDatum(date);
  if (!d) return null;

  const monday = startOfISOWeek(d);
  // Het ISO-week-jaar is het jaar van de DONDERDAG in die week: zo krijgt de
  // week rond de jaarwisseling het jaar waar hij administratief bij hoort.
  const donderdag = new Date(monday);
  donderdag.setDate(donderdag.getDate() + 3);
  return { isoWeek: getISOWeek(monday), year: donderdag.getFullYear(), monday };
}

/** Is dit een bruikbaar weeknummer (1–53)? */
function geldigWeeknummer(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1 && value <= 53;
}

/** Het getypte nummer naast het échte nummer. */
export type WeekAfwijking = {
  /** Wat er op de stukken staat (kop, factuurregel of bestandsnaam). */
  typed: number;
  /** Wat de gewerkte dagen zeggen — dit is wat wij aanhouden. */
  echt: number;
};

/**
 * Verschilt het getypte weeknummer van de canonieke week? Zo ja, dan komt er een
 * melding terug; anders null (gelijk, of één van beide onbekend).
 *
 * Dit is NOOIT een blokkade: de uitkomst is alleen bedoeld om te tonen. Wat er
 * vastgelegd wordt is en blijft de canonieke week.
 */
export function weekMismatch(input: {
  canonicalWeek: CanoniekeWeek | number | null | undefined;
  typedWeek: number | null | undefined;
}): WeekAfwijking | null {
  const echt =
    typeof input.canonicalWeek === "number"
      ? input.canonicalWeek
      : (input.canonicalWeek?.isoWeek ?? null);
  if (!geldigWeeknummer(echt)) return null;
  if (!geldigWeeknummer(input.typedWeek)) return null;
  if (input.typedWeek === echt) return null;
  return { typed: input.typedWeek, echt };
}

/** De afwijking als gewone Nederlandse zin, 1-op-1 te tonen. */
export function weekMismatchLabel(afwijking: WeekAfwijking): string {
  return `Op de stukken staat week ${afwijking.typed}, maar de gewerkte dagen vallen in week ${afwijking.echt}. Wij houden week ${afwijking.echt} aan.`;
}

/**
 * Het weeknummer uit vrije tekst — een bestandsnaam ("Urenstaat week 35.pdf") of
 * een koptekst. Bewust STRENGER dan `parseWeekNumber` (src/lib/invoice-extract.ts,
 * dat een kaal getal aanneemt): hier moet er letterlijk "week"/"wk" vóór staan.
 * Anders zou "Jansen 08 week 35.pdf" op week 8 uitkomen en een vals alarm geven.
 */
export function weekNummerUitTekst(text: string | null | undefined): number | null {
  const s = (text ?? "").trim();
  if (!s) return null;
  const m = /\b(?:week|wk)\s*(?:nummer|nr|no)?\.?\s*[:#_-]?\s*(\d{1,2})(?!\d)/i.exec(s);
  if (!m) return null;
  const n = Number(m[1]);
  return geldigWeeknummer(n) ? n : null;
}

// ===========================================================================
// DE WEEKSTROOK — welke weken zijn er per persoon al verwerkt?
// ===========================================================================

/** Vaste sleutel per week, over de jaargrens heen uniek: "2025-W34". */
export function weekKey(week: { isoWeek: number; year: number }): string {
  return `${week.year}-W${String(week.isoWeek).padStart(2, "0")}`;
}

/** Eén hokje in de strook, nog zonder oordeel. Serialiseerbaar (geen Date). */
export type WeekSlot = {
  key: string;
  isoWeek: number;
  year: number;
  /** De maandag als "YYYY-MM-DD". */
  monday: string;
};

/** Standaard-lengte van de strook: tien weken terugkijken is genoeg overzicht. */
export const STROOK_WEKEN = 10;

/**
 * De laatste `aantal` ISO-weken t/m de week waarin `tot` valt — oudste eerst,
 * zodat de strook links→rechts naar nu toe loopt. `tot` komt van buiten (de
 * server-pagina), zodat client en server niet uit elkaar kunnen lopen.
 */
export function recenteWeken(tot: Date, aantal: number = STROOK_WEKEN): WeekSlot[] {
  const n = Number.isInteger(aantal) && aantal > 0 ? Math.min(aantal, 53) : STROOK_WEKEN;
  const laatste = startOfISOWeek(tot);
  const slots: WeekSlot[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const maandag = new Date(laatste);
    maandag.setDate(maandag.getDate() - i * 7);
    const week = canonicalWeekFromDates(maandag);
    if (!week) continue;
    slots.push({
      key: weekKey(week),
      isoWeek: week.isoWeek,
      year: week.year,
      monday: alsIsoDatum(week.monday),
    });
  }
  return slots;
}

/**
 * De toestand van één week voor deze persoon:
 * - `verwerkt`   — er ligt een goedgekeurde urenstaat;
 * - `afwijking`  — verwerkt (of nu bezig), maar het getypte weeknummer klopte niet;
 * - `bezig`      — deze week staat nu in de wizard;
 * - `loopt`      — de huidige week; nog niets missen dus;
 * - `ontbreekt`  — voorbije week zonder urenstaat.
 */
export type WeekStripStatus = "verwerkt" | "afwijking" | "bezig" | "loopt" | "ontbreekt";

export type WeekStripCel = WeekSlot & {
  status: WeekStripStatus;
  /** Volledige Nederlandse omschrijving, bv. als title-tekst. */
  titel: string;
};

const STATUS_TEKST: Record<WeekStripStatus, string> = {
  verwerkt: "verwerkt",
  afwijking: "verwerkt, maar het weeknummer op de stukken week af",
  bezig: "nu in behandeling",
  loopt: "deze week loopt nog",
  ontbreekt: "nog geen urenstaat",
};

/**
 * Geef elke week in de strook zijn toestand. Puur samenstellen: `verwerkt` komt
 * uit de database (goedgekeurde/gefactureerde urenstaten van deze plaatsing),
 * `afwijkend` en `bezig` uit wat er nu in de wizard gebeurt.
 *
 * De LAATSTE week in de strook is de lopende week: die telt niet als gemist —
 * de staat kan nog binnenkomen.
 */
export function buildWeekStrip(input: {
  weken: WeekSlot[];
  verwerkt: Iterable<string>;
  afwijkend?: Iterable<string>;
  bezig?: string | null;
}): WeekStripCel[] {
  const verwerkt = new Set(input.verwerkt ?? []);
  const afwijkend = new Set(input.afwijkend ?? []);
  const weken = input.weken ?? [];
  const laatste = weken.length - 1;

  return weken.map((week, i) => {
    const isVerwerkt = verwerkt.has(week.key);
    const isBezig = input.bezig === week.key;
    const status: WeekStripStatus =
      afwijkend.has(week.key) && (isVerwerkt || isBezig)
        ? "afwijking"
        : isVerwerkt
          ? "verwerkt"
          : isBezig
            ? "bezig"
            : i === laatste
              ? "loopt"
              : "ontbreekt";
    return {
      ...week,
      status,
      titel: `Week ${week.isoWeek} · ${week.year} — ${STATUS_TEKST[status]}`,
    };
  });
}
