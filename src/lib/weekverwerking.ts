import { round2 } from "./utils";
import type { GateFlag } from "./timesheet-auto-gate";

// ---------------------------------------------------------------------------
// Weekverwerking — de kleine, pure hulpstukken onder /verwerken/week.
//
// De cockpit zelf leest met Prisma en laat het denkwerk over aan de bestaande
// pure modules (timesheet-auto-gate, facturatie-detecties, verkoop-groepering).
// Wat hier staat is uitsluitend PRESENTATIE-logica die je los wilt kunnen testen:
//
//   1) foutTypeVanMelding — de letterlijke gate-melding terug naar een kort,
//      herbruikbaar fouttype, zodat summarizeRecurringFaults (#1) kan tellen of
//      dit dezelfde fout is als vorige week.
//   2) controleLabel      — die fouttypes samengevat tot één badge boven de week.
//   3) telWeekBedragen    — uren/verkoop/inkoop/marge optellen zonder Float-ruis.
//   4) namenLijst         — namen als gewoon Nederlands in de "ontbreekt nog"-strip.
//
// PUUR en DETERMINISTISCH, net als src/lib/timesheet-auto-gate.ts: geen Prisma,
// geen datum-van-nu, geen I/O. Er wordt hier NIETS aan bedragen gerekend behalve
// optellen — al het factuurrekenwerk blijft in src/lib/toeslag.ts en invoicing.ts.
// ---------------------------------------------------------------------------

/**
 * De vaste fouttypes, in de volgorde waarin ze de melding mogen opeisen. Elke
 * regel matcht op de kale (kleine letters) tekst van een controlemelding — zowel
 * die van de auto-gate (src/lib/timesheet-auto-gate.ts) als die van de AI-uitlezing
 * (src/lib/inbox-extract.ts, bewaard in TimesheetInbox.reviewFlags). Bewust een
 * expliciete, geordende tabel: de teksten zijn Nederlands en overlappen
 * ("weekstaat", "plaatsing", "totaal"), dus de eerste treffer wint en die volgorde
 * hoort zichtbaar en test-baar te zijn.
 */
const FOUT_TYPES: { patroon: RegExp; type: string }[] = [
  { patroon: /^confidence\b/, type: "onzekere uitlezing" },
  { patroon: /onzeker/, type: "onzekere uitlezing" },
  { patroon: /meerdere actieve plaatsingen/, type: "plaatsing niet eenduidig" },
  { patroon: /geen medewerker/, type: "geen medewerker gematcht" },
  { patroon: /geen (actieve )?plaatsing/, type: "geen plaatsing" },
  { patroon: /geen weektotaal|geen gewerkte uren/, type: "geen uren uitgelezen" },
  { patroon: /bandbreedte/, type: "uren buiten bandbreedte" },
  { patroon: /dagtotaal/, type: "dagtotaal wijkt af" },
  { patroon: /kilometer/, type: "kilometers wijken af" },
  { patroon: /gemiddelde|ongebruikelijk veel uren/, type: "uren wijken af" },
  { patroon: /dubbele weekstaat/, type: "dubbele weekstaat" },
  { patroon: /marge/, type: "marge klopt niet" },
];

/** Badge-tekst als we de melding niet herkennen — liever neutraal dan verzonnen. */
export const ONBEKEND_FOUT_LABEL = "nakijken";

/**
 * Zet één controlemelding om in een kort fouttype ("uren wijken af"). Een melding
 * die we niet kennen levert bewust `null` op: dan telt hij niet mee als patroon,
 * zodat er nooit een "3e keer …" verschijnt op grond van los AI-proza.
 */
export function foutTypeVanMelding(message: string | null | undefined): string | null {
  const tekst = typeof message === "string" ? message.trim().toLowerCase() : "";
  if (tekst === "") return null;
  for (const { patroon, type } of FOUT_TYPES) {
    if (patroon.test(tekst)) return type;
  }
  return null;
}

/**
 * De ene badge die boven een te controleren week hoort. Een harde fout wint altijd
 * van een waarschuwing — ook als die verderop in de lijst staat — en binnen
 * hetzelfde niveau telt de eerste vlag, want de gate zet ze al in vaste rangorde.
 */
export function controleLabel(
  flags: GateFlag[],
): { label: string; level: GateFlag["level"] } | null {
  const vlaggen = Array.isArray(flags) ? flags : [];
  const gekozen = vlaggen.find((f) => f?.level === "error") ?? vlaggen[0];
  if (!gekozen) return null;
  return {
    label: foutTypeVanMelding(gekozen.message) ?? ONBEKEND_FOUT_LABEL,
    level: gekozen.level,
  };
}

/** Uren + verkoop/inkoop/marge van een stapel weken (ex BTW, incl. toeslagen). */
export type WeekBedragen = { hours: number; charge: number; cost: number; margin: number };

/**
 * Tel de weekcijfers van meerdere stapels bij elkaar op (bijvoorbeeld "automatisch
 * akkoord" + "te controleren" → verkoop deze week). Na élke optelling afronden op
 * centen, zoals de rest van de facturatie dat doet, zodat de kop-cijfers exact
 * gelijk zijn aan de som van de regels eronder.
 */
export function telWeekBedragen(delen: WeekBedragen[]): WeekBedragen {
  return (Array.isArray(delen) ? delen : []).reduce<WeekBedragen>(
    (acc, deel) => ({
      hours: round2(acc.hours + (deel?.hours ?? 0)),
      charge: round2(acc.charge + (deel?.charge ?? 0)),
      cost: round2(acc.cost + (deel?.cost ?? 0)),
      margin: round2(acc.margin + (deel?.margin ?? 0)),
    }),
    { hours: 0, charge: 0, cost: 0, margin: 0 },
  );
}

/**
 * Namen als gewoon Nederlands: "Jan, Piet en Ahmed". Boven `max` namen wordt de
 * rest samengevat ("… en 2 anderen") zodat de strip één regel blijft bij een grote
 * ploeg. Lege namen tellen niet mee — die zouden een dubbele komma opleveren.
 */
export function namenLijst(namen: string[], max = 5): string {
  const schoon = (Array.isArray(namen) ? namen : [])
    .map((n) => (typeof n === "string" ? n.trim() : ""))
    .filter(Boolean);
  if (schoon.length === 0) return "";

  const limiet = Number.isFinite(max) && max >= 1 ? Math.floor(max) : 1;
  const rest = schoon.length - limiet;
  const zichtbaar = rest > 0 ? schoon.slice(0, limiet) : schoon;
  const staart = rest > 0 ? `${rest} ${rest === 1 ? "ander" : "anderen"}` : null;

  const delen = staart ? [...zichtbaar, staart] : zichtbaar;
  if (delen.length === 1) return delen[0];
  return `${delen.slice(0, -1).join(", ")} en ${delen[delen.length - 1]}`;
}

/**
 * De twee letters in het rondje vóór een naam: eerste letter van de voornaam +
 * eerste letter van de achternaam ("Jan de Vries" → "JV"). Bij één woord de eerste
 * twee letters, en bij een lege naam een vraagteken — het rondje blijft dan staan,
 * zodat het raster niet verspringt.
 */
export function initialen(naam: string | null | undefined): string {
  const woorden = (typeof naam === "string" ? naam : "").trim().split(/\s+/).filter(Boolean);
  if (woorden.length === 0) return "?";
  if (woorden.length === 1) return woorden[0].slice(0, 2).toUpperCase();
  return `${woorden[0][0]}${woorden[woorden.length - 1][0]}`.toUpperCase();
}
