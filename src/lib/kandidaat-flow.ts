// ---------------------------------------------------------------------------
// De recruitment-flow van een kandidaat, in 4 stappen:
//   1 Binnengekomen (website / mail / handmatig)
//   2 Beoordelen   — CV inladen en een beoordeling geven
//   3 Profiel      — discipline, beschikbaarheid, notities
//   4 Pipeline     — aan bedrijf + vacature koppelen
// `kandidaatStap` geeft de stap waar hij nu staat (5 = alles gedaan).
// ---------------------------------------------------------------------------

export const KANDIDAAT_STAPPEN = ["Binnengekomen", "Beoordelen", "Profiel", "Pipeline"] as const;

export function kandidaatStap(c: { rating: string; discipline: string | null; inPipeline: boolean }): number {
  if (c.rating === "ONBEKEND") return 2;
  if (!c.discipline) return 3;
  if (!c.inPipeline) return 4;
  return 5;
}
