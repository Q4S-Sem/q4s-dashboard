import fs from "node:fs";
import path from "node:path";

const IMAGE_EXT = new Set([".png", ".svg", ".jpg", ".jpeg", ".webp", ".avif", ".gif"]);

/**
 * The logo to show in the top bar: the first image file dropped into
 * public/logo/, as a public path (/logo/<file>), or null if none yet.
 */
export function getLogoSrc(): string | null {
  try {
    const dir = path.join(process.cwd(), "public", "logo");
    const file = fs
      .readdirSync(dir)
      .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
      .sort()[0];
    return file ? `/logo/${encodeURIComponent(file)}` : null;
  } catch {
    return null;
  }
}

/**
 * The logo file as raw bytes + extension, for embedding in generated PDFs
 * (pdf-lib). Returns the same first image as {@link getLogoSrc}, or null.
 */
export function getLogoFile(): { bytes: Buffer; ext: string } | null {
  try {
    const dir = path.join(process.cwd(), "public", "logo");
    const file = fs
      .readdirSync(dir)
      .filter((f) => IMAGE_EXT.has(path.extname(f).toLowerCase()))
      .sort()[0];
    if (!file) return null;
    return { bytes: fs.readFileSync(path.join(dir, file)), ext: path.extname(file).toLowerCase() };
  } catch {
    return null;
  }
}

/**
 * Het logo voor het CV, doorzichtig en zonder wit vlak eromheen.
 *
 * Bewust eigen bestanden en niet {@link getLogoFile}. Twee redenen:
 *
 * 1. BIJGESNEDEN. De bronbestanden in `public/logo/` hebben ~23% lege rand
 *    ingebakken; op het CV staat het logo klein in de hoek, en dan blijft van
 *    20pt hoog nog maar 11pt inkt over. Deze bestanden zijn exact op de inkt
 *    bijgesneden, dus een opgegeven hoogte is ook de hoogte die je ziet.
 * 2. TWEE KLEUREN. Het beeldmerk is één kleur inkt met gaten — de "witte" delen
 *    zijn doorzichtig. Op de accentbalk moet het dus de omgekeerde (witte)
 *    versie zijn, anders schijnt het accent door het hart van het merk. Op een
 *    lichte accentkleur is zwart juist de leesbare. Zie `readableOn()`.
 *
 * Valt terug op het algemene logo, zodat er nooit een CV zonder afzender uitgaat.
 *
 * @param wit De omgekeerde versie (witte inkt), voor op een donkere ondergrond.
 */
export function getCvLogoFile(wit = false): { bytes: Buffer; ext: string } | null {
  const naam = wit ? "q4s-logo-wit.png" : "q4s-logo.png";
  try {
    const p = path.join(process.cwd(), "public", "logo", "cv", naam);
    return { bytes: fs.readFileSync(p), ext: ".png" };
  } catch {
    return getLogoFile();
  }
}
