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

/**
 * Letters met een STREEP of SCHUINE STREEP erdoor (ł, ø, đ, ħ, ŧ) zijn in
 * Unicode één ondeelbaar teken: NFD splitst ze niet in "letter + diakriet", dus
 * ze overleven de diakrieten-stap niet en zouden als leesteken wegvallen.
 * Zonder deze tabel werd "Michał" tot "micha" en matchte een Poolse urenstaat
 * ("Michal Wojcik") nooit met de medewerker in de database — precies de groep
 * vakmensen waar dit dashboard voor gebouwd is.
 */
const LOSSE_LETTERS: Record<string, string> = {
  ł: "l",
  ø: "o",
  đ: "d",
  ð: "d",
  ħ: "h",
  ŧ: "t",
  ı: "i",
  æ: "ae",
  œ: "oe",
  ß: "ss",
};

/** Kleine letters, zonder diakrieten en leestekens, enkele spaties. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[łøđðħŧıæœß]/g, (c) => LOSSE_LETTERS[c] ?? c)
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

// ---------------------------------------------------------------------------
// ZZP-factuur → medewerker. Een ZZP'er factureert vaak onder zijn BEDRIJFSNAAM
// ("Kowalski Welding Sp. z o.o."), niet onder zijn eigen naam. Dus eerst op
// harde kenmerken (KvK, btw-nummer, IBAN), dan op bedrijfsnaam, en pas als
// laatste op de persoonsnaam. Elke stap telt alleen bij precies ÉÉN treffer.
// ---------------------------------------------------------------------------

export type ZzpPerson = NamedPerson & {
  companyName?: string | null;
  kvkNumber?: string | null;
  vatNumber?: string | null;
  iban?: string | null;
};

export type ZzpGelezen = {
  name?: string | null;
  kvkNumber?: string | null;
  vatId?: string | null;
  iban?: string | null;
};

/** Alleen letters/cijfers, hoofdletters: "NL02 abna 0123" → "NL02ABNA0123". */
export function normalizeId(s: string | null | undefined): string {
  return (s ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Bedrijfsnaam zonder rechtsvorm-ruis, zodat "Jansen Lassen B.V." == "jansen lassen". */
export function normalizeCompany(s: string | null | undefined): string {
  // Losse letters ("B.V." → "b v", "z o.o." → "z o o") vallen ook weg.
  const RUIS = new Set(["bv", "vof", "sp", "zoo", "ltd", "gmbh", "srl", "sro", "eenmanszaak", "holding"]);
  return normalizeName(s ?? "")
    .split(" ")
    .filter((w) => w.length > 1 && !RUIS.has(w))
    .join(" ");
}

export function matchZzpFactuur<T extends ZzpPerson>(
  people: readonly T[],
  gelezen: ZzpGelezen,
): { match: T | null; candidates: T[]; via: "kvk" | "btw" | "iban" | "bedrijf" | "naam" | null } {
  const uniek = (via: "kvk" | "btw" | "iban" | "bedrijf", hits: T[]) =>
    hits.length === 1 ? { match: hits[0], candidates: hits, via } : null;
  const id = (key: "kvkNumber" | "vatNumber" | "iban", waarde: string | null | undefined) => {
    const w = normalizeId(waarde);
    // Te kort = geen betrouwbaar kenmerk (bv. "0" of een losse letter).
    return w.length < 6 ? [] : people.filter((p) => normalizeId(p[key]) === w);
  };

  const harde =
    uniek("kvk", id("kvkNumber", gelezen.kvkNumber)) ??
    uniek("btw", id("vatNumber", gelezen.vatId)) ??
    uniek("iban", id("iban", gelezen.iban));
  if (harde) return harde;

  const bedrijf = normalizeCompany(gelezen.name);
  if (bedrijf) {
    const viaBedrijf = uniek(
      "bedrijf",
      people.filter((p) => normalizeCompany(p.companyName) === bedrijf),
    );
    if (viaBedrijf) return viaBedrijf;
  }

  const { match, candidates } = matchByName(people, gelezen.name);
  return { match, candidates, via: match ? "naam" : null };
}
