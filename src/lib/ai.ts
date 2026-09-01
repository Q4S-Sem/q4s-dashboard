import Anthropic from "@anthropic-ai/sdk";
import { recordAiUsage, ensureAiKeysLoaded } from "./ai-keys";
import {
  combineRotation,
  downscalePngBase64,
  isPdfMediaType,
  renderPdfFirstPageToPng,
  type PngImage,
  type QuarterTurn,
  type RenderedPng,
} from "./pdf-render";

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

export type AiProvider = "deepseek" | "anthropic" | "ollama" | "hermes";

function pickProvider(value: string | undefined, fallback: AiProvider): AiProvider {
  return value === "ollama" || value === "anthropic" || value === "deepseek" || value === "hermes"
    ? value
    : fallback;
}

// Dynamisch (functie i.p.v. const): pakt een via de Instellingen-hub gekozen
// provider op zodra die in process.env gehydrateerd is (zie ai-keys.ts), zonder
// herstart. Standaard DeepSeek.
export function activeTextProvider(): AiProvider {
  return pickProvider(process.env.AI_PROVIDER, "deepseek");
}
export function activeTextProviderFast(): AiProvider {
  return pickProvider(process.env.AI_PROVIDER_FAST, activeTextProvider());
}

// DeepSeek (OpenAI-compatibele API). Zeer lage kosten per miljoen tokens.
// `deepseek-chat` = algemeen (V3); `deepseek-reasoner` = redeneren (R1).
const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com").replace(
  /\/+$/,
  "",
);
export const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
export const DEEPSEEK_MODEL_FAST = process.env.DEEPSEEK_MODEL_FAST ?? DEEPSEEK_MODEL;

// Nous Hermes — open model via een OpenAI-compatibele chat-completions API.
// Standaard via OpenRouter; wijs HERMES_BASE_URL naar je eigen (EU-)server om
// zelf te hosten. Alleen de API-sleutel staat in Instellingen; endpoint + model
// via env, zodat "OpenRouter nu / self-host later" één env-wijziging is.
function hermesBaseUrl(): string {
  return (process.env.HERMES_BASE_URL ?? "https://openrouter.ai/api/v1").replace(/\/+$/, "");
}
function hermesModel(tier: Tier): string {
  const main = process.env.HERMES_MODEL ?? "nousresearch/hermes-4-70b";
  return tier === "fast" ? process.env.HERMES_MODEL_FAST ?? main : main;
}

// Anthropic models. Defaults: most capable for writing, cheapest for bulk work.
export const AI_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-4-8";
export const AI_MODEL_FAST = process.env.ANTHROPIC_MODEL_FAST ?? "claude-haiku-4-5";

// Ollama (free, local). Run `ollama serve` and pull a model (e.g. `ollama pull llama3.1`).
const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "http://localhost:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3.1";
const OLLAMA_MODEL_FAST = process.env.OLLAMA_MODEL_FAST ?? OLLAMA_MODEL;

// Vision-provider voor het uitlezen van PDF's/afbeeldingen (aiJSONFromFile).
// DeepSeek kan dit niet; Google Gemini Flash wél en is zeer goedkoop + leest
// PDF's én afbeeldingen native. Anthropic (Claude) kan het ook, en OpenRouter
// draait hetzelfde Gemini Flash op je bestaande OpenRouter-tegoed (zelfde sleutel
// als Hermes). Standaard: Gemini als er een GEMINI_API_KEY is, anders Anthropic,
// anders OpenRouter als alleen die sleutel er ligt.
export type VisionProvider = "gemini" | "anthropic" | "openrouter";
function pickVision(value: string | undefined, fallback: VisionProvider): VisionProvider {
  return value === "gemini" || value === "anthropic" || value === "openrouter" ? value : fallback;
}
/**
 * Kies de vision-provider bij ELKE aanroep (niet bevroren bij opstart), zodat een
 * later toegevoegde Gemini-sleutel (via de Instellingen-hub) meteen de PDF/beeld-
 * features activeert zonder herstart. Expliciete AI_VISION_PROVIDER wint; anders
 * Gemini als er een sleutel is, anders Anthropic — en alleen als géén van beide
 * een sleutel heeft maar HERMES_API_KEY wél, OpenRouter.
 */
