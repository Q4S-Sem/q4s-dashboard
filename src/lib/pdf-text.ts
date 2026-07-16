/**
 * Tekst-helpers voor pdf-lib-documenten.
 *
 * ACHTERGROND: de ingebouwde Helvetica kent alleen WinAnsi (≈ Latin-1).
 * invoice-pdf.ts en evaluation-pdf.ts hebben elk een eigen `sanitize()` die
 * onbekende tekens simpelweg WEGGOOIT. Voor facturen valt dat niet op, maar op een
 * CV wél: Q4S plaatst veel Poolse en Roemeense vakmensen, en "Michał Wójcik" werd
 * zo "Micha Wójcik" — een verkeerde naam op het CV van je klant.
 *
 * Het CV sluit daarom Inter in (zie cv-fonts.ts) en kent die beperking niet meer.
 * Vandaar de `unicode`-schakelaar:
 *   - unicode = true  → alleen witruimte normaliseren; tekens blijven intact.
 *   - unicode = false → translitereren (ł → l) en pas als laatste redmiddel
 *     weggooien, zodat een naam hooguit benaderd wordt i.p.v. stil verminkt.
 *
 * (invoice-pdf.ts en evaluation-pdf.ts hebben nog hun eigen kopie; die kunnen hier
 * later op over — bewust niet in deze wijziging, om die PDF's niet te raken.)
 */

const CP1252_EXTRA = "€–—‘’“”•…™";

/** Tekens die Latin-1 niet heeft, maar die wel op CV's staan. */
const TRANSLITERATE: Record<string, string> = {
  // Pools
  ł: "l", Ł: "L", ą: "a", Ą: "A", ć: "c", Ć: "C", ę: "e", Ę: "E",
  ń: "n", Ń: "N", ó: "o", Ó: "O", ś: "s", Ś: "S", ź: "z", Ź: "Z", ż: "z", Ż: "Z",
  // Roemeens
  ă: "a", Ă: "A", ș: "s", Ș: "S", ş: "s", Ş: "S", ț: "t", Ț: "T", ţ: "t", Ţ: "T",
  // Tsjechisch / Slowaaks / Kroatisch
  č: "c", Č: "C", ď: "d", Ď: "D", ě: "e", Ě: "E", ň: "n", Ň: "N", ř: "r", Ř: "R",
  š: "s", Š: "S", ť: "t", Ť: "T", ů: "u", Ů: "U", ž: "z", Ž: "Z", đ: "d", Đ: "D",
  // Turks
  ı: "i", İ: "I", ğ: "g", Ğ: "G",
  // Hongaars
  ő: "o", Ő: "O", ű: "u", Ű: "U",
  // Overig
  "≥": ">=", "≤": "<=", "→": "->", "×": "x", "✓": "-",
};

const NBSP = " ";

/** Maak tekst geschikt voor het gekozen lettertype (zie de `unicode`-schakelaar boven). */
export function sanitizePdfText(value: string, unicode = false): string {
  const s = (value ?? "").split(NBSP).join(" ").replace(/[\r\n\t]+/g, " ");
  if (unicode) return s;
  return s
    .split("")
    .map((ch) => {
      const code = ch.charCodeAt(0);
      if (code >= 0x20 && code <= 0x7e) return ch; // ASCII
      if (code >= 0xa0 && code <= 0xff) return ch; // Latin-1
      if (CP1252_EXTRA.includes(ch)) return ch;
      const alt = TRANSLITERATE[ch];
      if (alt !== undefined) return alt;
      // Losse accenten strippen (é → e) voordat we het opgeven.
      const decomposed = ch.normalize("NFD").replace(/\p{Diacritic}/gu, "");
      if (decomposed && /^[\x20-\x7e]+$/.test(decomposed)) return decomposed;
      return "";
    })
    .join("");
}

type Measurer = { widthOfTextAtSize(text: string, size: number): number };

/**
 * Breek tekst in regels die binnen `maxWidth` passen.
 *
 * Anders dan de greedy wrappers in invoice-pdf.ts/evaluation-pdf.ts breekt deze
 * ook BINNEN een woord dat op zichzelf al te lang is (lange URL's, e-mailadressen
 * en Duitse werkgeversnamen op een CV), zodat er niets over de marge heen loopt.
 */
export function wrapText(
  value: string,
  font: Measurer,
  size: number,
  maxWidth: number,
  unicode = false,
): string[] {
  const clean = sanitizePdfText(value, unicode).trim();
  if (!clean) return [];

  const lines: string[] = [];
  let line = "";

  const pushLine = () => {
    if (line) lines.push(line);
    line = "";
  };

  /** Hak een woord dat zelfs alleen op een regel niet past, teken voor teken. */
  const breakLongWord = (word: string) => {
    let chunk = "";
    for (const ch of word) {
      if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth && chunk) {
        lines.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    line = chunk;
  };

  for (const word of clean.split(/\s+/)) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
      line = candidate;
      continue;
    }
    pushLine();
    if (font.widthOfTextAtSize(word, size) > maxWidth) {
      breakLongWord(word);
    } else {
      line = word;
    }
  }
  pushLine();
  return lines;
}

/** Kort af met een beletselteken tot het op één regel past. */
export function truncateText(
  value: string,
  font: Measurer,
  size: number,
  maxWidth: number,
  unicode = false,
): string {
  let t = sanitizePdfText(value, unicode);
  if (font.widthOfTextAtSize(t, size) <= maxWidth) return t;
  while (t.length > 1 && font.widthOfTextAtSize(`${t}…`, size) > maxWidth) {
    t = t.slice(0, -1);
  }
  return `${t}…`;
}
