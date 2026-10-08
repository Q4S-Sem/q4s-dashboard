// ---------------------------------------------------------------------------
// Verzamelfacturen: een klant krijgt NIET elke week een verkoopfactuur, maar één
// per maand of per 4 weken (Client.billingCycle). Dit bestand beslist puur bij
// welke periode een week hoort en of die periode compleet is. Geen I/O.
//
// Weken blijven heel: een ISO-week hoort bij de maand van zijn DONDERDAG (de
// ISO-regel). ponytail: een week over de maandgrens gaat in zijn geheel mee,
// dagen splitsen over twee facturen pas als een klant dat echt eist.
// 4 weken = ISO-weken 1–4, 5–8, … ; week 53 hoort bij het laatste blok.
// ---------------------------------------------------------------------------

export const BILLING_CYCLES = [
  { value: "MONTH", label: "Per maand" },
  { value: "FOUR_WEEKS", label: "Per 4 weken" },
  { value: "WEEK", label: "Per week" },
] as const;
export type BillingCycle = (typeof BILLING_CYCLES)[number]["value"];
export const BILLING_CYCLE_VALUES = BILLING_CYCLES.map((c) => c.value) as [BillingCycle, ...BillingCycle[]];

const DAG = 86_400_000;
const MAANDEN = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

/** Maandag (00:00 UTC) van de week van d. */
export function maandagVan(d: Date): Date {
  // +12u: een weekStart die als lokale middernacht (22:00/23:00 UTC de dag ervoor)
  // is opgeslagen, valt zo toch op de goede dag.
  const r = new Date(d.getTime() + 12 * 3_600_000);
  const t = Date.UTC(r.getUTCFullYear(), r.getUTCMonth(), r.getUTCDate());
  const dag = (new Date(t).getUTCDay() + 6) % 7; // ma = 0
  return new Date(t - dag * DAG);
}

/** ISO-week en ISO-jaar van een maandag. */
function isoWeek(maandag: Date): { jaar: number; week: number } {
  const donderdag = new Date(maandag.getTime() + 3 * DAG);
  const jaar = donderdag.getUTCFullYear();
  const eersteDonderdag = maandagVan(new Date(Date.UTC(jaar, 0, 4))).getTime() + 3 * DAG;
  return { jaar, week: 1 + Math.round((donderdag.getTime() - eersteDonderdag) / (7 * DAG)) };
}

function wekenInJaar(jaar: number): number {
  return isoWeek(maandagVan(new Date(Date.UTC(jaar, 11, 28)))).week;
}

export type FactuurPeriode = {
  key: string;
  label: string;
  /** Alle maandagen van de periode, oplopend. */
  weken: Date[];
};

/** De factuurperiode waar de week van `weekStart` in valt. */
export function periodeVan(weekStart: Date, cycle: string): FactuurPeriode {
  const ma = maandagVan(weekStart);
  if (cycle === "WEEK") {
    const { jaar, week } = isoWeek(ma);
    return { key: `${jaar}-W${week}`, label: `week ${week} ${jaar}`, weken: [ma] };
  }
  if (cycle === "FOUR_WEEKS") {
    const { jaar, week } = isoWeek(ma);
    const laatsteBlok = Math.ceil(52 / 4); // 13
    const blok = Math.min(Math.ceil(week / 4), laatsteBlok);
    const van = (blok - 1) * 4 + 1;
    const tot = blok === laatsteBlok ? wekenInJaar(jaar) : blok * 4;
    const eersteMa = new Date(ma.getTime() - (week - van) * 7 * DAG);
    const weken = Array.from({ length: tot - van + 1 }, (_, i) => new Date(eersteMa.getTime() + i * 7 * DAG));
    return { key: `${jaar}-P${blok}`, label: `periode ${blok} ${jaar} (week ${van}–${tot})`, weken };
  }
  // MONTH (standaard): de maand van de donderdag.
  const donderdag = new Date(ma.getTime() + 3 * DAG);
  const jaar = donderdag.getUTCFullYear();
  const maand = donderdag.getUTCMonth();
  const weken: Date[] = [];
  // Eerste maandag waarvan de donderdag in deze maand valt.
  let m = maandagVan(new Date(Date.UTC(jaar, maand, 1)));
  if (new Date(m.getTime() + 3 * DAG).getUTCMonth() !== maand) m = new Date(m.getTime() + 7 * DAG);
  while (new Date(m.getTime() + 3 * DAG).getUTCMonth() === maand) {
    weken.push(m);
    m = new Date(m.getTime() + 7 * DAG);
  }
  return { key: `${jaar}-M${String(maand + 1).padStart(2, "0")}`, label: `${MAANDEN[maand]} ${jaar}`, weken };
}

/** Een plaatsing van de klant, met de weken (maandag-ISO) die al goedgekeurd zijn. */
export type PeriodePlaatsing = {
  startDate: Date;
  endDate: Date | null;
  /** "YYYY-MM-DD" van de maandag van elke week met een goedgekeurde/gefactureerde urenstaat. */
  goedgekeurd: Set<string>;
};

const iso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * Is de periode compleet? Elke week van de periode waarin een plaatsing liep,
 * moet een goedgekeurde urenstaat hebben. Geeft ook hoeveel er binnen zijn.
 */
export function periodeStand(p: FactuurPeriode, plaatsingen: PeriodePlaatsing[]): { binnen: number; nodig: number; compleet: boolean } {
  let binnen = 0;
  let nodig = 0;
  for (const pl of plaatsingen) {
    const start = maandagVan(pl.startDate).getTime();
    const eind = pl.endDate ? pl.endDate.getTime() : Infinity;
    for (const ma of p.weken) {
      if (ma.getTime() < start || ma.getTime() > eind) continue; // liep die week niet
      nodig++;
      if (pl.goedgekeurd.has(iso(ma))) binnen++;
    }
  }
  return { binnen, nodig, compleet: nodig > 0 && binnen >= nodig };
}

export { iso as isoMaandag };
