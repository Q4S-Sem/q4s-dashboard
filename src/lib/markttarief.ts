// Fallback voor het tarief-veld: staat er geen tarief, dan tonen/bewaren we
// letterlijk "Marktconform" — géén zelfbedachte bedragen. Bewuste keuze:
// het dashboard verzint geen prijsindicatie richting klant of kandidaat.

/** De vaste fallback-tekst voor een leeg tarief-veld. */
export function marktconformTarief(_discipline?: string | null): string {
  return "Marktconform";
}

/**
 * Geef het ingevoerde tarief terug, of "Marktconform" wanneer het veld leeg
 * is. Een echt ingevuld tarief blijft altijd staan.
 */
export function withMarktconformFallback(
  rateText: string | null | undefined,
  _discipline?: string | null,
): string {
  const entered = (rateText ?? "").trim();
  return entered !== "" ? entered : marktconformTarief();
}
