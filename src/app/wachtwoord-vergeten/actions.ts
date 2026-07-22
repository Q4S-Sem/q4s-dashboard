"use server";

import { headers } from "next/headers";
import { requestPasswordReset, isEmailConfigured } from "@/lib/password-reset";

export type ResetRequestState = { error?: string; sent?: boolean };

/** Bepaal de site-URL voor de link in de e-mail (uit env of uit de request-headers). */
async function siteOrigin(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (fromEnv) return fromEnv;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function requestReset(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { error: "Vul je e-mailadres in." };

  // Eerlijk: zonder ingestelde e-mail kan er niets verstuurd worden. Geen valse
  // "check je mail"-belofte — verwijs naar een beheerder (die kan resetten via
  // Instellingen → Gebruikers).
  if (!isEmailConfigured()) {
    return {
      error:
        "E-mail versturen is op dit systeem nog niet ingesteld, dus we kunnen je nu geen herstel-link mailen. Vraag een beheerder om je wachtwoord te resetten.",
    };
  }

  const origin = await siteOrigin();
  // Nooit gooien op een onbekend adres, en nooit verklappen of het bestaat.
  await requestPasswordReset(email, origin).catch(() => null);
  return { sent: true };
}
