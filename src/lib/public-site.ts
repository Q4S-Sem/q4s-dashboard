// Links naar de PUBLIEKE vacaturepagina's op q4s.nl. Het dashboard heeft zelf
// ook een kale /vacature/<slug>-pagina (de bron voor de website-feed), maar
// "Bekijk op de website" moet naar de échte site — niet naar die interne
// voorbeeldweergave.

/**
 * Standaard-website als er (nog) geen website in Instellingen staat. Dit is
 * het live domein van Q4S; Instellingen › website overschrijft dit overal
 * waar de server settings doorgeeft.
 */
const DEFAULT_SITE = "https://www.q4s.nl";

/** Absolute URL van de vacature op de publieke website (q4s.nl). */
export function publicVacancyUrl(
  slug: string,
  website?: string | null,
): string {
  const raw = (website ?? "").trim() || DEFAULT_SITE;
  const base = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  return `${base.replace(/\/+$/, "")}/nl/vacatures/${slug}`;
}
