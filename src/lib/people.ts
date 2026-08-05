/**
 * Kleine helpers om een persoon consistent te tonen in de recruitment-schermen.
 * De Avatar valt terug op gekleurde initialen als er geen foto is, dus alles
 * werkt ook zonder geüploade pasfoto's.
 */

/** Volledige naam uit los opgeslagen voor-/achternaam. */
export function fullName(p: { firstName: string; lastName: string }): string {
  return `${p.firstName} ${p.lastName}`.trim();
}

/**
 * Bron-URL voor de pasfoto van een kandidaat, of `null` als die er niet is.
 * De route zit achter de sessiepoort — foto's zijn persoonsgegevens.
 */
export function candidatePhotoSrc(
  c: { id: string; photoFileName?: string | null } | null | undefined,
): string | null {
  if (!c?.photoFileName) return null;
  return `/api/kandidaat-foto/${c.id}`;
}

/** Naam + foto in één klap, klaar voor `<Avatar {...person(c)} />`. */
export function person(c: {
  id: string;
  firstName: string;
  lastName: string;
  photoFileName?: string | null;
}): { name: string; src: string | null } {
  return { name: fullName(c), src: candidatePhotoSrc(c) };
}
