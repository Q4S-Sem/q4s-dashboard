import Anthropic from "@anthropic-ai/sdk";
import { recordAiUsage, ensureAiKeysLoaded } from "./ai-keys";

// ---------------------------------------------------------------------------
// Provider switch: each AI tier can run on DeepSeek (cloud, OpenAI-compatible,
// zeer goedkoop per 1M tokens — de standaard), Anthropic (cloud, paid; nodig
// voor document/vision-extractie) of Ollama (free, local). Set per .env. De
// "main"-tier is kwaliteit-schrijven; de "fast"-tier is hoog-volume werk. Hybride
// mag: bv. AI_PROVIDER=deepseek + AI_PROVIDER_FAST=ollama.
//
// LET OP: alleen tekst gaat via de gekozen provider. Document-/beeld-extractie
// (aiJSONFromFile: CV's, certificaten, timesheets) en agentische web-sourcing
// (aiSourceVacancies) vereisen Anthropic; zonder ANTHROPIC_API_KEY vallen die
// features netjes terug (handmatig invullen resp. lege resultaten).
// ---------------------------------------------------------------------------

export type AiProvider = "deepseek" | "anthropic" | "ollama";

function pickProvider(value: string | undefined, fallback: AiProvider): AiProvider {
  return value === "ollama" || value === "anthropic" || value === "deepseek" ? value : fallback;
}

export const AI_PROVIDER: AiProvider = pickProvider(process.env.AI_PROVIDER, "deepseek");
export const AI_PROVIDER_FAST: AiProvider = pickProvider(
  process.env.AI_PROVIDER_FAST,
  AI_PROVIDER,
);

// DeepSeek (OpenAI-compatibele API). Zeer lage kosten per miljoen tokens.
// `deepseek-chat` = algemeen (V3); `deepseek-reasoner` = redeneren (R1).
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(
  /\/+$/,
  "",
);
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
export const DEEPSEEK_MODEL_FAST = process.env.DEEPSEEK_MODEL_FAST ?? DEEPSEEK_MODEL;

// Anthropic models. Defaults: most capable for writing, cheapest for bulk work.
export const AI_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
export const AI_MODEL_FAST = process.env.ANTHROPIC_MODEL_FAST ?? "claude-haiku-4-5";

// Ollama (free, local). Run `ollama serve` and pull a model (e.g. `ollama pull llama3.1`).
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.1";
const OLLAMA_MODEL_FAST = process.env.OLLAMA_MODEL_FAST ?? OLLAMA_MODEL;

// Vision-provider voor het uitlezen van PDF's/afbeeldingen (aiJSONFromFile).
// DeepSeek kan dit niet; Google Gemini Flash wél en is zeer goedkoop + leest
// PDF's én afbeeldingen native. Anthropic (Claude) kan het ook. Standaard: Gemini
// als er een GEMINI_API_KEY is, anders Anthropic.
export type VisionProvider = "gemini" | "anthropic";
function pickVision(value: string | undefined, fallback: VisionProvider): VisionProvider {
  return value === "gemini" || value === "anthropic" ? value : fallback;
}
/**
 * Kies de vision-provider bij ELKE aanroep (niet bevroren bij opstart), zodat een
 * later toegevoegde Gemini-sleutel (via de Instellingen-hub) meteen de PDF/beeld-
 * features activeert zonder herstart. Expliciete AI_VISION_PROVIDER wint; anders
 * Gemini als er een sleutel is, anders Anthropic.
 */
export function visionProvider(): VisionProvider {
  return pickVision(process.env.AI_VISION_PROVIDER, process.env.GEMINI_API_KEY ? "gemini" : "anthropic");
}
const GEMINI_BASE_URL = (
  process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com"
).replace(/\/+$/, "");
// Standaard de zelf-bijwerkende "flash-latest"-alias i.p.v. een gepinde versie:
// Google trekt gepinde flash-versies (2.0, 2.5, …) periodiek in → een pin geeft
// dan plots 404. De alias wijst altijd naar de actuele flash. Overschrijf met
// GEMINI_MODEL als je bewust een vaste versie wilt vastzetten.
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

type Tier = "main" | "fast";

