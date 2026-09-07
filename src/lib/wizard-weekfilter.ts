import type { BadgeColor } from "./domain";
import { weekSlotVanDatum, type WeekSlot } from "./week-koppeling";

// ---------------------------------------------------------------------------
// DE WEEKFILTER van de personenkeuze in de wizard "Week verwerken".
//
// De eigenaar werkt per WEEK: hij kiest bovenaan de personenlijst één week en
// ziet daarna per mens wat er in DIE week te doen is — er ligt een urenstaat
// klaar ("open"), die week is al verwerkt, of er is nog niets ingeleverd. Zo
// blijft iedereen in dezelfde week hangen in plaats van kriskras door de weken.
//
// PUUR, net als src/lib/wizard-personen.ts: geen Prisma, geen `new Date()`, geen
// I/O. "Nu" komt als parameter binnen (de weken uit `recenteWeken`), zodat de
// server-pagina, het scherm en de tests (tests/wizard-weekfilter.test.ts)
// hetzelfde uitrekenen.
//
// BELANGRIJK: de week van een weekstaat wordt hier alleen AFGELEZEN, nooit
// bepaald. Dat blijft canonicalWeekFromDates (src/lib/week-koppeling.ts) — de
// gewerkte dagen zijn en blijven de waarheid. Deze filter is er voor de
// navigatie en het overzicht; het akkoord rekent gewoon met de canonieke week.
// ---------------------------------------------------------------------------

/** Het minimum dat deze module van een openstaande weekstaat nodig heeft. */
export type WeekstaatWeek = {
  /** De maandag van de weekstaat als "YYYY-MM-DD" (leeg = geen week bekend). */
  weekStart?: string | null;
  /** Gematchte plaatsing ("" = nog niet bepaald). */
  placementId?: string;
};

/** Het minimum van één plaatsing onder een persoon. */
export type PlaatsingWeek = { plaatsing: { id: string } };

/** Het minimum van één persoon uit `bouwPersoonRijen`. */
export type PersoonWeekBasis = {
  plaatsingen?: readonly PlaatsingWeek[] | null;
  openstaand?: readonly WeekstaatWeek[] | null;
};

/** Eén kiesbare week in de filter, met wat erin te doen is. */
export type WeekKeuze = WeekSlot & {
  /** Aantal openstaande weekstaten die in deze week vallen (alle personen). */
  open: number;
  /** De lopende week — die waar "nu" in valt. */
  huidig: boolean;
};

/**
 * De week waar een openstaande weekstaat bij hoort, als vaste sleutel
 * ("2026-W35"). Een dag midden in de week wordt door `weekSlotVanDatum` naar
 * zijn ISO-maandag getrokken. Geen of een onleesbare datum → null.
 */
export function weekstaatWeekKey(item: WeekstaatWeek | null | undefined): string | null {
  return weekSlotVanDatum(item?.weekStart ?? null)?.key ?? null;
}

/**
 * De lijst waaruit de eigenaar zijn week kiest: de weken van de strook, plus de
 * weken waar nog iets van openstaat maar die buiten de strook vallen (anders
 * zou een oude, vergeten week onbereikbaar worden). NIEUWSTE EERST — je begint
 * bijna altijd bij de laatste week.
 *
 * `huidigeWeek` is de lopende week; laat je hem weg, dan is dat de laatste week
 * van de strook (zo levert `recenteWeken(nu)` hem al aan).
 */
