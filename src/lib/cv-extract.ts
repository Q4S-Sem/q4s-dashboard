import mammoth from "mammoth";
import { z } from "zod";
import {
  aiJSON,
  aiJSONFromFile,
  geminiJSONText,
  openrouterJSONText,
  isVisionConfigured,
  readyCvTextRoute,
} from "./ai";
import { redactBsn } from "./pii";
import { DISCIPLINES } from "./domain";
import {
  CV_EXTRACT_PROMPT,
  CV_EXTRACT_SYSTEM,
  CV_PROFILE_AI_SCHEMA,
  cvProfileDataSchema,
  type CvProfileData,
} from "./cv-profile";

/**
 * Lees een bestaand CV (PDF, Word of een scan) uit tot een volledig profiel.
 *
 * Twee routes, want geen enkele provider leest .docx native:
 *  - PDF/afbeelding → rechtstreeks naar de vision-provider (Gemini/Anthropic),
 *    die de opmaak ziet (kolommen, tabellen) en dus beter leest dan platte tekst.
 *  - Word (.docx)   → eerst lokaal naar tekst via mammoth, dan naar de tekst-AI.
 *
 * AVG: een CV is een persoonsgegeven. De tekst-route gaat daarom NOOIT naar DeepSeek
 * (China) — alleen naar Anthropic, een lokale Ollama, of Gemini (zie readyCvTextRoute),
 * en een eventueel BSN wordt eruit gestript vóór verzending. Zie [[q4s-compliance-nen-avg]].
 *
 * Let op het verschil met de bestaande CV-import (website/actions.ts), die alleen
 * 6 contactvelden pakt en Word overslaat. Dit haalt de hele inhoud op.
 */

/** Ruwe tekst uit een .docx. Leeg → het document bevatte geen leesbare tekst. */
async function docxToText(bytes: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer: bytes });
  return value.replace(/\n{3,}/g, "\n\n").trim();
}

/**
 * Word (.docx) → AVG-veilig JSON. Leest het document lokaal naar tekst, stript een
 * eventueel BSN en stuurt het naar een toegestane route: Anthropic, lokale Ollama,
 * of Gemini (Google — verwerkt hier al PII-PDF-CV's, dus onder dezelfde grondslag).
 * NOOIT DeepSeek. Gooit {@link CvExtractError} met leesbare NL-tekst als er geen
 * route beschikbaar is of het document geen leesbare tekst bevat.
 */
async function extractFromDocx<T>(
  bytes: Buffer,
  ai: { system: string; prompt: string; schema: Record<string, unknown>; schemaName: string; maxTokens: number },
): Promise<T> {
  const route = readyCvTextRoute();
  if (!route) {
    throw new CvExtractError(
      "Om Word-CV's uit te lezen is een OpenRouter-, Gemini-, Anthropic- of lokale Ollama-sleutel nodig. " +
        "DeepSeek wordt hiervoor bewust niet gebruikt (een CV bevat persoonsgegevens). " +
        "Zet een sleutel in de Instellingen-hub, of upload het CV als PDF.",
    );
  }
  let plain: string;
  try {
    plain = await docxToText(bytes);
  } catch {
    throw new CvExtractError(
      "Dit Word-bestand kon niet gelezen worden. Sla het opnieuw op als .docx of PDF.",
    );
  }
  if (plain.length < 40) {
    throw new CvExtractError(
      "Dit Word-bestand bevat nauwelijks tekst — staat het CV er als afbeelding in? Sla het dan op als PDF.",
    );
  }
  // Dataminimalisatie: een eventueel BSN mag niet mee naar de AI-provider.
  const safe = redactBsn(plain.slice(0, 60_000));
  const prompt = `${ai.prompt}\n\n--- CV-TEKST ---\n${safe}`;

  if (route === "gemini") {
    return geminiJSONText<T>({
      system: ai.system,
      prompt,
      schema: ai.schema,
      maxTokens: ai.maxTokens,
    });
  }
  if (route === "openrouter") {
    return openrouterJSONText<T>({
      system: ai.system,
      prompt,
      schema: ai.schema,
      maxTokens: ai.maxTokens,
    });
  }
  // Anthropic of lokale Ollama — via de bestaande tekst-route met PII-blokkade.
  return aiJSON<T>({
    system: ai.system,
    prompt,
    schema: ai.schema,
    schemaName: ai.schemaName,
    provider: route,
    personalData: true,
    maxTokens: ai.maxTokens,
    effort: "low",
  });
}