/** A provider is usable if it's Ollama (local/free) or a cloud provider with a key. */
function providerReady(p: AiProvider): boolean {
  if (p === "ollama") return true;
  if (p === "deepseek") return Boolean(process.env.DEEPSEEK_API_KEY);
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** True when at least one tier can run, so the UI hints instead of hard-erroring. */
export function isAIConfigured(): boolean {
  return providerReady(AI_PROVIDER) || providerReady(AI_PROVIDER_FAST);
}

/**
 * Een tekst-provider die NU kan draaien, of null.
 *
 * Eerst de ingestelde tiers; als die geen sleutel hebben, elke andere provider die
 * er wél een heeft. Nodig omdat AI_PROVIDER standaard op "deepseek" staat: wie
 * alleen een ANTHROPIC_API_KEY heeft, zou anders "niet geconfigureerd" krijgen
 * terwijl er een bruikbare sleutel ligt. Zo blijft de goedkope provider de eerste
 * keus zodra die is ingesteld.
 */
export function readyTextProvider(): AiProvider | null {
  if (providerReady(AI_PROVIDER)) return AI_PROVIDER;
  if (providerReady(AI_PROVIDER_FAST)) return AI_PROVIDER_FAST;
  if (process.env.DEEPSEEK_API_KEY) return "deepseek";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return null;
}

/**
 * Providers die PERSOONSGEGEVENS mogen verwerken. **DeepSeek (China) valt hier
 * bewust buiten**: geen EU-adequaatheidsbesluit, geen verwerkersovereenkomst, en
 * mogelijke training op je data. Anthropic (VS, met DPF + Commercial DPA) en Ollama
 * (lokaal, verlaat je machine niet) zijn wél toegestaan. Zie [[q4s-compliance-nen-avg]].
 */
const PERSONAL_DATA_PROVIDERS: AiProvider[] = ["anthropic", "ollama"];

export function isPersonalDataProvider(p: AiProvider): boolean {
  return PERSONAL_DATA_PROVIDERS.includes(p);
}

/**
 * Een tekst-provider die persoonsgegevens MAG verwerken (bijv. CV's), of null.
 * Kiest Anthropic; alleen als Ollama expliciet is ingesteld (lokaal draaiend) mag
 * dat ook. Nooit DeepSeek — CV's/NAW gaan zo nooit naar China.
 */
export function readyPersonalDataTextProvider(): AiProvider | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (AI_PROVIDER === "ollama" || AI_PROVIDER_FAST === "ollama") return "ollama";
  return null;
}

/** True wanneer PDF's/afbeeldingen uitgelezen kunnen worden (Gemini of Anthropic).
 *  Los van de tekst-AI: gebruik dit om document-extractie-features te gaten. */
export function isVisionConfigured(): boolean {
  return visionProvider() === "gemini"
    ? Boolean(process.env.GEMINI_API_KEY)
    : Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Short human label of the active providers (for settings/UI). */
export function aiProviderSummary(): string {
  const label = (p: AiProvider, tier: Tier) => {
    if (p === "ollama") return `Ollama (${tier === "fast" ? OLLAMA_MODEL_FAST : OLLAMA_MODEL})`;
    if (p === "deepseek") return `DeepSeek (${tier === "fast" ? DEEPSEEK_MODEL_FAST : DEEPSEEK_MODEL})`;
    return `Anthropic (${tier === "fast" ? AI_MODEL_FAST : AI_MODEL})`;
  };
  const main = label(AI_PROVIDER, "main");
  const fast = label(AI_PROVIDER_FAST, "fast");
  return main === fast ? main : `${main} · snel: ${fast}`;
}

let anthropicClient: Anthropic | null = null;
function getClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error(
      "Anthropic is niet geconfigureerd. Zet ANTHROPIC_API_KEY in je .env (of gebruik AI_PROVIDER=ollama).",
    );
  }
  if (!anthropicClient) anthropicClient = new Anthropic();
  return anthropicClient;
}

function extractText(content: unknown): string {
  const blocks = (content as Array<{ type: string; text?: string }>) ?? [];
  return blocks
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("")
    .trim();
}

/** Parse JSON from a model response, tolerating fences / stray prose. */
function parseJson<T>(text: string): T {
  let t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) t = fence[1].trim();
  try {
    return JSON.parse(t) as T;
  } catch {
    const m = t.match(/[[{][\s\S]*[\]}]/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("AI gaf geen geldige JSON terug.");
  }
}