export function bouwWeekKeuzes(input: {
  weken?: readonly WeekSlot[] | null;
  weekstaten?: readonly WeekstaatWeek[] | null;
  huidigeWeek?: string | null;
}): WeekKeuze[] {
  const weken = input.weken ?? [];
  const huidig = input.huidigeWeek ?? weken[weken.length - 1]?.key ?? null;

  // Tellen wat er per week openstaat; weekstaten zonder leesbare week tellen
  // nergens mee (die vindt de eigenaar via "Nog niet herkend").
  const open = new Map<string, number>();
  const losseWeken = new Map<string, WeekSlot>();
  for (const staat of input.weekstaten ?? []) {
    const slot = weekSlotVanDatum(staat?.weekStart ?? null);
    if (!slot) continue;
    open.set(slot.key, (open.get(slot.key) ?? 0) + 1);
    if (!losseWeken.has(slot.key)) losseWeken.set(slot.key, slot);
  }

  const alle = new Map<string, WeekSlot>();
  for (const week of weken) alle.set(week.key, week);
  for (const [key, week] of losseWeken) if (!alle.has(key)) alle.set(key, week);

  // De sleutel ("2026-W35") loopt gelijk op met de tijd, dus omgekeerd sorteren
  // zet vanzelf de nieuwste week bovenaan — ook over de jaargrens heen.
  return [...alle.values()]
    .sort((a, b) => b.key.localeCompare(a.key))
    .map((week) => ({
      ...week,
      open: open.get(week.key) ?? 0,
      huidig: week.key === huidig,
    }));
}

/**
 * Waar de eigenaar standaard begint: de meest recente week waar nog iets
 * openstaat — daar ligt immers het werk. Staat er niets open, dan de lopende
 * week. Is er helemaal niets, dan "" (geen keuze).
 */
export function standaardWeek(keuzes: readonly WeekKeuze[] | null | undefined): string {
  const lijst = keuzes ?? [];
  if (lijst.length === 0) return "";
  const metOpen = lijst.find((k) => k.open > 0);
  if (metOpen) return metOpen.key;
  return (lijst.find((k) => k.huidig) ?? lijst[0]).key;
}

/**
 * De toestand van één persoon in de gekozen week:
 * - `open`     — er ligt een openstaande weekstaat voor die week;
 * - `verwerkt` — één van zijn plaatsingen heeft die week al verwerkt;
 * - `niets`    — er is (nog) niets ingeleverd.
 */
export type PersoonWeekStatus = "open" | "verwerkt" | "niets";

/**
 * Wat staat deze persoon in deze week te doen? `open` wint bewust van
 * `verwerkt`: ligt er nóg een staat klaar, dan is die week niet af.
 *
 * `verwerktPerPlaatsing` is dezelfde platte map als de weekstrook gebruikt
 * (placementId → weeksleutels).
 */
export function persoonWeekStatus(
  persoon: PersoonWeekBasis,
  week: string | null | undefined,
  verwerktPerPlaatsing?: Record<string, readonly string[]> | null,
): PersoonWeekStatus {
  if (!week) return "niets";
  const openstaand = persoon?.openstaand ?? [];
  if (openstaand.some((staat) => weekstaatWeekKey(staat) === week)) return "open";

  const verwerkt = verwerktPerPlaatsing ?? {};
  const plaatsingen = persoon?.plaatsingen ?? [];
  const isVerwerkt = plaatsingen.some((rij) =>
    (verwerkt[rij?.plaatsing?.id ?? ""] ?? []).includes(week),
  );
  return isVerwerkt ? "verwerkt" : "niets";
}

/** Een personenrij met de toestand van de gekozen week erbij. */
export type WeekRij<R> = R & {
  weekStatus: PersoonWeekStatus;
  /** Aantal openstaande weekstaten van deze persoon in de gekozen week. */
  weekOpen: number;
};

/** Te verwerken bovenaan, klaar onderaan. */
const STATUS_VOLGORDE: Record<PersoonWeekStatus, number> = {
  open: 0,
  niets: 1,
  verwerkt: 2,
};

/**
 * De personenlijst zoals hij voor ÉÉN week getoond wordt: iedereen krijgt zijn
 * status, wie iets te doen heeft komt bovenaan, en met `alleenOpen` verdwijnt de
 * rest uit beeld. Binnen dezelfde status blijft de volgorde van
 * `bouwPersoonRijen` staan (meeste open weken eerst, daarna op naam).
 *
 * Zonder gekozen week blijft de lijst zoals hij is — dan filtert er niets.
 */
