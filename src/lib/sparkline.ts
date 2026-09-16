// Pure helpers voor mini-trendlijnen (sparklines) in dashboard-KPI-kaarten.
// Geen IO — triviaal unit-testbaar (tests/sparkline.test.ts).

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Zet een reeks waarden om in een SVG-pad ("M.. L..") binnen w×h.
 * De y-as loopt van max (boven) naar 0 (onder); een vlakke reeks tekent
 * een middenlijn. Minder dan 2 punten → geen lijn.
 */
export function sparklinePath(values: number[], w: number, h: number): string {
  if (values.length < 2) return "";
  const max = Math.max(...values);
  const min = Math.min(...values);
  const range = max - min;
  const stepX = w / (values.length - 1);
  return values
    .map((v, i) => {
      const x = round1(i * stepX);
      // Vlakke reeks → middenlijn; anders normaliseren tussen min en max.
      const y = range === 0 ? round1(h / 2) : round1(h - ((v - min) / range) * h);
      return `${i === 0 ? "M" : "L"}${x},${y}`;
    })
    .join(" ");
}

/** Zelfde lijn, maar gesloten langs de onderkant — voor de zachte vulling. */
export function sparklineAreaPath(values: number[], w: number, h: number): string {
  const line = sparklinePath(values, w, h);
  if (!line) return "";
  return `${line} L${w},${h} L0,${h} Z`;
}
