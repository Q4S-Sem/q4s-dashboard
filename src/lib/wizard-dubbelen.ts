import { weekSlotVanDatum } from "./week-koppeling";

// ---------------------------------------------------------------------------
// DUBBELE UPLOADS — dezelfde persoon-week hoort ÉÉN keer in de wizard te staan.
//
// Wordt een urenstaat twee keer aangeleverd (per mail én met de hand, of gewoon
// twee keer gesleept), dan liggen er twee RUWE inbox-regels van dezelfde week.
// Dubbel BOEKEN kan al niet — daar zit de @@unique op (placement, week) van de
// urenstaat op — maar in de ruwe inbox ontstaat zo wel twee keer "Week 35 · 32u"
// onder dezelfde naam. Deze module houdt er één zichtbaar en geeft de andere
// terug als verborgen dubbele, zodat het scherm er een opruim-melding bij kan
// zetten.
//
// ER WORDT HIER NIETS VERWIJDERD. Wat weg mag beslist de mens, met de bestaande
// knop op /verwerken/week/[id] (verwijderScan → deleteInbox).
//
// DE WEEK volgt uit de GEWERKTE DAGEN — weekSlotVanDatum, en dus
// canonicalWeekFromDates (src/lib/week-koppeling.ts). Nooit uit een bestandsnaam
// of een getypt weeknummer. Is de week nog onbekend (nog niet uitgelezen), dan
// valt er niets te vergelijken en blijft elke staat gewoon staan.
//
// PUUR, net als src/lib/wizard-personen.ts en src/lib/wizard-weekfilter.ts: geen
// Prisma, geen `new Date()`, geen I/O — zodat de server-pagina en de tests
// (tests/wizard-dubbelen.test.ts) exact hetzelfde uitrekenen.
// ---------------------------------------------------------------------------

/** Status van een inbox-item dat de AI al gelezen heeft. */
const UITGELEZEN = "EXTRACTED";

/**
 * Het minimum dat deze module van een openstaande weekstaat nodig heeft.
 * Bewust structureel (geen import uit de app-map): `WizardTimesheet` past hier
 * vanzelf op, en de tests kunnen met een handvol velden werken.
 */
export type DubbelBasis = {
  id: string;
  /** Naam zoals gematcht of uitgelezen — de terugval als er geen match is. */
  naam: string;
  /** Gematchte medewerker, of null als de naam (nog) niet herkend is. */
  consultantId: string | null;
  /** De maandag van de weekstaat als "YYYY-MM-DD" (leeg = geen week bekend). */
  weekStart?: string | null;
  /** NEW = nog niet uitgelezen, EXTRACTED = door de AI gelezen. */
  status?: string | null;
  /** Wanneer binnengekomen, als "YYYY-MM-DD" (leeg = onbekend). */
  ontvangen?: string | null;
};

/** Wat er na het ontdubbelen overblijft — en wat er dus verborgen is. */
export type Ontdubbeling<T extends DubbelBasis = DubbelBasis> = {
  /** De zichtbare lijst: per persoon + week precies één weekstaat. */
  items: T[];
  /** Per BEWAARDE staat (zijn id) de dubbelen die eronder verborgen zijn. */
  dubbelen: Record<string, T[]>;
  /** Alle verborgen id's samen — hiermee ruimt de mens ze op. */
  verborgen: string[];
};

/** Tekst zonder accenten of hoofdletters — "Sören" en "soren" zijn dezelfde. */
function normaliseer(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
}

/**
 * De sleutel van de PERSOON: zijn `consultantId`, en anders zijn naam. Is er
 * geen van beide, dan weten we niet bij wie deze staat hoort en groeperen we
 * niet — twee regels tonen is beter dan er stilletjes één verstoppen.
 */
function persoonSleutel(item: DubbelBasis): string | null {
  const id = (item.consultantId ?? "").trim();
  if (id) return `c:${id}`;
  const naam = normaliseer(item.naam ?? "");
  return naam ? `n:${naam}` : null;
}

