import "server-only";
import { db } from "./db";
import { getCompanySettings } from "./settings";
import { getCvLogoFile } from "./branding";
import { readUpload, photoKey } from "./uploads";
import { buildCvDoc } from "./cv-doc";
import { cvTemplateFromSettings } from "./cv-template";

/**
 * Alles wat het CV-vel nodig heeft, in één keer opgehaald: de inhoud, de
 * vormgeving, het logo en de pasfoto. Zowel het voorbeeld in de generator als
 * de printpagina gebruiken dit, zodat ze niet uit elkaar kunnen lopen.
 */

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".avif": "image/avif",
};

/**
 * Het logo als data-URI. Bewust ingesloten en niet als /logo/…-pad: bij printen
 * naar PDF haalt de browser externe plaatjes soms niet op tijd op, en dan rolt
 * er een CV zonder logo uit.
 */
export function logoDataUri(): string | null {
  const f = getCvLogoFile();
  if (!f) return null;
  const mime = MIME[f.ext] ?? "application/octet-stream";
  return `data:${mime};base64,${f.bytes.toString("base64")}`;
}

/**
 * De pasfoto als bytes, voor de PDF-download. Het vel in de browser laadt hem via
 * /api/kandidaat-foto/…, maar pdf-lib heeft het bestand zelf nodig.
 */
export async function loadCvPhoto(
  candidate: { photoFileName: string | null; photoMimeType: string | null } | null,
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (!candidate?.photoFileName) return null;
  try {
    const buf = await readUpload(photoKey(candidate.photoFileName));
    return { bytes: new Uint8Array(buf), mime: candidate.photoMimeType ?? "image/jpeg" };
  } catch {
    return null;
  }
}

export async function loadCvSheet(profileId: string) {
  const profile = await db.cvProfile.findUnique({
    where: { id: profileId },
    include: { candidate: true },
  });
  if (!profile) return null;

  const settings = await getCompanySettings();
  const doc = buildCvDoc(profile, settings, profile.candidate);
  const template = cvTemplateFromSettings(settings);

  // De pasfoto komt van de kandidaat; zonder talentpool-record is er geen foto.
  const photoSrc = profile.candidate?.photoFileName
    ? `/api/kandidaat-foto/${profile.candidate.id}`
    : null;

  return { profile, doc, template, logoSrc: logoDataUri(), photoSrc };
}
