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
