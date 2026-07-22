/**
 * Kleine hulpjes om gevoelige persoonsgegevens uit tekst te halen vóór die tekst
 * naar een externe AI-provider gaat (dataminimalisatie, AVG art. 5).
 *
 * Nu: BSN. Een BSN heeft in een CV niets te zoeken, maar áls het erin staat mag het
 * zeker niet mee naar een AI-provider. We herkennen het met de elfproef, zodat een
 * gewoon 9-cijferig getal (bijv. een telefoon- of ordernummer) niet per ongeluk
 * wordt weggestreept.
 */

/** Voldoet een reeks van 9 cijfers aan de BSN-elfproef? */
export function isBsn(digits: string): boolean {
  if (!/^\d{9}$/.test(digits)) return false;
  const w = [9, 8, 7, 6, 5, 4, 3, 2, -1];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += Number(digits[i]) * w[i];
  return sum !== 0 && sum % 11 === 0;
}

/**
 * Vervang BSN-achtige getallen (9 cijfers die de elfproef doorstaan) door een
 * markering. Werkt op losse getallen (niet midden in een langere cijferreeks), en
 * tolereert punten/spaties als scheidingsteken (123.456.789).
 */
export function redactBsn(text: string): string {
  return text.replace(/(?<![\d.])\d{3}[.\s]?\d{3}[.\s]?\d{3}(?![\d.])/g, (m) => {
    const digits = m.replace(/[.\s]/g, "");
    return isBsn(digits) ? "[BSN verwijderd]" : m;
  });
}
