// Next.js instrumentation — draait één keer bij het opstarten van de server.
// We laden de in de Instellingen-hub beheerde AI-sleutels uit de DB in
// process.env, zodat de bestaande env-gebaseerde checks (isAIConfigured) en de
// providers in ai.ts blijven werken zonder overal async te hoeven worden.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { loadAiKeysIntoEnv } = await import("./lib/ai-keys");
    await loadAiKeysIntoEnv();
  } catch {
    // Bij een verse DB (nog geen AiKey-tabel) of opstartrace: stil overslaan.
  }
}