export function personenVoorWeek<R extends PersoonWeekBasis>(input: {
  personen?: readonly R[] | null;
  week?: string | null;
  verwerktPerPlaatsing?: Record<string, readonly string[]> | null;
  alleenOpen?: boolean;
}): WeekRij<R>[] {
  const week = input.week ?? null;
  const rijen = (input.personen ?? []).map((persoon, i) => {
    const weekStatus = persoonWeekStatus(persoon, week, input.verwerktPerPlaatsing);
    const weekOpen = week
      ? (persoon?.openstaand ?? []).filter((staat) => weekstaatWeekKey(staat) === week).length
      : 0;
    return { rij: { ...persoon, weekStatus, weekOpen }, i };
  });

  const zichtbaar = input.alleenOpen ? rijen.filter((r) => r.rij.weekStatus === "open") : rijen;
  // Index als tiebreak: de volgorde waarin de lijst binnenkwam blijft staan.
  return zichtbaar
    .sort(
      (a, b) =>
        STATUS_VOLGORDE[a.rij.weekStatus] - STATUS_VOLGORDE[b.rij.weekStatus] || a.i - b.i,
    )
    .map((r) => r.rij);
}

/**
 * De openstaande weekstaten van één persoon, met die van de gekozen week
 * vooraan — zo staat in stap 1 de week die hij in de filter koos meteen
 * bovenaan, zonder dat er een week verdwijnt. Zonder gekozen week (of zonder
 * treffer) blijft de volgorde precies zoals hij binnenkwam.
 */
export function weekstatenVoorWeek<T extends WeekstaatWeek>(
  items: readonly T[] | null | undefined,
  week: string | null | undefined,
): T[] {
  const lijst = [...(items ?? [])];
  if (!week) return lijst;
  const gekozen = lijst.filter((item) => weekstaatWeekKey(item) === week);
  if (gekozen.length === 0) return lijst;
  return [...gekozen, ...lijst.filter((item) => !gekozen.includes(item))];
}

// --- labels ----------------------------------------------------------------

/** "Week 35 · 2026" — overal dezelfde weeknaam als in de weekstrook. */
export function weekLabel(week: { isoWeek: number; year: number }): string {
  return `Week ${week.isoWeek} · ${week.year}`;
}

/** De regel in de keuzelijst: "Week 35 · 2026 · 2 open", "… · deze week". */
export function weekKeuzeLabel(keuze: WeekKeuze): string {
  return [
    weekLabel(keuze),
    keuze.huidig ? "deze week" : null,
    keuze.open > 0 ? `${keuze.open} open` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/**
 * De telling onder de weekkeuze: "3 te verwerken · 1 verwerkt · 5 niets
 * ingeleverd". Groepen zonder mensen worden niet genoemd; een lege lijst geeft
 * lege tekst (dan staat er een lege-lijst-melding in beeld).
 */
export function weekSamenvatting(
  rijen: readonly { weekStatus: PersoonWeekStatus }[] | null | undefined,
): string {
  const lijst = rijen ?? [];
  const tel = (status: PersoonWeekStatus) => lijst.filter((r) => r.weekStatus === status).length;
  const delen: string[] = [];
  const open = tel("open");
  const verwerkt = tel("verwerkt");
  const niets = tel("niets");
  if (open > 0) delen.push(`${open} te verwerken`);
  if (verwerkt > 0) delen.push(`${verwerkt} verwerkt`);
  if (niets > 0) delen.push(`${niets} niets ingeleverd`);
  return delen.join(" · ");
}

/** De status van een persoon in de gekozen week, in gewoon Nederlands. */
export function weekStatusLabel(status: PersoonWeekStatus): string {
  if (status === "open") return "open — te verwerken";
  return status === "verwerkt" ? "verwerkt" : "niets ingeleverd";
}

/** De badge-kleur die bij die status hoort (zie src/components/ui/badge.tsx). */
export function weekStatusKleur(status: PersoonWeekStatus): BadgeColor {
  if (status === "open") return "amber";
  return status === "verwerkt" ? "green" : "slate";
}
