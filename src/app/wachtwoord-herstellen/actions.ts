"use server";

import { redirect } from "next/navigation";
import { resetPasswordWithToken } from "@/lib/password-reset";

export type ResetState = { error?: string };

export async function submitNewPassword(
  _prev: ResetState,
  formData: FormData,
): Promise<ResetState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");

  if (!token) return { error: "Ongeldige of verlopen link." };
  if (password.length < 8) return { error: "Kies een wachtwoord van minimaal 8 tekens." };
  if (password !== confirm) return { error: "De twee wachtwoorden komen niet overeen." };

  const ok = await resetPasswordWithToken(token, password);
  if (!ok) {
    return {
      error: "Deze link is verlopen of al gebruikt. Vraag een nieuwe herstel-link aan.",
    };
  }

  // Gelukt → naar inloggen met een bevestiging.
  redirect("/login?reset=1");
}
