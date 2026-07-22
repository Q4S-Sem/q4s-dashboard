import mammoth from "mammoth";
import { aiJSON, aiJSONFromFile, isVisionConfigured, readyPersonalDataTextProvider } from "./ai";
import { redactBsn } from "./pii";
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
 * (China) — alleen naar Anthropic of een lokale Ollama (zie readyPersonalDataTextProvider),
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
    // Een CV bevat persoonsgegevens → alleen een AVG-veilige tekst-provider
    // (Anthropic of lokale Ollama), NOOIT DeepSeek (China).
    const provider = readyPersonalDataTextProvider();
    if (!provider) {
      throw new CvExtractError(
        "Om Word-CV's uit te lezen is een Anthropic-sleutel (of een lokale Ollama) nodig. " +
          "DeepSeek wordt hiervoor bewust niet gebruikt, omdat een CV persoonsgegevens bevat " +
          "en buiten de EU zou belanden. Zet een Anthropic-sleutel in de Instellingen-hub, of upload het CV als PDF.",
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
    raw = await aiJSON<unknown>({
      system: CV_EXTRACT_SYSTEM,
      prompt: `${CV_EXTRACT_PROMPT}\n\n--- CV-TEKST ---\n${safe}`,
      schema: CV_PROFILE_AI_SCHEMA,
      schemaName: "cv_profile",
      provider,
      personalData: true,
      maxTokens: 8000,
      effort: "low",
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