// Adaptive thinking + the `effort` knob exist only on Opus 4.6+/Sonnet 4.6/Fable.
// Cheaper/older models (Haiku 4.5, Sonnet 4.5) reject them with a 400.
function reasoningFor(model: string, effort: "low" | "medium" | "high") {
  const advanced = /(opus-4-[678]|sonnet-4-6|fable-5)/.test(model);
  return {
    thinking: advanced ? { type: "adaptive" } : undefined,
    effort: advanced ? effort : undefined,
  };
}

type ChatOpts = {
  tier: Tier;
  system: string;
  prompt: string;
  json: boolean;
  schema?: Record<string, unknown>;
  schemaName?: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
  /** Negeer de tier-instelling en gebruik deze provider. */
  provider?: AiProvider;
};

async function anthropicChat(o: ChatOpts): Promise<string> {
  const c = getClient();
  const model = o.tier === "fast" ? AI_MODEL_FAST : AI_MODEL;
  const { thinking, effort } = reasoningFor(model, o.effort ?? "medium");
  const outputConfig: Record<string, unknown> = {};
  if (effort) outputConfig.effort = effort;
  if (o.json && o.schema) {
    outputConfig.format = {
      type: "json_schema",
      name: o.schemaName ?? "result",
      schema: o.schema,
    };
  }
  const params = {
    model,
    max_tokens: o.maxTokens ?? (o.json ? 8000 : 4000),
    ...(thinking ? { thinking } : {}),
    ...(Object.keys(outputConfig).length ? { output_config: outputConfig } : {}),
    system: o.system,
    messages: [{ role: "user", content: o.prompt }],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  const res = await c.messages.create(params);
  if (res.stop_reason === "refusal") {
    throw new Error("De AI kon dit verzoek niet verwerken.");
  }
  const usage = (res as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
  await recordAiUsage({
    provider: "anthropic",
    model,
    kind: "text",
    promptTokens: usage?.input_tokens,
    completionTokens: usage?.output_tokens,
  });
  return extractText(res.content);
}

async function ollamaChat(o: ChatOpts): Promise<string> {
  const model = o.tier === "fast" ? OLLAMA_MODEL_FAST : OLLAMA_MODEL;
  let system = o.system;
  if (o.json && o.schema) {
    system += `\n\nAntwoord UITSLUITEND met geldige JSON die exact voldoet aan dit JSON-schema (geen tekst eromheen, geen uitleg):\n${JSON.stringify(o.schema)}`;
  }
  let res: Response;
  try {
    res = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        ...(o.json ? { format: "json" } : {}),
        options: { temperature: 0.4, num_predict: o.maxTokens ?? (o.json ? 2000 : 1500) },
        messages: [
          { role: "system", content: system },
          { role: "user", content: o.prompt },
        ],
      }),
    });
  } catch {
    throw new Error(
      `Ollama niet bereikbaar op ${OLLAMA_BASE_URL}. Draait 'ollama serve'?`,
    );
  }
  if (!res.ok) {
    throw new Error(`Ollama-fout (${res.status}) — controleer model '${model}'.`);
  }
  const data = (await res.json()) as {
    message?: { content?: string };
    prompt_eval_count?: number;
    eval_count?: number;
  };
  await recordAiUsage({
    provider: "ollama",
    model,
    kind: "text",
    promptTokens: data.prompt_eval_count,
    completionTokens: data.eval_count,
  });
  return (data.message?.content ?? "").trim();
}

