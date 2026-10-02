// Klantnaam NOOIT publiek. Vacatures op q4s.nl en de vacaturepagina tonen geen
// opdrachtgever; dit vangnet haalt de naam ook uit de vrije tekst (bijv. als de
// klant in de ruwe tekst of de AI-tekst genoemd werd). Intern blijft alles staan.

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Varianten van een bedrijfsnaam: volledig en zonder rechtsvorm (B.V., GmbH…). */
function naamVarianten(namen: (string | null | undefined)[]): string[] {
  const uit = new Set<string>();
  for (const n of namen) {
    const vol = n?.trim();
    if (!vol) continue;
    uit.add(vol);
    const kaal = vol.replace(/[\s,]+(b\.?\s?v\.?|n\.?\s?v\.?|gmbh|ltd\.?|inc\.?|s\.?a\.?)$/i, "").trim();
    if (kaal) uit.add(kaal);
  }
  // Langste eerst, zodat "HSM Offshore B.V." vóór "HSM Offshore" vervangen wordt.
  return [...uit].filter((v) => v.length >= 3).sort((a, b) => b.length - a.length);
}

/** Vervang elke vermelding van de klantnaam (hoofdletterongevoelig) door "onze opdrachtgever". */
export function zonderKlantnaam(tekst: string, klantnamen: (string | null | undefined)[]): string;
export function zonderKlantnaam(tekst: string | null, klantnamen: (string | null | undefined)[]): string | null;
export function zonderKlantnaam(tekst: string | null, klantnamen: (string | null | undefined)[]): string | null {
  if (!tekst) return tekst;
  let uit = tekst;
  for (const v of naamVarianten(klantnamen)) {
    uit = uit.replace(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRe(v)}(?![\\p{L}\\p{N}])`, "giu"), "onze opdrachtgever");
  }
  return uit;
}
