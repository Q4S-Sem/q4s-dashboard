import { weekSlotVanDatum } from "./week-koppeling";

// ---------------------------------------------------------------------------
// "Persoon voor persoon" door de week: wie is de volgende die nog werk heeft?
// Puur (geen DB), zodat het weekoverzicht, het dossier en de akkoord-actie
// dezelfde volgorde gebruiken als de tabel (die al op naam gesorteerd is).
// ---------------------------------------------------------------------------

export type VolgendeRij = {
  key: string;
  naam: string;
  href: string | null;
  gefactureerd: boolean;
  vastgelegd: boolean;
  wachtkamerSinds: Date | null;
};

/** Heeft deze persoon deze week nog iets te doen (en is er een dossier)? */
export function nogTeDoen(r: VolgendeRij): boolean {
  return Boolean(r.href) && !r.gefactureerd && !r.vastgelegd && !r.wachtkamerSinds;
}

/**
 * De eerstvolgende persoon met werk NA `huidigeKey` (in tabelvolgorde, rond naar
 * het begin). Zonder `huidigeKey` = de eerste. Null als iedereen klaar is.
 */
export function volgendePersoon<R extends VolgendeRij>(rows: R[], huidigeKey?: string | null): R | null {
  const start = huidigeKey ? rows.findIndex((r) => r.key === huidigeKey) : -1;
  for (let i = 1; i <= rows.length; i++) {
    const r = rows[(start + i + rows.length) % rows.length];
    if (r.key !== huidigeKey && nogTeDoen(r)) return r;
  }
  return null;
}

/** "3 van 9" — hoeveel personen zijn deze week klaar (vastgelegd/gefactureerd)? */
export function voortgang(rows: VolgendeRij[]): { klaar: number; totaal: number } {
  const metDossier = rows.filter((r) => r.href);
  return { klaar: metDossier.filter((r) => r.gefactureerd || r.vastgelegd).length, totaal: metDossier.length };
}

/**
 * Een urenstaat/factuur uit een ANDERE week dan het scherm:
 * - "zelfde"   → hoort bij deze week;
 * - "verder"   → die week staat nog open: ga daar verder;
 * - "verkeerd" → die week is al vastgelegd/gefactureerd: verkeerde staat ingezet.
 * Onbekende week (geen datum gelezen) telt als "zelfde" — dan beslist de mens.
 */
export function weekBeslissing(
  schermWeek: string,
  gelezenWeek: string | null | undefined,
  gelezenWeekGesloten: boolean,
): "zelfde" | "verder" | "verkeerd" {
  if (!gelezenWeek || gelezenWeek === schermWeek) return "zelfde";
  return gelezenWeekGesloten ? "verkeerd" : "verder";
}

/**
 * Er komt een factuur/urenstaat binnen voor een week waar er al één van deze
 * persoon ligt. Nog niet goedgekeurd → de nieuwe VERVANGT de oude (laatste
 * versie wint). Al goedgekeurd/betaald/vastgelegd → BLOKKEREN, nooit dubbel.
 */
export function dubbelBesluit(bestaandeStatus: string): "vervang" | "blokkeer" {
  return ["APPROVED", "PAID", "INVOICED", "CONFIRMED"].includes(bestaandeStatus) ? "blokkeer" : "vervang";
}

/**
 * Alle ISO-weeksleutels die een factuurperiode raakt (verzamelfactuur over 2-4
 * weken). Zonder (geldige) periode → []. Maximaal 8 weken als vangnet.
 */
/**
 * De factuurperiode zonder "uitloop": een week aan de rand telt alleen mee als de
 * periode er minstens 2 dagen van beslaat. "21.09 t/m 28.09" (ma t/m ma) is dus
 * week 39, niet week 39 + 40 — anders wordt de factuur half over twee weken verdeeld.
 */
export function kernPeriode<T extends string | Date | null | undefined>(start: T, eind: T): { start: T | Date; eind: T | Date } {
  const dag = (v: string | Date) => new Date(`${(v instanceof Date ? v.toISOString() : v).slice(0, 10)}T12:00:00Z`);
  if (!start || !eind) return { start, eind };
  let a = dag(start);
  let b = dag(eind);
  const DAG = 86_400_000;
  if ((b.getTime() - a.getTime()) / DAG < 2) return { start, eind };
  const wd = (d: Date) => (d.getUTCDay() + 6) % 7; // ma = 0 … zo = 6
  if (wd(b) === 0) b = new Date(b.getTime() - DAG); // eindigt op een maandag → t/m zondag
  if (wd(a) === 6) a = new Date(a.getTime() + DAG); // begint op een zondag → vanaf maandag
  return { start: a, eind: b };
}

export function wekenInPeriode(start: string | Date | null | undefined, eind: string | Date | null | undefined): string[] {
  const kern = kernPeriode(start, eind);
  const a = weekSlotVanDatum(kern.start instanceof Date ? kern.start.toISOString().slice(0, 10) : kern.start);
  const b = weekSlotVanDatum(kern.eind instanceof Date ? kern.eind.toISOString().slice(0, 10) : kern.eind) ?? a;
  if (!a || !b) return [];
  const keys: string[] = [];
  const d = new Date(`${a.monday}T12:00:00Z`);
  const laatste = new Date(`${b.monday}T12:00:00Z`).getTime();
  while (d.getTime() <= laatste && keys.length < 8) {
    keys.push(weekSlotVanDatum(d.toISOString().slice(0, 10))!.key);
    d.setUTCDate(d.getUTCDate() + 7);
  }
  return keys;
}

/**
 * Wat ontbreekt er nog bij deze persoon in deze week? Leeg = compleet.
 * Volgorde = de volgorde waarin het werk gebeurt.
 */
export function watMist(r: {
  timesheetOntvangen: boolean;
  factuurOntvangen: boolean;
  factuurNvt: boolean;
  vastgelegd: boolean;
  inkoopStatus: string | null;
  verkoopStatus: string | null;
}): string[] {
  const mist: string[] = [];
  if (!r.timesheetOntvangen) mist.push("Urenstaat");
  if (!r.factuurNvt && !r.factuurOntvangen) mist.push("Factuur freelancer");
  if (!r.verkoopStatus) mist.push(r.vastgelegd ? "Verkoopfactuur" : "Akkoord");
  else if (r.verkoopStatus === "DRAFT" || r.verkoopStatus === "READY") mist.push("Versturen");
  if (r.verkoopStatus === "SENT") mist.push("Betaling klant");
  if (!r.factuurNvt && r.inkoopStatus && r.inkoopStatus !== "PAID") mist.push("Freelancer betalen");
  return mist;
}