async function deepseekChat(o: ChatOpts): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) {
    throw new Error("DeepSeek is niet geconfigureerd. Zet DEEPSEEK_API_KEY in je .env.");
  }
  const model = o.tier === "fast" ? DEEPSEEK_MODEL_FAST : DEEPSEEK_MODEL;
  let system = o.system;
  if (o.json && o.schema) {
    // DeepSeek kent JSON-mode (response_format), maar geen strikt JSON-schema —
    // dus geven we het schema mee in de instructie (het woord "JSON" is vereist).
    system += `\n\nAntwoord UITSLUITEND met geldige JSON die exact voldoet aan dit JSON-schema (geen tekst eromheen, geen uitleg, geen markdown):\n${JSON.stringify(o.schema)}`;
  }
  let res: Response;
  try {
    res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: o.json ? 0.3 : 0.6,
        // Ruime default (deepseek-chat kan tot 8192 out) zodat grote gestructureerde
        // outputs (vacature verbeteren, marktkansen) niet afkappen → ongeldige JSON.
        max_tokens: o.maxTokens ?? (o.json ? 8000 : 3000),
        ...(o.json ? { response_format: { type: "json_object" } } : {}),
        messages: [
          { role: "system", content: system },
          { role: "user", content: o.prompt },
        ],
      }),
    });
  } catch {
    throw new Error(`DeepSeek niet bereikbaar op ${DEEPSEEK_BASE_URL}.`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`DeepSeek-fout (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}.`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  await recordAiUsage({
    provider: "deepseek",
    model,
    kind: "text",
    promptTokens: data.usage?.prompt_tokens,
    completionTokens: data.usage?.completion_tokens,
  });
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

/** Dispatch a chat completion to the configured provider for the given tier.
 *  `o.provider` overschrijft die keuze (zie {@link readyTextProvider}). */
async function chat(o: ChatOpts): Promise<string> {
  await ensureAiKeysLoaded(); // serverless: pak een via het dashboard toegevoegde sleutel op
  const p = o.provider ?? (o.tier === "fast" ? AI_PROVIDER_FAST : AI_PROVIDER);
  if (p === "ollama") return ollamaChat(o);
  if (p === "deepseek") return deepseekChat(o);
  return anthropicChat(o);
}

type GenOpts = {
  system: string;
  prompt: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
};

/** Generate free-form text (main tier). */
export async function aiText(opts: GenOpts): Promise<string> {
  return chat({
    tier: "main",
    system: opts.system,
    prompt: opts.prompt,
    json: false,
    maxTokens: opts.maxTokens,
    effort: opts.effort,
  });
}

/**
 * Generate JSON conforming to a JSON Schema. On Anthropic this uses structured
 * output; on Ollama it uses JSON mode + the schema in the prompt. Schema objects
 * must use additionalProperties:false and avoid min/max/length constraints.
 */
export async function aiJSON<T>(opts: {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  schemaName?: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
  /** Use the fast tier — for high-volume, simple classification. */
  fast?: boolean;
  /** Dwing een provider af i.p.v. de tier-instelling (zie readyTextProvider). */
  provider?: AiProvider;
  /** Bevat deze prompt persoonsgegevens? Zo ja: harde blokkade op providers buiten
   *  {@link PERSONAL_DATA_PROVIDERS} (nooit DeepSeek/China). */
  personalData?: boolean;
}): Promise<T> {
  const chosen = opts.provider ?? (opts.fast ? AI_PROVIDER_FAST : AI_PROVIDER);
  if (opts.personalData && !isPersonalDataProvider(chosen)) {
    throw new Error(
      `Persoonsgegevens mogen niet naar '${chosen}' verstuurd worden (buiten de EU/zonder verwerkersovereenkomst). Gebruik Anthropic of een lokale Ollama.`,
    );
  }
  const text = await chat({
    tier: opts.fast ? "fast" : "main",
    provider: opts.provider,
    system: opts.system,
    prompt: opts.prompt,
    json: true,
    schema: opts.schema,
    schemaName: opts.schemaName,
    maxTokens: opts.maxTokens,
    effort: opts.effort,
  });
  return parseJson<T>(text);
}

type FileExtractOpts = {
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  file: { base64: string; mediaType: string };
  schemaName?: string;
  maxTokens?: number;
  effort?: "low" | "medium" | "high";
};

/**
 * Extract structured JSON from a DOCUMENT (PDF) or image via de vision-provider
 * ({@link AI_VISION_PROVIDER}): Google Gemini Flash (goedkoop, leest PDF's én
 * afbeeldingen native) of Anthropic (Claude). DeepSeek/Ollama kunnen dit niet.
 * Zonder vision-sleutel gooit dit; de aanroepers vangen dat op (handmatig invullen).
 * Gebruikt door: timesheet-inbox, declaraties, certificaten en CV-import.
 */
export async function aiJSONFromFile<T>(opts: FileExtractOpts): Promise<T> {
  await ensureAiKeysLoaded(); // serverless: hydrateer sleutels vóór de vision-keuze
  if (visionProvider() === "gemini") return geminiExtractFile<T>(opts);
  return anthropicExtractFile<T>(opts);
}

/** Gemini (Google) — leest PDF's + afbeeldingen native, zeer goedkoop. */
async function geminiExtractFile<T>(opts: FileExtractOpts): Promise<T> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("Gemini is niet geconfigureerd. Zet GEMINI_API_KEY in je .env.");
  }
  const system = `${opts.system}\n\nAntwoord UITSLUITEND met geldige JSON die exact voldoet aan dit JSON-schema (geen tekst eromheen, geen uitleg, geen markdown):\n${JSON.stringify(opts.schema)}`;
  let res: Response;
  try {
    res = await fetch(`${GEMINI_BASE_URL}/v1beta/models/${GEMINI_MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [
          {
            role: "user",
            parts: [
              { inline_data: { mime_type: opts.file.mediaType, data: opts.file.base64 } },
              { text: opts.prompt },
            ],
          },
        ],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: opts.maxTokens ?? 4000,
          responseMimeType: "application/json",
        },
      }),
    });
  } catch {
    throw new Error(`Gemini niet bereikbaar op ${GEMINI_BASE_URL}.`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini-fout (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}.`);
  }
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
    usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  };
  await recordAiUsage({
    provider: "gemini",
    model: GEMINI_MODEL,
    kind: "vision",
    promptTokens: data.usageMetadata?.promptTokenCount,
    completionTokens: data.usageMetadata?.candidatesTokenCount,
  });
  const text = (data.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  return parseJson<T>(text);
}

