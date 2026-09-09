import { formatHours, parseHours, round2 } from "./utils";

// ---------------------------------------------------------------------------
// Het correctie-geheugen van de urenstaat-scan — de PURE kern.
//
// Eerlijk over "de AI laten leren": we kunnen het model niet bijtrainen. Wat we
// wél doen is onthouden wat de AI las en wat de mens ervan maakte, en die kennis
// twee keer inzetten bij een volgende staat van dezelfde plaatsing:
//
//   1. als aandachtspunt IN het extractie-prompt (buildCorrectionHint), en
//   2. als zichtbaar VOORSTEL achteraf (learnedSuggestions) — maar alleen voor
//      een fout die de mens al minstens twee keer op precies dezelfde manier
//      verbeterde én die de AI nu opnieuw maakt.
//
// Nooit stil: wat hier voorgesteld wordt, toont het scherm er ook bij. De mens
// blijft controleren en mag er altijd overheen typen.
//
// PUUR: geen Prisma, geen AI, geen datum-van-nu. Getest in
// tests/timesheet-correction.test.ts.
// ---------------------------------------------------------------------------

/** De velden waarop we een uitlezing met de bevestigde week vergelijken. */
export const CORRECTION_FIELDS = [
  "dag0",
  "dag1",
  "dag2",
  "dag3",
  "dag4",
  "dag5",
  "dag6",
  "overuren",
  "kilometers",
] as const;

export type CorrectionField = (typeof CORRECTION_FIELDS)[number];

/** Eén weekstaat zoals het scherm hem invult: dag-uren Ma..Zo + overuren + km. */
export type TimesheetSnapshot = {
  /** Uren per dag Ma..Zo (index 0..6); leeg/0/ontbrekend = die dag niet gewerkt. */
  dagUren?: readonly (string | number | null | undefined)[] | null;
  overuren?: string | number | null;
  kilometers?: string | number | null;
};

/** Eén veld dat anders gelezen werd dan het uiteindelijk moest zijn. */
export type TimesheetDiff = {
  field: CorrectionField;
  /** Wat de AI las. */
  from: number;
  /** Wat de mens ervan maakte. */
  to: number;
};

/** Een verschil dat vaak genoeg terugkwam om alvast voor te stellen. */
export type LearnedSuggestion = TimesheetDiff & {
  /** Nederlandse uitleg voor het scherm: waarom stellen we dit voor? */
  reason: string;
};

/** Eén afgeronde week uit de historie: wat de AI las × wat het werd. */
export type CorrectionPair = { ai: TimesheetSnapshot; human: TimesheetSnapshot };

/**
 * Hoe vaak de mens dezelfde fout op dezelfde manier verbeterd moet hebben
 * voordat we hem alvast toepassen. Eén keer kan toeval zijn (die week wás
 * gewoon anders); vanaf twee keer is het een patroon in de handschrift-lezing.
 */
export const LEARN_THRESHOLD = 2;

/** Uren/km vergelijken we op twee decimalen — 8 en 8.001 zijn hetzelfde. */
const TOLERANCE = 0.01;

/** De hint blijft compact: één kopregel + hooguit drie aandachtspunten. */
const HINT_LINES = 3;

const DAG_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

/** Het Nederlandse label van een veld, zoals het scherm het toont. */
export function correctionFieldLabel(field: CorrectionField): string {
  if (field === "overuren") return "Overuren";
  if (field === "kilometers") return "Kilometers";
  return DAG_LABELS[Number(field.slice(3))] ?? field;
}

/** De eenheid waarin dit veld gelezen wordt ("u" of "km"). */
export function correctionFieldUnit(field: CorrectionField): "u" | "km" {
  return field === "kilometers" ? "km" : "u";
}

/** De waarde van één veld als getal; leeg/onleesbaar/negatief telt als 0. */
function waarde(snapshot: TimesheetSnapshot | null | undefined, field: CorrectionField): number {
  if (!snapshot) return 0;
  if (field === "overuren") return round2(parseHours(snapshot.overuren ?? ""));
  if (field === "kilometers") return round2(parseHours(snapshot.kilometers ?? ""));
  return round2(parseHours(snapshot.dagUren?.[Number(field.slice(3))] ?? ""));
}

/**
 * Wat las de AI anders dan er uiteindelijk is vastgelegd? Per dag/overuren/km
 * één regel; identieke waarden leveren niets op (leeg = niets geleerd, dus ook
 * niets om te bewaren).
 */
