import { estimateCostUsd, USD_TO_EUR } from "./ai-pricing";

// Gated koppeling met de cv@q4s.nl-mailbox. Volgens hetzelfde patroon als de
// overige externe koppelingen (cloud, Ollama): werkt zodra de inloggegevens in
// .env staan, en blijft daarvoor netjes "nog niet gekoppeld". De echte IMAP-pull
// + Gemini-uitlezing wordt in een volgende stap ingeschakeld.
//
//   CV_MAILBOX_HOST=imap.example.nl
//   CV_MAILBOX_USER=cv@q4s.nl
//   CV_MAILBOX_PASSWORD=<app-wachtwoord>
//   CV_MAILBOX_PORT=993            (optioneel)
//   CV_MAILBOX_ADDRESS=cv@q4s.nl   (optioneel, alleen voor weergave)

const GEMINI_SCAN_MODEL = "gemini-2.0-flash";
/** Grove tokenschatting per CV (1-2 pagina's PDF via Gemini Flash). */
export const SCAN_PROMPT_TOKENS_PER_CV = 1500;
export const SCAN_COMPLETION_TOKENS_PER_CV = 500;
export const SCAN_TOKENS_PER_CV = SCAN_PROMPT_TOKENS_PER_CV + SCAN_COMPLETION_TOKENS_PER_CV;

/** Geschatte kosten (EUR) om één CV te scannen met Gemini Flash. */
export function scanCostPerCvEur(): number {
  const usd = estimateCostUsd(
    "gemini",
    GEMINI_SCAN_MODEL,
    SCAN_PROMPT_TOKENS_PER_CV,
    SCAN_COMPLETION_TOKENS_PER_CV,
  );
  return usd * USD_TO_EUR;
}

/** Weergavenaam van de mailbox. */
export function mailboxAddress(): string {
  return process.env.CV_MAILBOX_ADDRESS?.trim() || "cv@q4s.nl";
}

/** Gated: gekoppeld zodra de IMAP-inloggegevens in .env staan. */
export function isMailboxConnected(): boolean {
  return Boolean(
    process.env.CV_MAILBOX_HOST?.trim() &&
      process.env.CV_MAILBOX_USER?.trim() &&
      process.env.CV_MAILBOX_PASSWORD?.trim(),
  );
}

export type ScanResult = {
  ok: boolean;
  connected: boolean;
  reason: string;
  imported: number;
};

/**
 * Scan de cv@q4s.nl-mailbox op CV-bijlagen. Gated: zonder mailbox-koppeling
 * (CV_MAILBOX_* in .env) gebeurt er niets. Zodra gekoppeld wordt hier de
 * IMAP-verbinding geopend, worden e-mails met PDF/Word/Excel-bijlagen opgehaald,
 * per bijlage via Gemini uitgelezen (aiJSONFromFile) en als Candidate (bron
 * EMAIL) opgeslagen — dat deel wordt in de volgende stap ingeschakeld.
 */
export async function scanMailbox(): Promise<ScanResult> {
  if (!isMailboxConnected()) {
    return {
      ok: false,
      connected: false,
      reason: "De mailbox is nog niet gekoppeld — zet de CV_MAILBOX_*-gegevens in je .env.",
      imported: 0,
    };
  }
  // TODO (bij koppeling): IMAP openen → e-mails met bijlagen → Gemini uitlezen →
  // Candidate (source EMAIL) + bestand opslaan → matches zoeken.
  return {
    ok: false,
    connected: true,
    reason: "Mailbox gekoppeld — de IMAP-uitlezing wordt in de volgende stap ingeschakeld.",
    imported: 0,
  };
}