/** Anthropic (Claude) — PDF via document-block, afbeeldingen via image-block. */
async function anthropicExtractFile<T>(opts: FileExtractOpts): Promise<T> {
  const c = getClient();
  const isPdf = opts.file.mediaType === "application/pdf";
  const fileBlock = isPdf
    ? {
        type: "document",
        source: { type: "base64", media_type: "application/pdf", data: opts.file.base64 },
      }
    : {
        type: "image",
        source: { type: "base64", media_type: opts.file.mediaType, data: opts.file.base64 },
      };
  const params = {
    model: AI_MODEL_FAST,
    max_tokens: opts.maxTokens ?? 4000,
    output_config: {
      format: {
        type: "json_schema",
        name: opts.schemaName ?? "result",
        schema: opts.schema,
      },
    },
    system: opts.system,
    messages: [
      { role: "user", content: [fileBlock, { type: "text", text: opts.prompt }] },
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  const res = await c.messages.create(params);
  if (res.stop_reason === "refusal") {
    throw new Error("De AI kon dit document niet verwerken.");
  }
  const usage = (res as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
  await recordAiUsage({
    provider: "anthropic",
    model: AI_MODEL_FAST,
    kind: "vision",
    promptTokens: usage?.input_tokens,
    completionTokens: usage?.output_tokens,
  });
  return parseJson<T>(extractText(res.content));
}

export type SourcedVacancy = {
  title: string;
  company?: string;
  location?: string;
  discipline?: string;
  url?: string;
  summary?: string;
};

/**
 * AGENTIC web-search sourcing: let Claude search the open web for recently
 * posted, niche-relevant vacancies. Requires Anthropic + web search on the
 * account. Best-effort — returns [] on any failure. Auth-gated VMS portals need
 * a real per-platform API connection.
 */
export async function aiSourceVacancies(opts: {
  fields: string[];
  max?: number;
}): Promise<SourcedVacancy[]> {
  await ensureAiKeysLoaded();
  if (!process.env.ANTHROPIC_API_KEY) return [];
  const c = getClient();
  const max = opts.max ?? 8;
  const system = `Je bent een sourcing-agent voor Q4S, een Nederlands technisch detacheringsbureau. Zoek met de web-search tool naar RECENTE, openbaar geplaatste vacatures in Nederland binnen deze vakgebieden:
${opts.fields.map((f) => `- ${f}`).join("\n")}

Geef daarna UITSLUITEND een geldige JSON-array terug (geen tekst eromheen) met maximaal ${max} vacatures, elk een object met de velden: title, company, location, discipline, url, summary. Laat een veld leeg ("") als onbekend. Verzin geen vacatures; neem alleen echte, gevonden vacatures op.`;
  const params = {
    model: AI_MODEL,
    max_tokens: 4000,
    tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 5 }],
    system,
    messages: [
      {
        role: "user",
        content:
          "Zoek nu naar recente, relevante vacatures en geef de JSON-array terug.",
      },
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  try {
    const res = await c.messages.create(params);
    const usage = (res as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
    await recordAiUsage({
      provider: "anthropic",
      model: AI_MODEL,
      kind: "web",
      promptTokens: usage?.input_tokens,
      completionTokens: usage?.output_tokens,
    });
    const text = extractText(res.content);
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) return [];
    const arr = JSON.parse(match[0]);
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x) => x && typeof x.title === "string" && x.title.trim())
      .slice(0, max) as SourcedVacancy[];
  } catch {
    return [];
  }
}
