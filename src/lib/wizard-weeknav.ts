import { startOfISOWeek } from "./utils";
import { weekSlotVanDatum, type WeekSlot } from "./week-koppeling";

// ---------------------------------------------------------------------------
// WEEK-NAVIGATIE voor de wizard "Week verwerken".
//
// De eigenaar wil ALTIJD in één, bewust gekozen week werken en daar met
// "Vorige week" / "Volgende week" doorheen stappen — of via de datumkiezer
// direct naar een week springen. Deze module rekent dat uit; ZONDER Prisma,
// ZONDER I/O. Alles gaat via de bestaande waarheid (weekSlotVanDatum /
// startOfISOWeek), zodat het scherm, de server en de tests
// (tests/wizard-weeknav.test.ts) exact hetzelfde uitkomen.
//
// De weeksleutel ("2026-W37") blijft de identiteit die de rest van de wizard
// gebruikt (zie wizard-weekfilter.ts). Deze module vertaalt alleen tussen die
// sleutel, de maandag van de week, en de buurweken.
// ---------------------------------------------------------------------------

/** "2026-W37" → { year: 2026, isoWeek: 37 }, of null als het geen sleutel is. */
export function ontleedWeekKey(key: string | null | undefined): { year: number; isoWeek: number } | null {
  const m = /^(\d{4})-W(\d{2})$/.exec((key ?? "").trim());
  if (!m) return null;
  const year = Number(m[1]);
  const isoWeek = Number(m[2]);
  if (!Number.isInteger(isoWeek) || isoWeek < 1 || isoWeek > 53) return null;
  return { year, isoWeek };
}

/**
 * De maandag van een ISO-week als Date (lokale middernacht). 4 januari valt per
 * definitie altijd in ISO-week 1; vanaf de maandag van die week tellen we
 * (isoWeek − 1) weken door. Zo klopt het ook rond de jaarwisseling.
 */
export function mondayVanIsoWeek(year: number, isoWeek: number): Date {
  const vierJan = new Date(year, 0, 4, 0, 0, 0, 0);
  const week1Maandag = startOfISOWeek(vierJan);
  const maandag = new Date(week1Maandag);
  maandag.setDate(maandag.getDate() + (isoWeek - 1) * 7);
  return maandag;
}

/** Een weeksleutel → volledige WeekSlot (met maandag). Onleesbaar → null. */
export function weekSlotVanKey(key: string | null | undefined): WeekSlot | null {
  const ontleed = ontleedWeekKey(key);
  if (!ontleed) return null;
  return weekSlotVanDatum(mondayVanIsoWeek(ontleed.year, ontleed.isoWeek));
}

/** De week vóór deze (maandag − 7 dagen). */
export function vorigeWeek(slot: WeekSlot | null | undefined): WeekSlot | null {
  if (!slot) return null;
  const d = new Date(`${slot.monday}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() - 7);
  return weekSlotVanDatum(d);
}

/** De week ná deze (maandag + 7 dagen). */
export function volgendeWeek(slot: WeekSlot | null | undefined): WeekSlot | null {
  if (!slot) return null;
  const d = new Date(`${slot.monday}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + 7);
  return weekSlotVanDatum(d);
}

/** De weeksleutel waar een gekozen datum ("YYYY-MM-DD") in valt. Ongeldig → null. */
export function weekKeyVanDatum(datum: string | null | undefined): string | null {
  return weekSlotVanDatum(datum ?? null)?.key ?? null;
}

const dagMaandFmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" });
const dagMaandJaarFmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });

/**
 * "7 sep – 13 sep 2026" — het maandag-t/m-zondag bereik van een week, zoals de
 * datumkiezer het toont. Het jaar staat alleen achteraan (niet dubbel).
 */
export function weekBereikLabel(slot: WeekSlot | null | undefined): string {
  if (!slot) return "";
  const maandag = new Date(`${slot.monday}T00:00:00`);
  if (Number.isNaN(maandag.getTime())) return "";
  const zondag = new Date(maandag);
  zondag.setDate(zondag.getDate() + 6);
  return `${dagMaandFmt.format(maandag)} – ${dagMaandJaarFmt.format(zondag)}`;
}

/** "week van 07-09-2026" — de kleine toelichtingsregel onder de kiezer. */
export function weekVanLabel(slot: WeekSlot | null | undefined): string {
  if (!slot?.monday) return "";
  const [y, m, d] = slot.monday.split("-");
  return `week van ${d}-${m}-${y}`;
}
