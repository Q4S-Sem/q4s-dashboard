"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { verifyPassword } from "@/lib/password";
import { setSession, clearSession } from "@/lib/session";
import { productionAuthError } from "@/lib/auth-policy";
import { type FormState } from "@/lib/form";
import { clientIp, rateLimited } from "@/lib/ratelimit";

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  if (productionAuthError()) {
    return { error: "Aanmelden is tijdelijk niet beschikbaar. Neem contact op met de beheerder." };
  }
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { error: "Vul je e-mailadres en wachtwoord in." };
  }

  // Tegen wachtwoord-raden: max 10 pogingen per IP en 5 per account per 15 min.
  // ponytail: in-memory per server-instantie; gedeelde store (Redis/DB) als het
  // dashboard publiek groter wordt.
  const kwartier = 15 * 60_000;
  if (rateLimited(`login-ip:${await clientIp()}`, 10, kwartier) || rateLimited(`login-mail:${email}`, 5, kwartier)) {
    return { error: "Te veel pogingen. Wacht een kwartier en probeer het opnieuw." };
  }

  const user = await db.appUser.findUnique({ where: { email } });
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    return { error: "Onjuist e-mailadres of wachtwoord." };
  }

  await db.appUser.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await setSession(user.id);
  redirect("/");
}

export async function logout(): Promise<void> {
  await clearSession();
  redirect("/login");
}
