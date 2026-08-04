import { db } from "./db";
import { estimateCostUsd } from "./ai-pricing";

// Beheer van AI-API-sleutels vanuit de Instellingen-hub + registratie van
// tokenverbruik. Sleutels staan in de DB (model AiKey) en worden bij het
// opstarten in process.env geladen (src/instrumentation.ts) zodat de bestaande
// env-gebaseerde checks (isAIConfigured/isVisionConfigured) en ai.ts ongewijzigd
// blijven werken. Een sleutel in .env heeft voorrang; anders wint de DB-waarde.

export type AiProviderKey = "deepseek" | "gemini" | "anthropic" | "hermes";

export const AI_KEY_ENV: Record<AiProviderKey, string> = {
  deepseek: "DEEPSEEK_API_KEY",
  gemini: "GEMINI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  hermes: "HERMES_API_KEY",
};

// Pristine .env-sleutels, vastgelegd bij het laden van de module — dus vóór
// loadAiKeysIntoEnv() DB-waarden in process.env kopieert. Hiermee weten we of een
// sleutel écht uit .env komt (die heeft voorrang) en voorkomen we dat een
// dashboard-actie een .env-sleutel uit het draaiende proces wist.
const BOOT_ENV: Record<AiProviderKey, string | undefined> = {
  deepseek: process.env.DEEPSEEK_API_KEY?.trim() || undefined,
  gemini: process.env.GEMINI_API_KEY?.trim() || undefined,
  anthropic: process.env.ANTHROPIC_API_KEY?.trim() || undefined,
  hermes: process.env.HERMES_API_KEY?.trim() || undefined,
};

export const AI_KEY_META: { provider: AiProviderKey; label: string; hint: string; help: string }[] = [
  {
    provider: "deepseek",
    label: "DeepSeek",
    hint: "Tekst-AI (standaard, zeer goedkoop)",
    help: "Gebruikt voor alle tekst: vacatures verbeteren, matching, CRM-inzichten, marktkansen.",
  },
  {
    provider: "gemini",
    label: "Google Gemini",
    hint: "PDF- & beeld-AI (documenten lezen)",
    help: "Leest PDF's/afbeeldingen: CV-import, timesheets, certificaten en bonnetjes uitlezen.",
  },
  {
    provider: "anthropic",
    label: "Anthropic Claude",
    hint: "Optioneel — krachtig, duurder",
    help: "Alternatief voor tekst/documenten en nodig voor agentische web-sourcing.",
  },
  {
    provider: "hermes",
    label: "Nous Hermes",
    hint: "Tekst/agent-AI — open model (OpenRouter of eigen server)",
    help: "Open model voor tekst- en agent-taken (sourcing, matching, teksten, mail-triage). Standaard via OpenRouter; endpoint en model stel je in met HERMES_BASE_URL / HERMES_MODEL. Activeren als hoofd-tekst-AI: zet AI_PROVIDER=hermes.",
  },
];

const PROVIDERS: AiProviderKey[] = ["deepseek", "gemini", "anthropic", "hermes"];

function isProvider(v: string): v is AiProviderKey {
  return (PROVIDERS as string[]).includes(v);
}

/**
 * Laad DB-sleutels in process.env — aangeroepen bij het opstarten. Een bestaande
 * .env-waarde blijft staan (die wint); alleen ontbrekende worden aangevuld.
 */
export async function loadAiKeysIntoEnv(): Promise<void> {
  const keys = await db.aiKey.findMany();
  for (const k of keys) {
    if (!isProvider(k.provider) || !k.apiKey) continue;
    const varName = AI_KEY_ENV[k.provider];
    if (!process.env[varName]) process.env[varName] = k.apiKey;
  }
}

// Serverless-vangnet: loadAiKeysIntoEnv() draait bij cold start (instrumentation),
// maar een sleutel die LATER via het dashboard wordt toegevoegd zit nog niet in de
// env van een reeds-warme instance. Deze helper herlaadt de DB-sleutels lui (met
// een korte cache), zodat AI-aanroepen een net-toegevoegde sleutel oppikken zonder
// serverherstart. Wordt vooraan de AI-entrypoints (ai.ts) aangeroepen.
let lastKeyLoad = 0;
export async function ensureAiKeysLoaded(): Promise<void> {
  const now = Date.now();
  if (now - lastKeyLoad < 60_000) return;
  lastKeyLoad = now;
  try {
    await loadAiKeysIntoEnv();
  } catch {
    // DB even niet bereikbaar → laat de bestaande env-waarden staan.
  }
}

export type KeyStatus = {
  provider: AiProviderKey;
  label: string;
  hint: string;
  help: string;
  configured: boolean;
  source: "env" | "dashboard" | null;
  masked: string;
};

function mask(key: string): string {
  const k = key.trim();
  if (k.length <= 8) return "••••••";
  return `${k.slice(0, 4)}••••••${k.slice(-4)}`;
}

