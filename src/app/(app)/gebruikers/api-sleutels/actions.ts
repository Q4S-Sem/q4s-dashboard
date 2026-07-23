"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setAiKey, loadAiKeysIntoEnv, type AiProviderKey } from "@/lib/ai-keys";
import { testProviderConnection, type ConnTest } from "@/lib/ai-test";

function revalidate() {
  revalidatePath("/gebruikers/api-sleutels");
  revalidatePath("/gebruikers/tokenverbruik");
  revalidatePath("/", "layout");
}

/** Sla een API-sleutel op. Leeg laten = huidige sleutel behouden (net als bij wachtwoorden). */
export async function saveAiKey(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");
  const key = String(formData.get("apiKey") ?? "").trim();
  if (!provider) redirect("/gebruikers/api-sleutels");
  if (!key) redirect("/gebruikers/api-sleutels"); // niets ingevuld → ongewijzigd
  await setAiKey(provider, key);
  revalidate();
  redirect("/gebruikers/api-sleutels?ok=1");
}

/** Verwijder een via het dashboard opgeslagen sleutel. */
export async function clearAiKey(formData: FormData) {
  const provider = String(formData.get("provider") ?? "");
  if (!provider) redirect("/gebruikers/api-sleutels");
  await setAiKey(provider, null);
  revalidate();
  redirect("/gebruikers/api-sleutels?cleared=1");
}

const PROVIDERS: AiProviderKey[] = ["deepseek", "gemini", "anthropic"];

/** Live verbindingstest voor de "Test verbinding"-knop (client-component). Doet één
 *  minimale echte API-aanroep met de ingestelde sleutel en meldt succes/fout. */
export async function testAiConnection(provider: string): Promise<ConnTest> {
  if (!(PROVIDERS as string[]).includes(provider)) {
    return { ok: false, provider: "gemini", message: "Onbekende provider." };
  }
  // Vers uit de DB laden zodat een zojuist opgeslagen sleutel (die op deze
  // serverless-instance nog niet in env stond) meteen meetelt in de test.
  await loadAiKeysIntoEnv();
  return testProviderConnection(provider as AiProviderKey);
}
