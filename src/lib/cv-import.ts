import { db } from "./db";
import { aiJSONFromFile, isVisionConfigured } from "./ai";
import { runCvIntakeShortlist } from "./cv-intake";
import { saveCvUpload, MAX_UPLOAD_BYTES } from "./uploads";
import {
  attachCvToExistingCandidate,
  candidateDedupeKeys,
  findDuplicateCandidate,
  hasDedupeKey,
  recordCandidateReapplication,
} from "./candidate-dedupe";

// ---------------------------------------------------------------------------
// Eén CV-bijlage tot kandidaat maken. Dit is de intake-weg die de handmatige
// import op /website/cv-inbox/importeren al liep; hij staat hier zodat ook de
// postvak-intake (CV's die naar admin@q4s.nl worden gemaild) exact dezelfde weg
// aflegt: kandidaat aanmaken (of aan de bestaande hangen), CV opslaan en
// runCvIntakeShortlist laten lopen voor een RecruiterAlert.
//
// Review-only: er wordt geen sollicitatie, plaatsing, deal of bericht gemaakt en
// geen status gewijzigd. Alles blijft wachten op een recruiter.
// ---------------------------------------------------------------------------

/** Toegestane CV-bestandstypen: alleen wat cv-extract echt kan uitlezen. */
export const CV_EXTENSIONS = new Set([".pdf", ".docx", ".png", ".jpg", ".jpeg", ".webp"]);

export function isReadableCvName(name: string): boolean {
  const m = name.toLowerCase().match(/\.[a-z0-9]+$/);
  return m ? CV_EXTENSIONS.has(m[0]) : false;
}

/** Haal een fatsoenlijke voor-/achternaam uit een bestandsnaam als er verder
 *  niets bekend is (bv. "Jan_de_Vries_CV_2025.pdf" → Jan / de Vries). */
export function nameFromCvFilename(name: string): { firstName: string; lastName: string } {
  let base = name.replace(/\.[a-z0-9]+$/i, "").replace(/[_\-.]+/g, " ");
  base = base.replace(/\b(cv|curriculum vitae|resume|resum[ée]|sollicitatie|q4s)\b/gi, " ");
  base = base.replace(/\b(19|20)\d{2}\b/g, " ").replace(/\s+/g, " ").trim();
  const parts = base.split(" ").filter(Boolean);
  if (parts.length === 0) return { firstName: "Onbekend", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

const CV_EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    firstName: { type: ["string", "null"] },
    lastName: { type: ["string", "null"] },
    discipline: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
    phone: { type: ["string", "null"] },
    headline: { type: ["string", "null"] },
  },
  required: ["firstName", "lastName", "discipline", "email", "phone", "headline"],
} as const;

export type CvExtract = {
  firstName: string | null;
  lastName: string | null;
  discipline: string | null;
  email: string | null;
  phone: string | null;
  headline: string | null;
};

/** Best-effort: lees naam/discipline/contact uit een PDF of afbeelding via AI.
 *  Word/Excel worden overgeslagen (geen native extractie) → null. */
export async function aiExtractCvFields(file: {
  bytes: Uint8Array;
  name: string;
  mime: string;
}): Promise<CvExtract | null> {
  if (!isVisionConfigured()) return null;
  let mediaType = "";
  if (file.mime.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")) {
    mediaType = "application/pdf";
  } else if (/^image\/(png|jpe?g|gif|webp)$/.test(file.mime)) {
    mediaType = file.mime;
  } else {
    return null;
  }
  try {
    return await aiJSONFromFile<CvExtract>({
      system:
        "Je leest CV's van technische kandidaten (QA/QC, lassers, fitters, NDO/NDT). Geef alleen wat echt op het CV staat; verzin niets.",
      prompt:
        "Haal uit dit CV: voornaam, achternaam, discipline/vakgebied, e-mail, telefoon en een korte functietitel (headline). Onbekende velden = null.",
      schema: CV_EXTRACT_SCHEMA,
      file: { base64: Buffer.from(file.bytes).toString("base64"), mediaType },
      maxTokens: 500,
      effort: "low",
    });
  } catch {
    return null;
  }
}

export type CvImportResult = {
  candidateId: string;
  /** false = de bijlage is aan een al bestaande kandidaat gehangen. */
  createdCandidate: boolean;
  /** true wanneer het CV aan een nog leeg CV-veld is gekoppeld. */
  attachedCv: boolean;
};

/**
 * Importeer één CV-bestand als kandidaat. Geeft `null` terug wanneer het bestand
 * niet uitleesbaar of te groot is — de aanroeper houdt het dan als "handmatig
 * oppakken" aan.
 */
export async function importCvFile(input: {
  bytes: Uint8Array;
  name: string;
  mime: string;
  /** Waarde uit CANDIDATE_SOURCES, bv. "EMAIL" of "IMPORT". */
  source: string;
  /** Waar de bijlage vandaan kwam, in lopende tekst — komt in de melding bij een
   *  bestaande kandidaat ("een CV-mail van jan@example.nl"). */
  origin: string;
  /** Naam/contact uit het CV laten lezen (alleen met een vision-sleutel). */
  useAi?: boolean;
}): Promise<CvImportResult | null> {
  if (!isReadableCvName(input.name)) return null;
  if (input.bytes.length === 0 || input.bytes.length > MAX_UPLOAD_BYTES) return null;

  const extracted = input.useAi
    ? await aiExtractCvFields({ bytes: input.bytes, name: input.name, mime: input.mime })
    : null;

  const fallback = nameFromCvFilename(input.name);
  const firstName = extracted?.firstName?.trim() || fallback.firstName;
  const lastName = extracted?.lastName?.trim() || fallback.lastName;
  const email = extracted?.email?.trim() || null;
  const phone = extracted?.phone?.trim() || null;

  // Bewaar het bestand altijd: ook bij een bestaande kandidaat willen we het
  // kunnen koppelen of er in de melding naar kunnen verwijzen.
  const cvFileName = await saveCvUpload(
    new File([new Uint8Array(input.bytes)], input.name, { type: input.mime || "application/octet-stream" }),
  );
  const cv = {
    cvFileName,
    cvOriginalName: input.name,
    cvMimeType: input.mime || "application/octet-stream",
    cvSize: input.bytes.length,
  };

  const keys = candidateDedupeKeys({ email, phone });
  const duplicate = hasDedupeKey(keys) ? await findDuplicateCandidate(keys) : null;

  let candidateId: string;
  let createdCandidate: boolean;
  let attachedCv: boolean;
  if (duplicate) {
    candidateId = duplicate.id;
    createdCandidate = false;
    attachedCv = await attachCvToExistingCandidate(duplicate.id, cv);
    await recordCandidateReapplication({
      candidate: duplicate,
      origin: input.origin,
      unattachedCvName: attachedCv ? null : input.name,
    });
  } else {
    const created = await db.candidate.create({
      data: {
        firstName: firstName || "Onbekend",
        lastName,
        email,
        phone,
        discipline: extracted?.discipline?.trim() || null,
        headline: extracted?.headline?.trim() || null,
        source: input.source,
        ...cv,
      },
    });
    candidateId = created.id;
    createdCandidate = true;
    attachedCv = true;
  }

  try {
    await runCvIntakeShortlist(candidateId);
  } catch {
    // Mislukte intake wordt als ERROR-run vastgelegd; het CV zelf staat er.
  }

  return { candidateId, createdCandidate, attachedCv };
}