export type CvSourceKind = "pdf" | "image" | "docx";

/** Bepaal hoe we dit bestand moeten lezen; null = niet ondersteund. */
export function cvSourceKind(fileName: string, mimeType: string): CvSourceKind | null {
  const name = fileName.toLowerCase();
  const type = (mimeType || "").toLowerCase();
  if (type.includes("pdf") || name.endsWith(".pdf")) return "pdf";
  if (name.endsWith(".docx") || type.includes("officedocument.wordprocessingml")) return "docx";
  if (/^image\/(png|jpe?g|gif|webp)$/.test(type)) return "image";
  if (/\.(png|jpe?g|gif|webp)$/.test(name)) return "image";
  return null;
}

/** Foutmelding voor de recruiter — geen stacktrace, wel een uitweg. */
export class CvExtractError extends Error {}

/**
 * Bestand → profiel. Gooit een {@link CvExtractError} met een leesbare NL-tekst
 * als het bestandstype niet kan of de AI niet geconfigureerd is; de aanroeper
 * toont die letterlijk in het formulier.
 */
export async function extractCvProfile(
  bytes: Buffer,
  fileName: string,
  mimeType: string,
): Promise<CvProfileData> {
  const kind = cvSourceKind(fileName, mimeType);

  if (!kind) {
    const isOldWord = /\.(doc|rtf|odt)$/i.test(fileName);
    throw new CvExtractError(
      isOldWord
        ? "Dit is een oud Word-formaat (.doc). Open het in Word en sla het op als .docx of PDF — dan kan de generator het lezen."
        : "Alleen PDF, Word (.docx) of een afbeelding van een CV kunnen uitgelezen worden.",
    );
  }

  let raw: unknown;

  if (kind === "docx") {
    raw = await extractFromDocx<unknown>(bytes, {
      system: CV_EXTRACT_SYSTEM,
      prompt: CV_EXTRACT_PROMPT,
      schema: CV_PROFILE_AI_SCHEMA,
      schemaName: "cv_profile",
      maxTokens: 8000,
    });
  } else {
    if (!isVisionConfigured()) {
      throw new CvExtractError(
        "Om PDF's te lezen is een Gemini- of Anthropic-sleutel nodig. Zet die in de Instellingen-hub, " +
          "of upload het CV als Word (.docx).",
      );
    }
    raw = await aiJSONFromFile<unknown>({
      system: CV_EXTRACT_SYSTEM,
      prompt: CV_EXTRACT_PROMPT,
      schema: CV_PROFILE_AI_SCHEMA,
      schemaName: "cv_profile",
      file: {
        base64: bytes.toString("base64"),
        mediaType: kind === "pdf" ? "application/pdf" : mimeType || "image/jpeg",
      },
      maxTokens: 8000,
      effort: "low",
    });
  }

  // De AI-uitvoer is niet te vertrouwen op vorm (DeepSeek/Ollama krijgen het
  // schema alleen als prompt-tekst mee, niet als harde constraint) — vandaar Zod.
  const parsed = cvProfileDataSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CvExtractError(
      "De AI gaf een onverwacht antwoord op dit CV. Probeer het opnieuw, of vul het profiel handmatig in.",
    );
  }
  return parsed.data;
}

// ---------------------------------------------------------------------------
// KANDIDAAT-VELDEN uit een CV (voor de talentpool "Nieuwe kandidaat"-flow).
//
// De brede extractCvProfile() hierboven levert het CV-opmaakprofiel (voor het
// klant-CV), maar mist juist de talentpool-contactvelden (voornaam/achternaam
// gesplitst, e-mail, telefoon, discipline). Deze functie haalt precies die velden
// op, zodat het "Nieuwe kandidaat"-formulier zich automatisch invult.
// ---------------------------------------------------------------------------

const DISCIPLINE_VALUES = DISCIPLINES.map((d) => d.value);

export const candidateFieldsSchema = z.object({
  firstName: z.string().nullish().transform((v) => v?.trim() || null),
  lastName: z.string().nullish().transform((v) => v?.trim() || null),
  email: z.string().nullish().transform((v) => v?.trim() || null),
  phone: z.string().nullish().transform((v) => v?.trim() || null),
  discipline: z
    .string()
    .nullish()
    .transform((v) => (v && DISCIPLINE_VALUES.includes(v) ? v : null)),
  headline: z.string().nullish().transform((v) => v?.trim() || null),
  location: z.string().nullish().transform((v) => v?.trim() || null),
  linkedinUrl: z.string().nullish().transform((v) => v?.trim() || null),
});

