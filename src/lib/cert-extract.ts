import { aiJSONFromFile, isVisionConfigured } from "@/lib/ai";
import { MAX_UPLOAD_BYTES } from "@/lib/uploads";

// ---------------------------------------------------------------------------
// AI: lees een geüpload certificaat/diploma (PDF of afbeelding) uit en haal de
// naam, het nummer, de uitgevende instantie, de afgifte- en de vervaldatum op.
// Dit is de ENE bron van waarheid voor het uitlezen; zowel de certificeringen-
// hub als de medewerker-documentupload gebruiken deze helper, zodat de velden
// overal identiek worden gelezen. Geen DB-write hier.
// ---------------------------------------------------------------------------

export const CERT_EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["name"],
  properties: {
    name: {
      type: "string",
      description:
        "De naam/soort van het certificaat, bv. 'VCA Basis', 'NDT UT Level 2 (EN ISO 9712)' of 'Radiografie (RT) certificaat'.",
    },
    number: {
      type: ["string", "null"],
      description: "Het certificaat-, registratie- of pasnummer (exact zoals op het document).",
    },
    issuer: {
      type: ["string", "null"],
      description: "De uitgevende instantie / het opleidingsinstituut (bv. Hobéon SKO).",
    },
    issuedDate: {
      type: ["string", "null"],
      description: "Afgifte-/uitgiftedatum in formaat YYYY-MM-DD, of null.",
    },
    expiryDate: {
      type: ["string", "null"],
      description: "Vervaldatum / geldig-tot in formaat YYYY-MM-DD, of null.",
    },
  },
};

type CertExtract = {
  name?: string | null;
  number?: string | null;
  issuer?: string | null;
  issuedDate?: string | null;
  expiryDate?: string | null;
};

export type CertExtractResult = {
  data?: {
    name: string;
    number: string;
    issuer: string;
    issuedDate: string;
    expiryDate: string;
  };
  error?: string;
};

/**
 * Een geldige YYYY-MM-DD-string of "" (leeg). Weigert niet alleen fout formaat
 * maar ook kalender-ongeldige datums (bv. 2026-13-01 of 30-02) — de AI kan een
 * dd-mm-jjjj-bron verkeerd omzetten, en zo'n waarde mag nooit als (Invalid) Date
 * of stil doorgerolde datum in de administratie belanden.
 */
export const isoDate = (s: string | null | undefined) => {
  const v = String(s ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
  const [y, mo, d] = v.split("-").map(Number);
  const dt = new Date(`${v}T00:00:00`);
  if (
    Number.isNaN(dt.getTime()) ||
    dt.getFullYear() !== y ||
    dt.getMonth() + 1 !== mo ||
    dt.getDate() !== d
  ) {
    return "";
  }
  return v;
};

/**
 * Lees een certificaatbestand met AI uit en geef de velden terug (geen DB-write).
 * Gated op een vision-sleutel (GEMINI_API_KEY/ANTHROPIC_API_KEY) en op PDF/afbeelding.
 * De aiAutoExtract-schakelaar wordt hier NIET gecontroleerd — dat doet de aanroeper
 * waar dat relevant is (de certificeringen-hub); de medewerker-upload leest altijd.
 */
export async function readCertificateFile(
  file: FormDataEntryValue | File | null,
): Promise<CertExtractResult> {
  if (!(file instanceof File) || file.size === 0) return { error: "Kies eerst een bestand." };
  if (file.size > MAX_UPLOAD_BYTES) return { error: "Het bestand is te groot." };
  if (!isVisionConfigured()) {
    return {
      error: "Uitlezen is niet ingesteld (zet GEMINI_API_KEY of ANTHROPIC_API_KEY) — vul handmatig in.",
    };
  }

  const type = file.type;
  let mediaType = "";
  if (type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")) {
    mediaType = "application/pdf";
  } else if (/^image\/(png|jpe?g|gif|webp)$/.test(type)) {
    mediaType = type;
  } else {
    return { error: "Automatisch uitlezen kan alleen voor PDF of een afbeelding." };
  }

  try {
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    const res = await aiJSONFromFile<CertExtract>({
      system:
        "Je leest certificaten, diploma's en vakbekwaamheidspassen uit (zoals VCA, NDO/NDT-niveaus, lascertificaten). Geef alleen wat je echt op het document ziet; verzin niets. Datums altijd als YYYY-MM-DD.",
      prompt:
        "Lees dit certificaat uit en geef de naam/soort, het nummer, de uitgevende instantie, de afgiftedatum en de vervaldatum terug. Onbekende velden = null.",
      schema: CERT_EXTRACT_SCHEMA,
      file: { base64, mediaType },
      maxTokens: 800,
      effort: "medium",
    });
    return {
      data: {
        name: (res.name ?? "").trim(),
        number: (res.number ?? "").trim(),
        issuer: (res.issuer ?? "").trim(),
        issuedDate: isoDate(res.issuedDate),
        expiryDate: isoDate(res.expiryDate),
      },
    };
  } catch {
    return { error: "Kon het certificaat niet automatisch uitlezen — vul de velden handmatig in." };
  }
}