export function diffTimesheet(
  ai: TimesheetSnapshot,
  human: TimesheetSnapshot,
): TimesheetDiff[] {
  const out: TimesheetDiff[] = [];
  for (const field of CORRECTION_FIELDS) {
    const from = waarde(ai, field);
    const to = waarde(human, field);
    if (Math.abs(from - to) > TOLERANCE) out.push({ field, from, to });
  }
  return out;
}

type Teller = TimesheetDiff & { count: number };

/** Alle verschillen uit de historie geteld, per veld én per from→to-paar. */
function tel(history: readonly CorrectionPair[] | null | undefined): Map<string, Teller> {
  const teller = new Map<string, Teller>();
  for (const pair of history ?? []) {
    if (!pair) continue;
    for (const d of diffTimesheet(pair.ai, pair.human)) {
      const key = `${d.field}|${d.from}|${d.to}`;
      const bestaand = teller.get(key);
      if (bestaand) bestaand.count += 1;
      else teller.set(key, { ...d, count: 1 });
    }
  }
  return teller;
}

/**
 * Welke geleerde correcties passen op deze verse uitlezing?
 *
 * Een veld komt alleen in aanmerking als de mens de fout minstens
 * {@link LEARN_THRESHOLD} keer op EXACT dezelfde manier verbeterde (from→to) én
 * de AI nu weer diezelfde `from` teruggeeft. Leest de AI het nu goed, of leest
 * hij iets anders fout, dan blijft zijn waarde staan — we gokken niet.
 *
 * Verbeterde de mens hetzelfde veld even vaak naar twee verschillende waarden,
 * dan is er geen patroon en stellen we niets voor.
 */
export function learnedSuggestions(
  history: readonly CorrectionPair[] | null | undefined,
  freshAi: TimesheetSnapshot,
): LearnedSuggestion[] {
  const teller = tel(history);
  if (teller.size === 0) return [];

  const out: LearnedSuggestion[] = [];
  for (const field of CORRECTION_FIELDS) {
    const vers = waarde(freshAi, field);
    const kandidaten = [...teller.values()].filter(
      (c) =>
        c.field === field &&
        c.count >= LEARN_THRESHOLD &&
        // De AI maakt nu exact dezelfde fout...
        Math.abs(c.from - vers) <= TOLERANCE &&
        // ...en de geleerde waarde is écht iets anders.
        Math.abs(c.to - vers) > TOLERANCE,
    );
    if (kandidaten.length === 0) continue;
    kandidaten.sort((a, b) => b.count - a.count);
    // Even vaak naar twee verschillende waarden verbeterd → te onzeker.
    if (kandidaten.length > 1 && kandidaten[0].count === kandidaten[1].count) continue;

    const beste = kandidaten[0];
    const eenheid = correctionFieldUnit(field);
    out.push({
      field,
      from: beste.from,
      to: beste.to,
      reason: `De AI las hier ${formatHours(beste.from)} ${eenheid}; bij ${beste.count} eerdere weken werd dat ${formatHours(beste.to)} ${eenheid}.`,
    });
  }
  return out;
}

/**
 * De aandachtspunten die met het extractie-prompt meegaan: compacte Nederlandse
 * regels over wat er bij deze plaatsing eerder misging. Leeg bij lege historie
 * (of een historie zonder afwijkingen) — dan blijft het prompt onveranderd.
 *
 * Bewust "let hier extra op" en niet "vul dit in": het model moet beter kíjken,
 * niet naar één vast getal toe rekenen.
 */
export function buildCorrectionHint(
  history: readonly CorrectionPair[] | null | undefined,
): string {
  const teller = tel(history);
  if (teller.size === 0) return "";

  const regels = [...teller.values()]
    .sort(
      (a, b) =>
        b.count - a.count ||
        CORRECTION_FIELDS.indexOf(a.field) - CORRECTION_FIELDS.indexOf(b.field) ||
        a.from - b.from ||
        a.to - b.to,
    )
    .slice(0, HINT_LINES)
    .map((c) => {
      const eenheid = correctionFieldUnit(c.field);
      return `- ${correctionFieldLabel(c.field)}: je las ${formatHours(c.from)} ${eenheid}, het moest ${formatHours(c.to)} ${eenheid} zijn (${c.count}x).`;
    });

  return [
    "Eerdere correcties bij deze plaatsing — kijk hier extra goed, dit ging eerder mis:",
    ...regels,
  ].join("\n");
}