/** Status per provider voor de API-sleutels-pagina (nooit de volledige sleutel). */
export async function getKeyStatuses(): Promise<KeyStatus[]> {
  const rows = await db.aiKey.findMany();
  const dbKeyByProvider = new Map(rows.map((r) => [r.provider, r.apiKey?.trim() || null]));

  return AI_KEY_META.map(({ provider, label, hint, help }) => {
    const envVar = AI_KEY_ENV[provider];
    const envVal = process.env[envVar]?.trim() || null;
    const dbKey = dbKeyByProvider.get(provider) ?? null;
    // Effectieve sleutel = env, of anders de dashboard-sleutel uit de DB. Zo toont de
    // status consistent "Ingesteld" — ook op een serverless-instance waar de sleutel
    // nog niet in env geladen is (anders zei de kaart "Ingesteld" maar de test niet).
    const effective = envVal || dbKey;
    // .env heeft altijd voorrang: is er een pristine .env-waarde, dan is de bron
    // "env" (nooit "dashboard"), zodat er geen destructieve wis-knop verschijnt.
    const source: KeyStatus["source"] = BOOT_ENV[provider]
      ? "env"
      : dbKey
        ? "dashboard"
        : envVal
          ? "env"
          : null;
    return {
      provider,
      label,
      hint,
      help,
      configured: Boolean(effective),
      source,
      masked: effective ? mask(effective) : "",
    };
  });
}

/** Sla een sleutel op (of wis 'm bij lege waarde) + zet 'm meteen live in env. */
export async function setAiKey(provider: string, key: string | null): Promise<void> {
  if (!isProvider(provider)) return;
  const trimmed = key?.trim() || null;
  await db.aiKey.upsert({
    where: { provider },
    create: { provider, apiKey: trimmed },
    update: { apiKey: trimmed },
  });
  const varName = AI_KEY_ENV[provider];
  if (trimmed) {
    process.env[varName] = trimmed;
  } else if (BOOT_ENV[provider]) {
    // Wissen mag NOOIT een echte .env-sleutel uit het proces verwijderen —
    // herstel de oorspronkelijke .env-waarde (die had toch al voorrang).
    process.env[varName] = BOOT_ENV[provider];
  } else {
    delete process.env[varName];
  }
}

// ---------------------------------------------------------------------------
// Tokenverbruik
// ---------------------------------------------------------------------------

/** Leg één AI-aanroep vast. Mag NOOIT gooien — logging faalt stil zodat een
 *  AI-feature nooit breekt door de boekhouding. */
export async function recordAiUsage(u: {
  provider: string;
  model: string;
  kind?: "text" | "vision" | "web";
  feature?: string | null;
  promptTokens?: number;
  completionTokens?: number;
}): Promise<void> {
  try {
    const promptTokens = Math.max(0, Math.round(u.promptTokens ?? 0));
    const completionTokens = Math.max(0, Math.round(u.completionTokens ?? 0));
    await db.aiUsage.create({
      data: {
        provider: u.provider,
        model: u.model,
        kind: u.kind ?? "text",
        feature: u.feature ?? null,
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
        estCostUsd: estimateCostUsd(u.provider, u.model, promptTokens, completionTokens),
      },
    });
  } catch {
    // stil falen — verbruikslogging mag een AI-aanroep nooit laten mislukken
  }
}

export type UsageOverview = {
  totalTokens: number;
  totalCostUsd: number;
  totalCalls: number;
  byProvider: { provider: string; tokens: number; costUsd: number; calls: number }[];
  perDay: { date: string; tokens: number; costUsd: number }[];
  recent: {
    id: string;
    provider: string;
    model: string;
    kind: string;
    feature: string | null;
    totalTokens: number;
    estCostUsd: number;
    createdAt: Date;
  }[];
};

function dayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Aggregatie voor de Tokenverbruik-pagina. */
export async function aiUsageOverview(): Promise<UsageOverview> {
  const rows = await db.aiUsage.findMany({ orderBy: { createdAt: "desc" } });

  let totalTokens = 0;
  let totalCostUsd = 0;
  const byProv = new Map<string, { tokens: number; costUsd: number; calls: number }>();
  const byDay = new Map<string, { tokens: number; costUsd: number }>();

  for (const r of rows) {
    totalTokens += r.totalTokens;
    totalCostUsd += r.estCostUsd;
    const p = byProv.get(r.provider) ?? { tokens: 0, costUsd: 0, calls: 0 };
    p.tokens += r.totalTokens;
    p.costUsd += r.estCostUsd;
    p.calls += 1;
    byProv.set(r.provider, p);
    const dk = dayKey(new Date(r.createdAt));
    const d = byDay.get(dk) ?? { tokens: 0, costUsd: 0 };
    d.tokens += r.totalTokens;
    d.costUsd += r.estCostUsd;
    byDay.set(dk, d);
  }

  return {
    totalTokens,
    totalCostUsd,
    totalCalls: rows.length,
    byProvider: [...byProv.entries()]
      .map(([provider, v]) => ({ provider, ...v }))
      .sort((a, b) => b.costUsd - a.costUsd),
    perDay: [...byDay.entries()]
      .map(([date, v]) => ({ date, ...v }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-30),
    recent: rows.slice(0, 25).map((r) => ({
      id: r.id,
      provider: r.provider,
      model: r.model,
      kind: r.kind,
      feature: r.feature,
      totalTokens: r.totalTokens,
      estCostUsd: r.estCostUsd,
      createdAt: r.createdAt,
    })),
  };
}
