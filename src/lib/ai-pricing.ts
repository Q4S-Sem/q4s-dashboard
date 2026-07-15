// Ruwe prijsindicatie per AI-model in USD per 1 miljoen tokens [input, output].
// Bewust conservatief/afgerond — bedoeld om een INDICATIE van de kosten te tonen
// in het Tokenverbruik-overzicht, niet als exacte facturatie. Pas aan wanneer
// providers hun tarieven wijzigen.

type Price = { in: number; out: number };

const PRICING: Record<string, Price> = {
  // DeepSeek (zeer goedkoop) — tekst.
  "deepseek-chat": { in: 0.27, out: 1.1 },
  "deepseek-reasoner": { in: 0.55, out: 2.19 },
  // Google Gemini Flash — PDF/beeld + tekst, goedkoop.
  "gemini-2.0-flash": { in: 0.1, out: 0.4 },
  "gemini-1.5-flash": { in: 0.075, out: 0.3 },
  // Anthropic Claude — krachtig, duurder.
  "claude-opus": { in: 15, out: 75 },
  "claude-sonnet": { in: 3, out: 15 },
  "claude-haiku": { in: 1, out: 5 },
};

/** Kies de prijs op basis van een exacte match of een modelfamilie-substring. */
function priceFor(model: string): Price {
  const m = (model || "").toLowerCase();
  if (PRICING[m]) return PRICING[m];
  if (m.includes("opus")) return PRICING["claude-opus"];
  if (m.includes("sonnet")) return PRICING["claude-sonnet"];
  if (m.includes("haiku")) return PRICING["claude-haiku"];
  if (m.includes("reasoner")) return PRICING["deepseek-reasoner"];
  if (m.includes("deepseek")) return PRICING["deepseek-chat"];
  if (m.includes("gemini")) return PRICING["gemini-2.0-flash"];
  // Ollama / lokaal / onbekend → gratis / geen indicatie.
  return { in: 0, out: 0 };
}

/**
 * Geschatte kosten (USD) voor een aanroep. `provider` heeft voorrang: Ollama
 * (lokaal) is altijd gratis, ongeacht de modelnaam — anders zou een lokaal model
 * dat "deepseek"/"gemini" in de naam heeft (bv. deepseek-r1) cloud-prijzen krijgen.
 */
export function estimateCostUsd(
  provider: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
): number {
  if (provider === "ollama") return 0;
  const p = priceFor(model);
  const cost = (promptTokens * p.in + completionTokens * p.out) / 1_000_000;
  return Math.round(cost * 1_000_000) / 1_000_000; // 6 decimalen
}

/** Grove USD→EUR omrekening voor de weergave (indicatief). */
export const USD_TO_EUR = 0.92;
