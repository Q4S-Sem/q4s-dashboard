// ---------------------------------------------------------------------------
// Einde van een plaatsing: in de LAATSTE MAAND (einddatum min één kalendermaand)
// krijgt die persoon een melding, zodat er op tijd verlengd of afgerond wordt.
// ---------------------------------------------------------------------------

const DAG = 86_400_000;
const dagStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export type Einde = { status: "laatste-maand" | "verlopen"; dagen: number };

/** null = geen einddatum of nog niet in de laatste maand. */
export function eindeStatus(endDate: Date | null | undefined, now: Date = new Date()): Einde | null {
  if (!endDate) return null;
  const eind = dagStart(endDate);
  const vandaag = dagStart(now);
  const dagen = Math.round((eind.getTime() - vandaag.getTime()) / DAG);
  if (dagen < 0) return { status: "verlopen", dagen };
  const maandErvoor = new Date(eind.getFullYear(), eind.getMonth() - 1, eind.getDate());
  return vandaag >= maandErvoor ? { status: "laatste-maand", dagen } : null;
}

export function eindeTekst(e: Einde): string {
  if (e.status === "verlopen") return `Contract verlopen (${-e.dagen} d geleden)`;
  return e.dagen === 0 ? "Eindigt vandaag" : `Eindigt over ${e.dagen} ${e.dagen === 1 ? "dag" : "dagen"}`;
}