export function visionProvider(): VisionProvider {
  const fallback: VisionProvider = process.env.GEMINI_API_KEY
    ? "gemini"
    : process.env.ANTHROPIC_API_KEY
      ? "anthropic"
      : process.env.HERMES_API_KEY
        ? "openrouter"
        : "anthropic";
  return pickVision(process.env.AI_VISION_PROVIDER, fallback);
}
const GEMINI_BASE_URL = (
  process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com"
).replace(/\/+$/, "");
// Standaard de zelf-bijwerkende "flash-latest"-alias i.p.v. een gepinde versie:
// Google trekt gepinde flash-versies (2.0, 2.5, …) periodiek in → een pin geeft
// dan plots 404. De alias wijst altijd naar de actuele flash. Overschrijf met
// GEMINI_MODEL als je bewust een vaste versie wilt vastzetten.
export const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

// Vision via OpenRouter: OpenAI-compatibel, dus endpoint + sleutel van Hermes
// (HERMES_BASE_URL/HERMES_API_KEY) worden hergebruikt — alleen het model verschilt.
// Standaard Gemini 2.0 Flash: goedkoop en leest PDF's én afbeeldingen.
export const OPENROUTER_VISION_MODEL =
  process.env.OPENROUTER_VISION_MODEL ?? "google/gemini-2.5-flash";

type Tier = "main" | "fast";

