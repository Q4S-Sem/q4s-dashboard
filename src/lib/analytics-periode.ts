// ---------------------------------------------------------------------------
// De periode-keuze van Analytics (Heel jaar · Q1–Q4 · jaar ‹ ›), één keer.
// Puur — getest in tests/analytics-periode.test.ts.
//
// Vergelijken met de vorige periode gebeurt EERLIJK: loopt de gekozen periode
// nog (bijv. Q4 op 5 oktober), dan telt de vorige periode ook maar even lang
// mee (Q3 t/m 5 juli). Anders staat er altijd "-100%" aan het begin van een
// kwartaal.
// ---------------------------------------------------------------------------

export const ANALYTICS_START_JAAR = 2026;

export type Periode = {
  year: number;
  isYear: boolean;
  /** 1–4, of null bij heel jaar. */
  q: number | null;
  /** Waarde voor ?q= ("all" | "1".."4"). */
  param: string;
  start: Date;
  end: Date;
  /** "Q4 2026" / "2026" */
  label: string;
  /** "Q4" / "2026" */
  short: string;
  /** Loopt de periode nog (vandaag valt erin)? */
  lopend: boolean;
  prevStart: Date;
  /** Einde van het vergelijkingsvenster (bij een lopende periode: even lang als tot nu). */
  prevEnd: Date;
  prevLabel: string;
  minYear: number;
  maxYear: number;
};

export function periodeUit(sp: { q?: string; year?: string }, now: Date): Periode {
  const minYear = ANALYTICS_START_JAAR;
  const maxYear = Math.max(minYear, now.getFullYear());
  const gevraagd = sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : now.getFullYear();
  const year = Math.min(Math.max(gevraagd, minYear), maxYear);
  const isYear = sp.q === "all";
  const q = isYear ? null : sp.q && /^[1-4]$/.test(sp.q) ? Number(sp.q) : Math.floor(now.getMonth() / 3) + 1;

  const start = isYear ? new Date(year, 0, 1) : new Date(year, (q! - 1) * 3, 1);
  const end = isYear ? new Date(year + 1, 0, 1) : new Date(year, q! * 3, 1);
  const prevStart = isYear ? new Date(year - 1, 0, 1) : new Date(year, (q! - 1) * 3 - 3, 1);
  const lopend = now >= start && now < end;
  // Zelfde aantal verstreken dagen in de vorige periode (kalenderdag-precies).
  const dag = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86_400_000;
  const verstreken = dag(now) - dag(start) + 1;
  const prevEnd = lopend
    ? new Date(prevStart.getFullYear(), prevStart.getMonth(), prevStart.getDate() + verstreken)
    : start;
  const prevQ = isYear ? null : ((q! + 2) % 4) + 1;
  const prevYear = isYear || q === 1 ? year - 1 : year;

  return {
    year,
    isYear,
    q,
    param: isYear ? "all" : String(q),
    start,
    end,
    label: isYear ? `${year}` : `Q${q} ${year}`,
    short: isYear ? `${year}` : `Q${q}`,
    lopend,
    prevStart,
    prevEnd,
    prevLabel: `${isYear ? prevYear : `Q${prevQ} ${prevYear}`}${lopend ? " t/m zelfde dag" : ""}`,
    minYear,
    maxYear,
  };
}

/** Procentueel verschil; null als er niets was om mee te vergelijken. */
export function deltaPct(huidig: number, vorig: number): number | null {
  return vorig > 0 ? Math.round(((huidig - vorig) / vorig) * 1000) / 10 : null;
}
