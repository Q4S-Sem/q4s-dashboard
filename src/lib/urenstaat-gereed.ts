import { weekSlotVanDatum } from "./week-koppeling";

// ---------------------------------------------------------------------------
// "ER STAAT AL EEN URENSTAAT GEREED" — de opzoeklijst per plaatsing + week.
//
// De wizard "Week verwerken" merkte pas bij het AKKOORD dat er voor deze
// plaatsing + week al een urenstaat lag: confirmInboxItem botste op de
// @@unique(placementId, weekStart) en gaf "exists" terug (zie
// src/lib/urenstaat-hergebruik.ts voor wat er dan nog mag). Dat is te laat —
// dan heeft de eigenaar de hele ronde al gelopen.
//
// Deze module maakt het VOORAF zichtbaar. De server laadt de goedgekeurde en
// gefactureerde urenstaten (APPROVED/INVOICED = gereed), en dit is de platte
// opzoeklijst waarmee het scherm per persoon-week kan zeggen: "die staat al
// gereed — hier is hij", inclusief het id om naartoe te linken. Er wordt dus
// niets dubbel verwerkt en niets automatisch overgeslagen: de mens ziet de
// melding en klikt door naar de urenstaat die er al ligt.
//
// PUUR, net als src/lib/wizard-weekfilter.ts: geen Prisma, geen `new Date()`,
// geen I/O — zodat de server-pagina, het scherm en de tests
// (tests/urenstaat-gereed.test.ts) exact hetzelfde uitrekenen.
//
// De week wordt hier alleen AFGELEZEN, nooit bepaald: dat blijft
// weekSlotVanDatum/canonicalWeekFromDates (src/lib/week-koppeling.ts) — de
// gewerkte dagen zijn en blijven de waarheid.
// ---------------------------------------------------------------------------

/** Eén al vastgelegde urenstaat, precies zoals de server hem aanlevert. */
export type GereedeStaatInvoer = {
  /** Timesheet.id — waar het scherm naartoe linkt. */
  id: string;
  placementId: string;
  /** De weekStart van de urenstaat (Date uit Prisma of "YYYY-MM-DD"). */
  weekStart: Date | string | null | undefined;
};

/** De urenstaat die er al gereed staat voor één plaatsing + week. */
export type GereedeUrenstaat = {
  id: string;
  /** Weeksleutel "2026-W35" — dezelfde als de weekstrook en de weekfilter. */
  key: string;
  isoWeek: number;
  year: number;
};

/** placementId → weeksleutel → de urenstaat die daar al gereed staat. */
export type GereedPerPlaatsing = Record<string, Record<string, GereedeUrenstaat>>;

/** Leeg of alleen spaties → niet bruikbaar als sleutel. */
function sleutel(waarde: string | null | undefined): string {
  return String(waarde ?? "").trim();
}

/**
 * Bouw de opzoeklijst uit de geladen urenstaten. Een staat zonder id, zonder
 * plaatsing of zonder leesbare week valt eruit — daar is niets mee op te
 * zoeken. Ligt er (in weerwil van de @@unique) toch meer dan één op dezelfde
 * plaatsing + week, dan blijft de EERSTE staan: dan wisselt het scherm niet.
 */
export function bouwGereedPerPlaatsing(
  staten: readonly GereedeStaatInvoer[] | null | undefined,
): GereedPerPlaatsing {
  const gereed: GereedPerPlaatsing = {};
  for (const staat of staten ?? []) {
    const id = sleutel(staat?.id);
    const placementId = sleutel(staat?.placementId);
    if (!id || !placementId) continue;
    const slot = weekSlotVanDatum(staat?.weekStart ?? null);
    if (!slot) continue;

    const weken = (gereed[placementId] ??= {});
    if (weken[slot.key]) continue;
    weken[slot.key] = { id, key: slot.key, isoWeek: slot.isoWeek, year: slot.year };
  }
  return gereed;
}

/**
 * Staat er voor deze plaatsing + week al een urenstaat gereed? Zo ja, dan komt
 * hij hier terug (met zijn id, om naartoe te linken); anders null.
 */
export function gereedeUrenstaat(
  gereed: GereedPerPlaatsing | null | undefined,
  placementId: string | null | undefined,
  week: string | null | undefined,
): GereedeUrenstaat | null {
  const plaatsing = sleutel(placementId);
  const weekKey = sleutel(week);
  if (!plaatsing || !weekKey) return null;
  return gereed?.[plaatsing]?.[weekKey] ?? null;
}

/**
 * Hetzelfde, maar over alle plaatsingen van één persoon: werkt hij op meer
 * plaatsen, dan is de week al gereed zodra er bij ÉÉN van zijn plaatsingen een
 * urenstaat ligt. De eerste treffer wint (de volgorde van de plaatsingen).
 */
export function gereedeUrenstaatVanPlaatsingen(
  gereed: GereedPerPlaatsing | null | undefined,
  placementIds: readonly string[] | null | undefined,
  week: string | null | undefined,
): GereedeUrenstaat | null {
  for (const placementId of placementIds ?? []) {
    const staat = gereedeUrenstaat(gereed, placementId, week);
    if (staat) return staat;
  }
  return null;
}

/**
 * Dezelfde lijst, plat: per plaatsing de weeksleutels die al verwerkt zijn —
 * precies wat de weekstrook (buildWeekStrip) en de weekfilter
 * (persoonWeekStatus) nodig hebben. Oplopend gesorteerd, dus stabiel.
 */
export function verwerkteWekenPerPlaatsing(
  gereed: GereedPerPlaatsing | null | undefined,
): Record<string, string[]> {
  const platte: Record<string, string[]> = {};
  for (const [placementId, weken] of Object.entries(gereed ?? {})) {
    platte[placementId] = Object.keys(weken).sort();
  }
  return platte;
}

/** Naam van de persoon, of een nette terugval als die (nog) niet bekend is. */
function persoonNaam(naam: string | null | undefined): string {
  return sleutel(naam) || "deze medewerker";
}

/**
 * De melding zoals hij op het scherm staat: "Er staat al een urenstaat gereed
 * voor Jan Jansen — week 35." Zonder bekende week blijft het weeknummer weg.
 *
 * De week mag als kaal nummer, als {@link GereedeUrenstaat} of als canonieke
 * week (`canonicalWeekFromDates`) binnenkomen — alles met een `isoWeek`.
 */
export function gereedMelding(
  naam: string | null | undefined,
  week: { isoWeek: number } | number | null | undefined,
): string {
  const isoWeek = typeof week === "number" ? week : (week?.isoWeek ?? null);
  const staart = isoWeek === null ? "" : ` — week ${isoWeek}`;
  return `Er staat al een urenstaat gereed voor ${persoonNaam(naam)}${staart}.`;
}
