// ---------------------------------------------------------------------------
// Het denkwerk achter het inline tonen van een geüpload document: welke weergave
// hoort bij dit bestand — een PDF in een iframe, een scan/foto in een <img>, en
// al het andere als nette terugvalkaart met open-/downloadlinks.
//
// PUUR en DETERMINISTISCH: geen Prisma, geen I/O, geen fs. Zo gebruiken het
// scherm (client) en de server dezelfde regels en is alles los te testen
// (tests/document-viewer.test.ts).
//
// Het mimetype dat de uploadende browser meestuurt is NIET heilig: we leiden het
// ook uit de extensie af en vallen bij alles wat we niet vertrouwen (html, svg)
// terug op "geen voorbeeld", zodat een als ".pdf" aangeleverd HTML-bestand nooit
// kan renderen.
// ---------------------------------------------------------------------------

/** Hoe we een bestand in het scherm laten zien. */
export type DocumentSoort = "pdf" | "afbeelding" | "geen-voorbeeld";

/** Extensies die we vertrouwen om inline te tonen (spiegelt INLINE_SAFE_TYPES). */
const MIME_PER_EXTENSIE: Record<string, string> = {
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

/** De afbeeldingstypes die in een <img> mogen (géén svg: die kan script bevatten). */
const AFBEELDING_MIMES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

/** De extensie zonder punt, in kleine letters ("" als er geen is). */
function extensieVan(name: string): string {
  const punt = name.lastIndexOf(".");
  if (punt <= 0 || punt === name.length - 1) return "";
  return name.slice(punt + 1).toLowerCase();
}

/**
 * Het mimetype dat bij deze opgeslagen naam hoort, afgeleid uit de EXTENSIE en
 * niet uit iets wat de browser meestuurt. Alles wat we niet inline tonen wordt
 * `application/octet-stream` — fileResponseHeaders maakt daar dan een download
 * van, zodat een als ".pdf" aangeleverd HTML-bestand nooit kan renderen.
 */
export function mimeVanBestandsnaam(fileName: string): string {
  return MIME_PER_EXTENSIE[extensieVan(fileName)] ?? "application/octet-stream";
}

/**
 * Welke weergave hoort bij dit bestand? Een pdf gaat in een iframe, een foto of
 * scan in een <img>, en al het andere (Excel, CSV, onbekend) krijgt de nette
 * terugvalkaart met open-/downloadlinks.
 *
 * Het opgegeven mimetype is niet heilig — het komt van de uploadende browser —
 * dus een type dat we niet inline vertrouwen (html, svg) valt altijd terug, en
 * een leeg of algemeen type mag alsnog op de extensie herkend worden.
 */
export function documentSoort(
  mimeType: string | null | undefined,
  originalName?: string | null,
): DocumentSoort {
  const mime = (mimeType ?? "").trim().toLowerCase().split(";")[0];
  const naam = (originalName ?? "").trim();
  const uitNaam = naam ? mimeVanBestandsnaam(naam) : "application/octet-stream";

  if (mime === "application/pdf" || uitNaam === "application/pdf") return "pdf";
  if (AFBEELDING_MIMES.has(mime) || AFBEELDING_MIMES.has(uitNaam)) return "afbeelding";
  return "geen-voorbeeld";
}