export type CandidateFields = z.infer<typeof candidateFieldsSchema>;

const CANDIDATE_AI_SCHEMA: Record<string, unknown> = {
  type: "object",
  properties: {
    firstName: { type: ["string", "null"] },
    lastName: { type: ["string", "null"] },
    email: { type: ["string", "null"] },
    phone: { type: ["string", "null"] },
    discipline: { type: ["string", "null"] },
    headline: { type: ["string", "null"] },
    location: { type: ["string", "null"] },
    linkedinUrl: { type: ["string", "null"] },
  },
  required: ["firstName", "lastName", "email", "phone", "discipline", "headline", "location", "linkedinUrl"],
  additionalProperties: false,
};

const CANDIDATE_SYSTEM =
  "Je haalt contactgegevens en het vakgebied van één persoon uit een CV, voor een " +
  "recruitmentdatabase in de staalbouw/inspectie. Antwoord uitsluitend met de gevraagde velden. " +
  "Verzin niets: staat een veld niet in het CV, geef dan null.";

const CANDIDATE_PROMPT =
  "Haal deze velden uit het CV:\n" +
  "- firstName: alleen de voornaam.\n" +
  "- lastName: de achternaam (incl. tussenvoegsel zoals 'van der').\n" +
  "- email: e-mailadres.\n" +
  "- phone: telefoonnummer zoals vermeld.\n" +
  "- location: woonplaats/regio.\n" +
  "- headline: korte functietitel (bijv. 'QA/QC Inspector' of '6G TIG-lasser'); leid af uit de meest recente functie als hij er niet staat.\n" +
  "- linkedinUrl: LinkedIn-profiel-URL indien vermeld.\n" +
  `- discipline: kies EXACT één van deze codes als het past, anders null: ${DISCIPLINES.map((d) => `${d.value} (${d.label})`).join(", ")}.`;

/**
 * Bestand → talentpool-kandidaatvelden. Zelfde AVG-regels en bestandsroutes als
 * {@link extractCvProfile}: PDF/afbeelding via vision, Word via lokale tekst +
 * AVG-veilige tekst-AI (nooit DeepSeek), BSN gestript. Gooit {@link CvExtractError}
 * met leesbare NL-tekst bij een niet-ondersteund bestand of ontbrekende AI-config.
 */
export async function extractCandidateFields(
  bytes: Buffer,
  fileName: string,
  mimeType: string,
): Promise<CandidateFields> {
  const kind = cvSourceKind(fileName, mimeType);
  if (!kind) {
    const isOldWord = /\.(doc|rtf|odt)$/i.test(fileName);
    throw new CvExtractError(
      isOldWord
        ? "Dit is een oud Word-formaat (.doc). Open het in Word en sla het op als .docx of PDF."
        : "Alleen PDF, Word (.docx) of een afbeelding van een CV kunnen uitgelezen worden.",
    );
  }

  let raw: unknown;

  if (kind === "docx") {
    raw = await extractFromDocx<unknown>(bytes, {
      system: CANDIDATE_SYSTEM,
      prompt: CANDIDATE_PROMPT,
      schema: CANDIDATE_AI_SCHEMA,
      schemaName: "candidate_fields",
      maxTokens: 1500,
    });
  } else {
    if (!isVisionConfigured()) {
      throw new CvExtractError(
        "Om PDF's te lezen is een Gemini- of Anthropic-sleutel nodig. Zet die in de Instellingen-hub, " +
          "of upload het CV als Word (.docx).",
      );
    }
    raw = await aiJSONFromFile<unknown>({
      system: CANDIDATE_SYSTEM,
      prompt: CANDIDATE_PROMPT,
      schema: CANDIDATE_AI_SCHEMA,
      schemaName: "candidate_fields",
      file: {
        base64: bytes.toString("base64"),
        mediaType: kind === "pdf" ? "application/pdf" : mimeType || "image/jpeg",
      },
      maxTokens: 1500,
      effort: "low",
    });
  }

  const parsed = candidateFieldsSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CvExtractError(
      "De AI gaf een onverwacht antwoord op dit CV. Probeer het opnieuw, of vul de velden handmatig in.",
    );
  }
  return parsed.data;
}
