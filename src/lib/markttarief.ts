// Marktconforme uurtarief-indicaties per discipline (NL detachering,
// staalbouw/industrie). Gebruikt als NETTE FALLBACK wanneer een vacature/deal
// zonder tarief wordt opgeslagen — duidelijk gelabeld "marktconform (indicatie)"
// zodat niemand het aanziet voor een afgesproken klanttarief.
//
// Bandbreedtes zijn bewust ruim (inhuur-uurtarief, excl. btw). Pas ze hier
// centraal aan als de markt verschuift; het label maakt ze herkenbaar op
// elke plek waar ze terechtkomen.

const RANGES: Record<string, [number, number]> = {
  QA_QC: [55, 75],
  HSEQ: [55, 75],
  CIVIL: [55, 80],
  NDO: [60, 85],
  E_I: [55, 80],
  WERKVOORBEREIDING: [50, 70],
  PROJECT_CONTROLS: [60, 85],
  PROJECTMANAGEMENT: [70, 100],
  COMMISSIONING: [65, 90],
  ENGINEERING: [60, 85],
  LASSEN: [45, 65],
  FITTER: [40, 60],
  OVERIG: [45, 70],
};

/** Algemene bandbreedte als de discipline onbekend of niet gezet is. */
const DEFAULT_RANGE: [number, number] = [45, 85];

/**
 * Marktconforme tarief-indicatie voor een discipline, als invulbare tekst
 * voor het `rateText`-veld. Altijd gelabeld als indicatie.
 */
export function marktconformTarief(discipline: string | null | undefined): string {
  const [lo, hi] = (discipline && RANGES[discipline]) || DEFAULT_RANGE;
  return `€ ${lo}-${hi} p/u (marktconform, indicatie)`;
}

/**
 * Geef het ingevoerde tarief terug, of vul het marktconforme tarief in
 * wanneer het veld leeg is. Een echt ingevuld tarief blijft altijd staan.
 */
export function withMarktconformFallback(
  rateText: string | null | undefined,
  discipline: string | null | undefined,
): string {
  const entered = (rateText ?? "").trim();
  return entered !== "" ? entered : marktconformTarief(discipline);
}
