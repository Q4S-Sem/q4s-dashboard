// ---------------------------------------------------------------------------
// Naam-matching voor AI-uitlezingen: koppel een uit een document gelezen naam
// (urenstaat in inbox-extract.ts, ZZP-factuur in invoice-extract.ts) aan een
// medewerker in de database.
//
// Bewust STRENG: élk deel van de voor- én achternaam moet als heel woord in de
// uitgelezen naam voorkomen ("An Berg" wordt dus nooit "Johanna van den Berg"),
// en alleen bij precies ÉÉN treffer noemen we het een match. Bij twijfel geen
// match — een mens bevestigt toch, maar een foute koppeling boekt geld op de
// verkeerde persoon.
//
// PUUR: geen Prisma, geen IO — het ophalen van de medewerkers doet de aanroeper.
// ---------------------------------------------------------------------------

export type NamedPerson = { firstName: string; lastName: string };

/** Kleine letters, zonder diakrieten en leestekens, enkele spaties. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Loosely compare an extracted name to a person's first + last name. */
export function nameMatches(c: NamedPerson, extracted: string): boolean {
  const tokens = new Set(normalizeName(extracted).split(" ").filter(Boolean));
  if (tokens.size === 0) return false;
  // Require every part of the first AND last name to appear as a whole token,
  // so "An Berg" does not match "Johanna van den Berg".
  const parts = [...normalizeName(c.firstName).split(" "), ...normalizeName(c.lastName).split(" ")].filter(
    Boolean,
  );
  return parts.length > 0 && parts.every((p) => tokens.has(p));
}

/**
 * Zoek de medewerker(s) die bij een uitgelezen naam horen. `match` is alleen
 * gevuld bij precies één treffer; `candidates` bevat élke treffer, zodat de UI
 * bij naamgenoten een keuze kan voorleggen.
 */
export function matchByName<T extends NamedPerson>(
  people: readonly T[],
  extracted: string | null | undefined,
): { match: T | null; candidates: T[] } {
  const name = (extracted ?? "").trim();
  if (!name) return { match: null, candidates: [] };
  const candidates = people.filter((p) => nameMatches(p, name));
  return { match: candidates.length === 1 ? candidates[0] : null, candidates };
}