/** A provider is usable if it's Ollama (local/free) or a cloud provider with a key. */
function providerReady(p: AiProvider): boolean {
  if (p === "ollama") return true;
  if (p === "deepseek") return Boolean(process.env.DEEPSEEK_API_KEY);
  if (p === "hermes") return Boolean(process.env.HERMES_API_KEY);
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** True when at least one tier can run, so the UI hints instead of hard-erroring. */
export function isAIConfigured(): boolean {
  return providerReady(activeTextProvider()) || providerReady(activeTextProviderFast());
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
  const main = activeTextProvider();
  if (providerReady(main)) return main;
  const fast = activeTextProviderFast();
  if (providerReady(fast)) return fast;
  if (process.env.DEEPSEEK_API_KEY) return "deepseek";
  if (process.env.HERMES_API_KEY) return "hermes";
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
  // Zelf-gehoste Hermes (eigen EU-server, data verlaat je omgeving niet) mag
  // persoonsgegevens verwerken — expliciet aanzetten met HERMES_PERSONAL_DATA=1.
  // Via OpenRouter (data gaat naar buiten de EU) blijft dit UIT.
  if (p === "hermes") return process.env.HERMES_PERSONAL_DATA === "1";
  return PERSONAL_DATA_PROVIDERS.includes(p);
}

/**
 * Een tekst-provider die persoonsgegevens MAG verwerken (bijv. CV's), of null.
 * Kiest Anthropic; alleen als Ollama expliciet is ingesteld (lokaal draaiend) mag
 * dat ook. Nooit DeepSeek — CV's/NAW gaan zo nooit naar China.
 */
export function readyPersonalDataTextProvider(): AiProvider | null {
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (activeTextProvider() === "ollama" || activeTextProviderFast() === "ollama") return "ollama";
  return null;
}

/** True wanneer PDF's/afbeeldingen uitgelezen kunnen worden (Gemini, Anthropic of
 *  OpenRouter). Los van de tekst-AI: gebruik dit om document-extractie-features te gaten. */
export function isVisionConfigured(): boolean {
  const p = visionProvider();
  if (p === "gemini") return Boolean(process.env.GEMINI_API_KEY);
  if (p === "openrouter") return Boolean(process.env.HERMES_API_KEY);
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Short human label of the active providers (for settings/UI). */
export function aiProviderSummary(): string {
  const label = (p: AiProvider, tier: Tier) => {
    if (p === "ollama") return `Ollama (${tier === "fast" ? OLLAMA_MODEL_FAST : OLLAMA_MODEL})`;
    if (p === "deepseek") return `DeepSeek (${tier === "fast" ? DEEPSEEK_MODEL_FAST : DEEPSEEK_MODEL})`;
    if (p === "hermes") return `Hermes (${hermesModel(tier)})`;
    return `Anthropic (${tier === "fast" ? AI_MODEL_FAST : AI_MODEL})`;
  };
  const main = label(activeTextProvider(), "main");
  const fast = label(activeTextProviderFast(), "fast");
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

/** Nous Hermes via een OpenAI-compatibele chat-completions API (OpenRouter of een
 *  zelf-gehoste server). Spiegelt {@link deepseekChat}; endpoint + model via env. */
async function hermesChat(o: ChatOpts): Promise<string> {
  const key = process.env.HERMES_API_KEY;
  if (!key) {
    throw new Error("Hermes (Nous) is niet geconfigureerd. Zet de Hermes-sleutel in Instellingen of HERMES_API_KEY in je .env.");
  }
  const model = hermesModel(o.tier);
  let system = o.system;
  if (o.json && o.schema) {
    // OpenAI-compatibel JSON afdwingen kan per host/model verschillen; we vragen het
    // schema strak in de system-prompt (Hermes volgt instructies goed) en parseJson
    // tolereert eventueel omringende tekst. Geen provider-specifieke response_format.
    system += `\n\nAntwoord UITSLUITEND met geldige JSON die exact voldoet aan dit JSON-schema (geen tekst eromheen, geen uitleg, geen markdown):\n${JSON.stringify(o.schema)}`;
  }
  const base = hermesBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
        // OpenRouter-attributie (optioneel, schaadt niet bij een eigen server).
        "x-title": "Q4S Dashboard",
      },
      body: JSON.stringify({
        model,
        stream: false,
        temperature: o.json ? 0.3 : 0.6,
        max_tokens: o.maxTokens ?? (o.json ? 8000 : 3000),
        messages: [
          { role: "system", content: system },
          { role: "user", content: o.prompt },
        ],
      }),
    });
  } catch {
    throw new Error(`Hermes niet bereikbaar op ${base}.`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Hermes-fout (${res.status})${body ? `: ${body.slice(0, 200)}` : ""}.`);
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  await recordAiUsage({
    provider: "hermes",
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
  const p = o.provider ?? (o.tier === "fast" ? activeTextProviderFast() : activeTextProvider());
  if (p === "ollama") return ollamaChat(o);
  if (p === "deepseek") return deepseekChat(o);
  if (p === "hermes") return hermesChat(o);
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
  const chosen = opts.provider ?? (opts.fast ? activeTextProviderFast() : activeTextProvider());
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
 * Moet dit bestand eerst zelf naar een scherpe PNG gerasterd worden vóór het naar
 * het vision-model gaat? PDF → ja (de modellen renderen die intern op te lage
 * resolutie en lezen tabelkolommen dan fout); een afbeelding gaat ongewijzigd door.
 * Zet PDF_VISION_RASTER=0 om terug te vallen op het oude gedrag (ruwe PDF sturen).
 * Puur (geen fetch/IO) zodat het te testen is.
 */
export function shouldRasterizePdf(mediaType: string): boolean {
  if (process.env.PDF_VISION_RASTER === "0") return false;
  return isPdfMediaType(mediaType);
}

// --- oriëntatie van een gescande pagina ------------------------------------
//
// De vorm-heuristiek in pdf-render.ts ziet alleen een LIGGENDE pagina. Bij scans
// waarvan de pagina staand is maar de INHOUD dwars staat (bewezen geval: 2481×3507
// staand, tekst gekanteld) helpt die niet — en een dwars gelezen urenstaat levert
// verschoven kolommen op. De enige betrouwbare bron is dan het vision-model zelf:
// één goedkope vraag op een miniatuur ("welke kant staat de tekst op?"), daarna
// opnieuw renderen op de juiste stand en pas dán extraheren.

export const PAGE_ORIENTATIONS = [
  "UPRIGHT",
  "ROTATE_CW_90",
  "ROTATE_CCW_90",
  "UPSIDE_DOWN",
] as const;
export type PageOrientation = (typeof PAGE_ORIENTATIONS)[number];

/**
 * Lees het antwoord van de oriëntatieprobe. Tolerant voor kleine letters, quotes,
 * fences, een JSON-omhulsel of een zinnetje eromheen. **Dubbelzinnig (meerdere
 * codes, bv. omdat het model de keuzelijst herhaalt) of onherkenbaar → null**, en
 * de aanroeper draait dan niets: niets doen is veiliger dan verkeerd draaien.
 * Puur (geen fetch/env) zodat het te testen is.
 */
export function parsePageOrientation(text: string | null | undefined): PageOrientation | null {
  const t = (text ?? "").toUpperCase();
  const found = PAGE_ORIENTATIONS.filter((o) => new RegExp(`\\b${o}\\b`).test(t));
  return found.length === 1 ? found[0] : null;
}

/**
 * Antwoord → graden MET DE KLOK MEE (de richting van `rotationTransform`).
 * Onbekend/UPRIGHT → 0. Puur.
 */
export function orientationRotation(o: PageOrientation | null | undefined): QuarterTurn {
  if (o === "ROTATE_CW_90") return 90;
  if (o === "UPSIDE_DOWN") return 180;
  if (o === "ROTATE_CCW_90") return 270;
  return 0;
}

/** Oriëntatieprobe aan? Zet PDF_VISION_AUTOROTATE=0 om hem uit te schakelen. */
export function pdfAutoRotateEnabled(): boolean {
  return process.env.PDF_VISION_AUTOROTATE !== "0";
}

const ORIENTATION_PROMPT = `Kijk naar de LEESRICHTING VAN DE TEKST op deze gescande pagina (niet naar de vorm van het papier).
Antwoord met exact één code, zonder uitleg of leestekens:
UPRIGHT — de tekst staat rechtop en leest normaal
ROTATE_CW_90 — de tekst leest van onder naar boven; de afbeelding moet een kwartslag MET de klok mee
ROTATE_CCW_90 — de tekst leest van boven naar beneden; de afbeelding moet een kwartslag TEGEN de klok in
UPSIDE_DOWN — de tekst staat op zijn kop; de afbeelding moet 180 graden`;

// Ruim genoeg voor een denkstap van een flash-model plus het ene woord; krap
// genoeg om verwaarloosbaar te zijn naast het (al verkleinde) beeld. Kapt het
// antwoord toch af, dan herkent parsePageOrientation niets → geen draaiing.
const ORIENTATION_MAX_TOKENS = 1000;

/**
 * Vraag de ACTIEVE vision-provider welke kant de tekst op staat. Best effort:
 * geeft null bij een ontbrekende sleutel, netwerkfout of onbruikbaar antwoord.
 * Eén aanroep per document, op een miniatuur (zie ORIENTATION_PROBE_LONG_EDGE).
 */
async function probePageOrientation(image: PngImage): Promise<PageOrientation | null> {
  const p = visionProvider();
  const text =
    p === "gemini"
      ? await geminiOrientation(image)
      : p === "openrouter"
        ? await openrouterOrientation(image)
        : await anthropicOrientation(image);
  return parsePageOrientation(text);
}

async function geminiOrientation(image: PngImage): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Gemini is niet geconfigureerd.");
  const res = await fetch(`${GEMINI_BASE_URL}/v1beta/models/${GEMINI_MODEL}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: image.mediaType, data: image.base64 } },
            { text: ORIENTATION_PROMPT },
          ],
        },
      ],
      generationConfig: { temperature: 0, maxOutputTokens: ORIENTATION_MAX_TOKENS },
    }),
  });
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
    feature: "orientatie-probe",
    promptTokens: data.usageMetadata?.promptTokenCount,
    completionTokens: data.usageMetadata?.candidatesTokenCount,
  });
  return (data.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
}

