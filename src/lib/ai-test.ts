import type { AiProviderKey } from "./ai-keys";

// ---------------------------------------------------------------------------
// Live verbindingstest per AI-provider. Doet één minimale, echte API-aanroep met
// de nu-ingestelde sleutel (uit process.env — dus ook DB-sleutels die bij het
// opstarten geladen zijn) en meldt of de provider antwoordt. Puur diagnostisch:
// géén verbruiksregistratie, geen persoonsgegevens, minimale tokens. Zo kun je
// vanuit de Instellingen-hub bevestigen dat "de koppeling" écht werkt i.p.v. te
// moeten wachten tot een feature toevallig faalt.
// ---------------------------------------------------------------------------

export type ConnTest = { ok: boolean; provider: AiProviderKey; message: string };

// 1×1 transparante PNG — laat de Gemini-test dezelfde multimodale route (inline
// beeld + tekst) raken als de echte document-extractie (aiJSONFromFile).
const TINY_PNG =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

const stripSlash = (s: string) => s.replace(/\/+$/, "");

function ms(started: number): number {
  return Math.max(0, Math.round(Date.now() - started));
}

/** Test de verbinding met één provider. Gooit nooit — vangt alles af als {ok:false}. */
export async function testProviderConnection(provider: AiProviderKey): Promise<ConnTest> {
  try {
    if (provider === "gemini") return await testGemini();
    if (provider === "deepseek") return await testDeepseek();
    if (provider === "hermes") return await testHermes();
    return await testAnthropic();
  } catch (e) {
    return { ok: false, provider, message: netMessage(e) };
  }
}

/** Vertaal een fetch-/netwerkfout naar iets leesbaars. */
function netMessage(e: unknown): string {
  const m = (e as Error)?.message || "Onbekende fout.";
  return /fetch failed|ENOTFOUND|ECONNREFUSED|network/i.test(m)
    ? "Kon de server niet bereiken (netwerk/DNS)."
    : m;
}

async function testGemini(): Promise<ConnTest> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return { ok: false, provider: "gemini", message: "Geen Gemini-sleutel ingesteld." };
  const base = stripSlash(process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com");
  const model = process.env.GEMINI_MODEL ?? "gemini-flash-latest";
  const t0 = Date.now();
  const res = await fetch(`${base}/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { inline_data: { mime_type: "image/png", data: TINY_PNG } },
            { text: "Antwoord met exact: OK" },
          ],
        },
      ],
      generationConfig: { maxOutputTokens: 10, temperature: 0 },
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return { ok: false, provider: "gemini", message: geminiError(res.status, body) };
  }
  const data = (await res.json().catch(() => null)) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  } | null;
  const text = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p) => p.text ?? "")
    .join("")
    .trim();
  return {
    ok: true,
    provider: "gemini",
    message: `Verbonden met ${model} — PDF's & afbeeldingen kunnen nu uitgelezen worden (${ms(t0)} ms).`,
  };
}

function geminiError(status: number, body: string): string {
  const snippet = body.slice(0, 160);
  if (status === 400 && /API_KEY_INVALID|API key not valid/i.test(body))
    return "Sleutel ongeldig — controleer de Gemini-sleutel (Google AI Studio).";
  if (status === 403)
    return "Toegang geweigerd (403) — is de Generative Language API aan voor deze sleutel?";
  if (status === 404)
    return `Model niet gevonden — controleer GEMINI_MODEL. ${snippet}`;
  if (status === 429) return "Te veel aanvragen (429) — quota/limiet bereikt.";
  return `HTTP ${status}${snippet ? `: ${snippet}` : ""}`;
}

async function testDeepseek(): Promise<ConnTest> {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key) return { ok: false, provider: "deepseek", message: "Geen DeepSeek-sleutel ingesteld." };
  const base = stripSlash(process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com");
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";
  const t0 = Date.now();
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      max_tokens: 8,
      messages: [{ role: "user", content: "Antwoord met exact: OK" }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const hint = res.status === 401 ? "Sleutel ongeldig (401)." : `HTTP ${res.status}: ${body.slice(0, 160)}`;
    return { ok: false, provider: "deepseek", message: hint };
  }
  return { ok: true, provider: "deepseek", message: `Verbonden met ${model} (${ms(t0)} ms).` };
}

async function testHermes(): Promise<ConnTest> {
  const key = process.env.HERMES_API_KEY?.trim();
  if (!key) return { ok: false, provider: "hermes", message: "Geen Hermes-sleutel ingesteld." };
  const base = stripSlash(process.env.HERMES_BASE_URL ?? "https://openrouter.ai/api/v1");
  const model = process.env.HERMES_MODEL ?? "nousresearch/hermes-4-70b";
  const t0 = Date.now();
  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}`, "x-title": "Q4S Dashboard" },
    body: JSON.stringify({
      model,
      max_tokens: 8,
      messages: [{ role: "user", content: "Antwoord met exact: OK" }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const hint =
      res.status === 401
        ? "Sleutel ongeldig (401)."
        : res.status === 404
          ? `Model niet gevonden — controleer HERMES_MODEL ('${model}'). ${body.slice(0, 140)}`
          : `HTTP ${res.status}: ${body.slice(0, 160)}`;
    return { ok: false, provider: "hermes", message: hint };
  }
  return { ok: true, provider: "hermes", message: `Verbonden met ${model} (${ms(t0)} ms).` };
}

async function testAnthropic(): Promise<ConnTest> {
  const key = process.env.ANTHROPIC_API_KEY?.trim();
  if (!key) return { ok: false, provider: "anthropic", message: "Geen Anthropic-sleutel ingesteld." };
  const model = process.env.ANTHROPIC_MODEL_FAST ?? "claude-haiku-4-5";
  const t0 = Date.now();
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 8,
      messages: [{ role: "user", content: "Antwoord met exact: OK" }],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const hint = res.status === 401 ? "Sleutel ongeldig (401)." : `HTTP ${res.status}: ${body.slice(0, 160)}`;
    return { ok: false, provider: "anthropic", message: hint };
  }
  return { ok: true, provider: "anthropic", message: `Verbonden met ${model} (${ms(t0)} ms).` };
}
