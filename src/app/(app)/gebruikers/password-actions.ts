"use server";

import { revalidatePath } from "next/cache";
import { currentUser } from "@/lib/session";
import {
  startPasswordChange,
  confirmPasswordChange,
  CODE_LENGTH,
} from "@/lib/password-change";

export type PwState = {
  error?: string;
  /** Er staat een code klaar — toon stap 2. */
  sent?: boolean;
  /** Verstuurd zonder mailserver (dev): dan is er niets aangekomen. */
  simulated?: boolean;
  done?: boolean;
};

const MIN_LENGTH = 8;

/** Stap 1 — huidig wachtwoord controleren en een code mailen. */
export async function requestPasswordChange(
  _prev: PwState,
  formData: FormData,
): Promise<PwState> {
  const user = await currentUser();
  if (!user) return { error: "Je bent niet ingelogd." };

  const current = String(formData.get("current") ?? "");
  const next = String(formData.get("next") ?? "");
  const repeat = String(formData.get("repeat") ?? "");

  if (!current) return { error: "Vul je huidige wachtwoord in." };
  if (next.length < MIN_LENGTH) {
    return { error: `Kies een nieuw wachtwoord van minstens ${MIN_LENGTH} tekens.` };
  }
  if (next !== repeat) return { error: "De twee nieuwe wachtwoorden zijn niet gelijk." };
  if (next === current) return { error: "Kies een ander wachtwoord dan je huidige." };

  const res = await startPasswordChange(user.id, current, next);
  if (!res.ok) {
    if (res.reason === "wachtwoord") return { error: "Je huidige wachtwoord klopt niet." };
    if (res.reason === "geen-mail") {
      return {
        error:
          "E-mail versturen is op dit systeem nog niet ingesteld, dus we kunnen je geen code sturen. Vraag een beheerder om je wachtwoord te wijzigen.",
      };
    }
    return { error: "Je account is niet gevonden." };
  }

  revalidatePath(`/gebruikers/${user.id}/bewerken`);
  return { sent: true, simulated: res.simulated };
}

/** Stap 2 — code controleren en het nieuwe wachtwoord activeren. */
export async function confirmPasswordCode(
  _prev: PwState,
  formData: FormData,
): Promise<PwState> {
  const user = await currentUser();
  if (!user) return { error: "Je bent niet ingelogd." };

  const code = String(formData.get("code") ?? "").replace(/\D/g, "");
  if (code.length !== CODE_LENGTH) {
    return { sent: true, error: `Vul de ${CODE_LENGTH} cijfers uit de e-mail in.` };
  }

  const res = await confirmPasswordChange(user.id, code);
  if (!res.ok) {
    const tekst: Record<string, string> = {
      "geen-verzoek": "Er staat geen aanvraag open. Begin opnieuw.",
      verlopen: "De code is verlopen. Vraag een nieuwe aan.",
      code: "Die code klopt niet. Kijk de e-mail nog even na.",
      "te-vaak": "Te vaak een verkeerde code. Begin opnieuw.",
    };
    const opnieuw = res.reason === "code";
    return { sent: opnieuw, error: tekst[res.reason] };
  }

  revalidatePath(`/gebruikers/${user.id}/bewerken`);
  return { done: true };
}