async function openrouterOrientation(image: PngImage): Promise<string> {
  const key = process.env.HERMES_API_KEY;
  if (!key) throw new Error("OpenRouter is niet geconfigureerd.");
  const base = hermesBaseUrl();
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${key}`,
      "x-title": "Q4S Dashboard",
    },
    body: JSON.stringify({
      model: OPENROUTER_VISION_MODEL,
      stream: false,
      temperature: 0,
      max_tokens: ORIENTATION_MAX_TOKENS,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: ORIENTATION_PROMPT },
            // Altijd een PNG (onze eigen render), dus nooit het PDF-'file'-blok.
            {
              type: "image_url",
              image_url: { url: `data:${image.mediaType};base64,${image.base64}` },
            },
          ],
        },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      openrouterVisionErrorMessage(res.status, body, image.mediaType, OPENROUTER_VISION_MODEL),
    );
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { code?: number; message?: string };
  };
  if (data.error) throw new Error(data.error.message ?? "OpenRouter-fout.");
  await recordAiUsage({
    provider: "hermes",
    model: OPENROUTER_VISION_MODEL,
    kind: "vision",
    feature: "orientatie-probe",
    promptTokens: data.usage?.prompt_tokens,
    completionTokens: data.usage?.completion_tokens,
  });
  return (data.choices?.[0]?.message?.content ?? "").trim();
}

async function anthropicOrientation(image: PngImage): Promise<string> {
  const c = getClient();
  const params = {
    model: AI_MODEL_FAST,
    max_tokens: ORIENTATION_MAX_TOKENS,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: image.mediaType, data: image.base64 },
          },
          { type: "text", text: ORIENTATION_PROMPT },
        ],
      },
    ],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
  const res = await c.messages.create(params);
  const usage = (res as { usage?: { input_tokens?: number; output_tokens?: number } }).usage;
  await recordAiUsage({
    provider: "anthropic",
    model: AI_MODEL_FAST,
    kind: "vision",
    feature: "orientatie-probe",
    promptTokens: usage?.input_tokens,
    completionTokens: usage?.output_tokens,
  });
  return extractText(res.content);
}

/**
 * Zet een gerenderde pagina rechtop volgens de AI-oriëntatieprobe. Best effort:
 * bij een uitgeschakelde probe, een mislukte aanroep of een onbruikbaar antwoord
 * komt de oorspronkelijke render terug. Bij een échte draaiing renderen we de PDF
 * opnieuw op die stand (scherper dan een gedraaide PNG naschalen).
 */
async function uprightRender(bytes: Buffer, png: RenderedPng): Promise<RenderedPng> {
  if (!pdfAutoRotateEnabled()) return png;
  try {
    // Miniatuur: de leesrichting is op ~1000px net zo goed te zien, tegen een
    // fractie van de beeld-tokens van een 300dpi-pagina.
    const thumb = await downscalePngBase64(png.base64);
    const orientation = await probePageOrientation(thumb);
    const extra = orientationRotation(orientation);
    console.info(
      `[vision] oriëntatieprobe (${thumb.width}×${thumb.height}): ${orientation ?? "onbekend"} → ${extra}° bijdraaien (render stond al op ${png.rotation}°).`,
    );
    if (extra === 0) return png;
    const forced = combineRotation(png.extraRotation, extra);
    const rotated = await renderPdfFirstPageToPng(bytes, { forceExtraRotation: forced });
    console.info(
      `[vision] pagina rechtgezet volgens de probe: opnieuw gerenderd op ${rotated.rotation}° → PNG ${rotated.width}×${rotated.height}.`,
    );
    return rotated;
  } catch (e) {
    console.warn(
      `[vision] oriëntatieprobe mislukt (${e instanceof Error ? e.message : String(e)}) — de ongedraaide render gaat naar het model.`,
    );
    return png;
  }
}

/**
 * Vervang een PDF door een hoge-resolutie PNG van de eerste pagina, rechtgezet
 * volgens de oriëntatieprobe. Lukt het rasteren niet, dan gaat het originele
 * bestand alsnog mee (oud gedrag) — nooit crashen op het rasteren zelf.
 */
async function visionFile(file: {
  base64: string;
  mediaType: string;
}): Promise<{ base64: string; mediaType: string }> {
  if (!shouldRasterizePdf(file.mediaType)) return file;
  const bytes = Buffer.from(file.base64, "base64");
  let png: RenderedPng;
  try {
    png = await renderPdfFirstPageToPng(bytes);
  } catch (e) {
    console.warn(
      `[vision] PDF rasteren mislukt (${e instanceof Error ? e.message : String(e)}) — de ruwe PDF gaat naar het model.`,
    );
    return file;
  }
  console.info(
    `[vision] PDF zelf gerasterd naar PNG ${png.width}×${png.height} (pdfjs, rotatie ${png.rotation}°) — scherper dan de interne render van het model.`,
  );
  const upright = await uprightRender(bytes, png);
  return { base64: upright.base64, mediaType: upright.mediaType };
}

/**
 * Extract structured JSON from a DOCUMENT (PDF) or image via de vision-provider
 * ({@link AI_VISION_PROVIDER}): Google Gemini Flash (goedkoop, leest PDF's én
 * afbeeldingen native), Anthropic (Claude) of OpenRouter (zelfde Gemini Flash, maar
 * afgerekend van je OpenRouter-tegoed). DeepSeek/Ollama kunnen dit niet.
 * Zonder vision-sleutel gooit dit; de aanroepers vangen dat op (handmatig invullen).
 * Gebruikt door: timesheet-inbox, declaraties, certificaten en CV-import.
 */
export async function aiJSONFromFile<T>(opts: FileExtractOpts): Promise<T> {
  await ensureAiKeysLoaded(); // serverless: hydrateer sleutels vóór de vision-keuze
  // Nederlandse UI: dwing af dat alle vrije tekst (opmerkingen/notities/samen-
  // vattingen) in het Nederlands terugkomt, ook bij een anderstalig brondocument.
  // Feitelijke waarden (namen/nummers/codes) blijven letterlijk.
  const dutch: FileExtractOpts = {
    ...opts,
    // Gescande PDF eerst zelf naar een scherpe PNG; valt terug op het origineel.
    file: await visionFile(opts.file),
    system: `${opts.system}\n\nTAAL: geef alle vrije tekst (opmerkingen, notities, samenvattingen, toelichtingen) ALTIJD in het NEDERLANDS terug, ook als het brondocument in een andere taal is. Feitelijke waarden (namen, nummers, codes) neem je letterlijk over.`,
  };
  const p = visionProvider();
  if (p === "gemini") return geminiExtractFile<T>(dutch);
  if (p === "openrouter") return openrouterExtractFile<T>(dutch);
  return anthropicExtractFile<T>(dutch);
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

// Niet elk OpenRouter-vision-model slikt elk bestandstype: veel modellen lezen
// alleen afbeeldingen, geen application/pdf. Die afwijzing komt als een 400/404/415
// met "no endpoints found that support…"/"does not support image input"-achtige
// tekst terug — dan wijzen we de gebruiker naar OPENROUTER_VISION_MODEL i.p.v. een
// kale statuscode. Puur (geen env/fetch) zodat het te testen is.
const OPENROUTER_MEDIA_ERROR =
  /unsupported|not support|no endpoints found|unable to (read|process)|modality|image input|file input/i;

export function openrouterVisionErrorMessage(
  status: number,
  body: string,
  mediaType: string,
  model: string,
): string {
  const snippet = body ? `: ${body.slice(0, 200)}` : "";
  if ((status === 400 || status === 404 || status === 415) && OPENROUTER_MEDIA_ERROR.test(body)) {
    const soort = mediaType === "application/pdf" ? "PDF's" : `bestanden van het type ${mediaType}`;
    return `OpenRouter-model '${model}' kan ${soort} niet lezen (${status}). Kies een vision-model dat dit wél ondersteunt via OPENROUTER_VISION_MODEL (bijv. google/gemini-2.5-flash)${snippet}.`;
  }
  return `OpenRouter-fout (${status})${snippet}.`;
}

/**
 * OpenRouter — vision via de OpenAI-compatibele chat-completions API, zodat het
 * scannen van je bestaande OpenRouter-tegoed gaat. Hergebruikt bewust het Hermes-
 * endpoint + dezelfde HERMES_API_KEY (één sleutel voor tekst én beeld); alleen het
 * model staat apart in OPENROUTER_VISION_MODEL. Bestand gaat als data-URL mee in een
 * image_url-blok — ook een PDF (google/gemini-2.0-flash-001 leest die).
 */
async function openrouterExtractFile<T>(opts: FileExtractOpts): Promise<T> {
  const key = process.env.HERMES_API_KEY;
  if (!key) {
    throw new Error(
      "OpenRouter is niet geconfigureerd. Zet de Hermes-sleutel in Instellingen of HERMES_API_KEY in je .env.",
    );
  }
  const system = `${opts.system}\n\nAntwoord UITSLUITEND met geldige JSON die exact voldoet aan dit JSON-schema (geen tekst eromheen, geen uitleg, geen markdown):\n${JSON.stringify(opts.schema)}`;
  const base = hermesBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`,
        // OpenRouter-attributie (optioneel, schaadt niet bij een eigen server).
        "x-title": "Q4S Dashboard",
      },
      body: JSON.stringify({
        model: OPENROUTER_VISION_MODEL,
        stream: false,
        temperature: 0.1,
        max_tokens: opts.maxTokens ?? 4000,
        // Wordt door modellen die het niet kennen genegeerd; parseJson tolereert
        // hoe dan ook fences/omringende tekst.
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: system },
          {
            role: "user",
            content: [
              { type: "text", text: opts.prompt },
              // PDF's gaan via een 'file'-blok (OpenRouter/Gemini leest die zo);
              // afbeeldingen via 'image_url'. Een PDF als image_url geeft 404/geen
              // endpoint bij Gemini-modellen — vandaar het onderscheid.
              opts.file.mediaType === "application/pdf"
                ? {
                    type: "file",
                    file: {
                      filename: "document.pdf",
                      file_data: `data:application/pdf;base64,${opts.file.base64}`,
                    },
                  }
                : {
                    type: "image_url",
                    image_url: { url: `data:${opts.file.mediaType};base64,${opts.file.base64}` },
                  },
            ],
          },
        ],
      }),
    });
  } catch {
    throw new Error(`OpenRouter niet bereikbaar op ${base}.`);
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      openrouterVisionErrorMessage(res.status, body, opts.file.mediaType, OPENROUTER_VISION_MODEL),
    );
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    usage?: { prompt_tokens?: number; completion_tokens?: number };
    error?: { code?: number; message?: string };
  };
  // OpenRouter geeft een geweigerd bestandstype soms als 200 met een error-object.
  if (data.error) {
    throw new Error(
      openrouterVisionErrorMessage(
        data.error.code ?? 400,
        data.error.message ?? "",
        opts.file.mediaType,
        OPENROUTER_VISION_MODEL,
      ),
    );
  }
  await recordAiUsage({
    provider: "hermes",
    model: OPENROUTER_VISION_MODEL,
    kind: "vision",
    promptTokens: data.usage?.prompt_tokens,
    completionTokens: data.usage?.completion_tokens,
  });
  return parseJson<T>((data.choices?.[0]?.message?.content ?? "").trim());
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
