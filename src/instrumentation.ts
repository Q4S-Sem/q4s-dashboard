// Next.js instrumentation — draait één keer bij het opstarten van de server.
// We laden de in de Instellingen-hub beheerde AI-sleutels uit de DB in
// process.env, zodat de bestaande env-gebaseerde checks (isAIConfigured) en de
// providers in ai.ts blijven werken zonder overal async te hoeven worden.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Veiligheidsnet: draait de app in productie op het publiek bekende dev-geheim,
  // dan zijn sessie-cookies te vervalsen (accountovername). Luid waarschuwen in de
  // logs i.p.v. crashen — een crash zou de hele live-app platleggen.
  const secret = process.env.AUTH_SECRET?.trim();
  if (
    process.env.NODE_ENV === "production" &&
    process.env.AUTH_REQUIRED === "true" &&
    (!secret || secret === "q4s-dev-secret-change-in-production")
  ) {
    console.error(
      "\n[BEVEILIGING] AUTH_SECRET ontbreekt of is de standaardwaarde terwijl inloggen aan staat. " +
        "Sessies zijn nu VERVALSBAAR. Zet een sterke, unieke AUTH_SECRET in de omgeving.\n",
    );
  }

  try {
    const { loadAiKeysIntoEnv } = await import("./lib/ai-keys");
    await loadAiKeysIntoEnv();
  } catch {
    // Bij een verse DB (nog geen AiKey-tabel) of opstartrace: stil overslaan.
  }
}
