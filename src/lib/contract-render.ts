import "server-only";
import { db } from "./db";
import { getCompanySettings } from "./settings";
import { getCvLogoFile } from "./branding";
import { buildContractDoc } from "./contract-doc";

/**
 * Alles wat het contract-vel nodig heeft, in één keer opgehaald: de inhoud, de
 * bedrijfsinstellingen en het logo. Zowel het voorbeeld in de generator als de
 * printpagina gebruiken dit, zodat ze niet uit elkaar kunnen lopen.
 */

const MIME: Record<string, string> = {
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/**
 * Het logo als data-URI. Bewust ingesloten en niet als /logo/…-pad: bij printen
 * naar PDF haalt de browser externe plaatjes soms niet op tijd op.
 */
export function contractLogoDataUri(): string | null {
  const f = getCvLogoFile();
  if (!f) return null;
  const mime = MIME[f.ext] ?? "application/octet-stream";
  return `data:${mime};base64,${f.bytes.toString("base64")}`;
}

export async function loadContractSheet(contractId: string) {
  const contract = await db.contract.findUnique({
    where: { id: contractId },
    include: { consultant: true, placement: { include: { client: true } } },
  });
  if (!contract) return null;

  const settings = await getCompanySettings();
  const doc = buildContractDoc(contract, settings);

  return { contract, doc, logoSrc: contractLogoDataUri() };
}
