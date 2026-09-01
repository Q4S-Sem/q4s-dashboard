import { round2 } from "./utils";

// ---------------------------------------------------------------------------
// Urenhistorie van één medewerker → het gemiddelde weektotaal dat de auto-gate
// (src/lib/timesheet-auto-gate.ts) als ijkpunt gebruikt voor zijn relatieve
// check ("is deze week ineens veel meer dan normaal?").
//
// PUUR: geen Prisma, geen datum-van-nu. De database-laag
// (src/lib/timesheet-gate-review.ts) haalt de weekstaten op en geeft ze hier als
// platte weektotalen door, zodat het rekenwerk los te testen en herhaalbaar is.
// ---------------------------------------------------------------------------

/** Hoeveel afgeronde weken er standaard in het gemiddelde meetellen. */
export const GATE_HISTORY_WEEKS = 8;

/** Eén weektotaal: de maandag van de week + de gewerkte (reguliere) uren. */
export type WeeklyTotal = { weekStart: Date; hours: number };

export type RecentWeeksSummary = {
  /** Gemiddeld weektotaal over het venster; null als er geen weken zijn. */
  recentAvgHours: number | null;
  /** Hoeveel weken dat gemiddelde beslaat (0 = geen historie). */
  recentWeeks: number;
};

/** Alleen echte, niet-negatieve getallen tellen mee. */
function usableHours(value: number): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * Vat de urenhistorie samen tot `{ recentAvgHours, recentWeeks }`.
 *
 * - `before` (meestal de week van de binnengekomen staat) → alleen weken die
 *   daar strikt vóór liggen tellen mee; de week zelf is immers wat we beoordelen.
 * - Weektotalen van dezelfde maandag worden OPGETELD: iemand kan in één week bij
 *   twee plaatsingen uren schrijven, en dat is samen zijn weektotaal.
 * - Van de overgebleven weken tellen de `limit` MEEST RECENTE mee.
 * - Een week met 0 uur telt gewoon mee (dat is een echte, lage week); een week
 *   die helemaal ontbreekt bestaat niet en drukt het gemiddelde dus niet.
 * - Onbruikbare regels (NaN/oneindig/negatief/ongeldige datum) worden genegeerd.
 */
export function summarizeRecentWeeks(
  rows: WeeklyTotal[],
  options: { before?: Date | null; limit?: number } = {},
): RecentWeeksSummary {
  const limit = options.limit ?? GATE_HISTORY_WEEKS;
  const beforeTime = options.before ? options.before.getTime() : null;

  // Optellen per maandag (meerdere plaatsingen in dezelfde week = één weektotaal).
  const byWeek = new Map<number, number>();
  for (const row of rows) {
    const time = row?.weekStart instanceof Date ? row.weekStart.getTime() : Number.NaN;
    if (!Number.isFinite(time)) continue;
    if (beforeTime !== null && !(time < beforeTime)) continue;
    if (!usableHours(row.hours)) continue;
    byWeek.set(time, (byWeek.get(time) ?? 0) + row.hours);
  }

  const recent = [...byWeek.entries()]
    .sort((a, b) => b[0] - a[0]) // nieuwste week eerst
    .slice(0, Math.max(0, limit));

  if (recent.length === 0) return { recentAvgHours: null, recentWeeks: 0 };

  const total = recent.reduce((sum, [, hours]) => sum + hours, 0);
  return { recentAvgHours: round2(total / recent.length), recentWeeks: recent.length };
}
