"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { setAiKey } from "@/lib/ai-keys";

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