/**
 * De ontdubbel-sleutel: persoon + canonieke week ("c:abc|2026-W35"). Null zodra
 * één van beide onbekend is — dan valt er niets samen te klappen.
 */
export function persoonWeekSleutel(item: DubbelBasis | null | undefined): string | null {
  if (!item) return null;
  const persoon = persoonSleutel(item);
  if (!persoon) return null;
  const week = weekSlotVanDatum(item.weekStart ?? null)?.key ?? null;
  return week ? `${persoon}|${week}` : null;
}

/**
 * Welke van twee staten van dezelfde persoon-week houden we in beeld?
 *
 *   1) de UITGELEZEN staat wint van een nog niet uitgelezene — daar staan de
 *      uren al in, dus daar werkt de eigenaar mee verder;
 *   2) daarna de laatst binnengekomen (een herzonden staat is meestal de goede);
 *   3) en anders het hoogste id, puur zodat de uitkomst altijd vastligt.
 */
function beterDan(kandidaat: DubbelBasis, huidig: DubbelBasis): boolean {
  const a = kandidaat.status === UITGELEZEN ? 1 : 0;
  const b = huidig.status === UITGELEZEN ? 1 : 0;
  if (a !== b) return a > b;
  const ka = kandidaat.ontvangen ?? "";
  const kb = huidig.ontvangen ?? "";
  if (ka !== kb) return ka > kb;
  return kandidaat.id > huidig.id;
}

/**
 * Ontdubbel de openstaande weekstaten: per persoon + canonieke week blijft er
 * precies ÉÉN over (zie {@link beterDan}), de rest komt als verborgen dubbele
 * terug — met behoud van de volgorde waarin de lijst binnenkwam.
 *
 * Wat NIET samenklapt: verschillende weken, verschillende personen, en staten
 * waarvan de week nog onbekend is. Die laatste blijven allemaal staan; hun week
 * is pas na het uitlezen bekend en tot die tijd is elke gelijkenis gokwerk.
 */
export function dedupeTimesheetsPerPersonWeek<T extends DubbelBasis>(
  items: readonly T[] | null | undefined,
): Ontdubbeling<T> {
  const zichtbaar: T[] = [];
  const groepen = new Map<string, { plek: number; verborgen: T[] }>();

  for (const item of items ?? []) {
    if (!item) continue;
    const sleutel = persoonWeekSleutel(item);
    if (!sleutel) {
      zichtbaar.push(item);
      continue;
    }
    const groep = groepen.get(sleutel);
    if (!groep) {
      groepen.set(sleutel, { plek: zichtbaar.length, verborgen: [] });
      zichtbaar.push(item);
      continue;
    }
    // De bewaarde staat houdt de plek van de eerste van zijn groep, zodat de
    // volgorde van de lijst (nieuwste week bovenaan) niet verspringt.
    const bewaard = zichtbaar[groep.plek];
    if (beterDan(item, bewaard)) {
      zichtbaar[groep.plek] = item;
      groep.verborgen.push(bewaard);
    } else {
      groep.verborgen.push(item);
    }
  }

  const dubbelen: Record<string, T[]> = {};
  const verborgen: string[] = [];
  for (const groep of groepen.values()) {
    if (groep.verborgen.length === 0) continue;
    dubbelen[zichtbaar[groep.plek].id] = groep.verborgen;
    for (const dubbel of groep.verborgen) verborgen.push(dubbel.id);
  }

  return { items: zichtbaar, dubbelen, verborgen };
}

/** "1 dubbele upload verborgen" — de melding bij de week in stap 1. */
export function dubbeleUploadLabel(aantal: number): string {
  const n = Number.isFinite(aantal) && aantal > 0 ? Math.trunc(aantal) : 0;
  if (n === 0) return "";
  return n === 1 ? "1 dubbele upload verborgen" : `${n} dubbele uploads verborgen`;
}
