// ---------------------------------------------------------------------------
// Het denkwerk achter het inline tonen van een geüpload document: welke weergave
// hoort bij dit bestand, en welke opslag-sleutel mag een streaming-route lezen.
//
// PUUR en DETERMINISTISCH (net als src/lib/week-wizard.ts): geen Prisma, geen
// I/O, geen fs. Zo gebruiken het scherm (client) en de streaming-route (server)
// dezelfde regels en is alles los te testen (tests/document-viewer.test.ts).
//
// De veiligheidskant zit hier bewust in één functie: `veiligeBestandsnaam` is de
// ENIGE plek waar een van buiten aangeleverde sleutel goedgekeurd wordt. Alles
// wat ook maar naar een andere map zou kunnen wijzen (schuine strepen, "..",
// dubbele punten, procent-codering, stuurtekens) valt af, zodat de route zijn
// map-helper (`receivedKey`) veilig kan aanroepen.
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

// ===========================================================================
// 1) SLEUTEL-CONTROLE — welke opslagnaam mag een route ophalen?
// ===========================================================================

/** Maximale lengte van een opgeslagen bestandsnaam (uuid + extensie is ~41). */
const MAX_SLEUTEL_LENGTE = 128;

/**
 * Keur een van buiten aangeleverde opslag-bestandsnaam goed, of weiger 'm.
 *
 * Opgeslagen namen zijn altijd `<uuid><extensie>` (zie saveReceivedBytes /
 * saveInboxBytes), dus we kunnen streng zijn: alleen letters, cijfers, punt,
 * liggend streepje en underscore, beginnend met een letter of cijfer. Daarmee
 * kan de naam nooit uit zijn map wijzen — geen "/", geen "\", geen "..", geen
 * ":" (Windows-drive of alternate stream) en geen "%" (procent-codering).
 *
 * @returns de opgeschoonde naam, of null als hij niet vertrouwd wordt.
 */
export function veiligeBestandsnaam(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const naam = value.trim();
  if (!naam || naam.length > MAX_SLEUTEL_LENGTE) return null;
  if (naam.includes("..")) return null;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(naam)) return null;
  return naam;
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

/** Is dit teken veilig in een header/naam? (stuurtekens vallen af) */
function toonbaar(teken: string): boolean {
  const code = teken.codePointAt(0) ?? 0;
  return code >= 32 && code !== 127;
}

/**
 * De naam die we in de Content-Disposition en op het scherm gebruiken: zonder
 * pad-delen en zonder stuurtekens/regeleindes (header-injectie), teruggevallen
 * op de opslagnaam als er niets bruikbaars overblijft.
 */
export function veiligeWeergavenaam(value: string | null | undefined, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const schoon = [...value].filter(toonbaar).join("");
  const zonderPad = schoon.split(/[/\\]/).pop()?.trim() ?? "";
  return zonderPad.slice(0, MAX_SLEUTEL_LENGTE) || fallback;
}

// ===========================================================================
// 2) WEERGAVE — pdf, afbeelding of "geen voorbeeld"
// ===========================================================================

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

// ===========================================================================
// 3) DE URL VAN EEN NOG NIET GEBOEKT WIZARD-BESTAND
// ===========================================================================

/** Het pad van de streaming-route voor een net geüpload wizard-bestand. */
export const WIZARD_BESTAND_PAD = "/api/wizard-bestand";

/**
 * Bouw de bron-URL voor een bestand dat wél is opgeslagen maar nog geen rij in
 * de database heeft (stap 2 van de wizard: zijn factuur is geüpload, maar pas
 * bij het akkoord wordt er een ReceivedInvoice van gemaakt). Een onveilige
 * sleutel geeft null — dan tonen we gewoon geen voorbeeld.
 */
export function wizardBestandUrl(bestand: {
  fileName: string;
  originalName?: string | null;
}): string | null {
  const sleutel = veiligeBestandsnaam(bestand.fileName);
  if (!sleutel) return null;
  const naam = (bestand.originalName ?? "").trim();
  const query = naam
    ? `key=${encodeURIComponent(sleutel)}&naam=${encodeURIComponent(naam)}`
    : `key=${encodeURIComponent(sleutel)}`;
  return `${WIZARD_BESTAND_PAD}?${query}`;
}
