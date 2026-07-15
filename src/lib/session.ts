import "server-only";
import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

// Cookie-based sessions for app-gebruikers. The cookie holds "<userId>.<hmac>";
// the HMAC (secret = AUTH_SECRET) makes it tamper-proof. The actual user is
// looked up from the DB on every request (so deactivating a user logs them out).
// Route protection happens in src/app/(app)/layout.tsx (server, Node runtime).

const SECRET = process.env.AUTH_SECRET || "q4s-dev-secret-change-in-production";
const COOKIE = "q4s_session";

/**
 * Is inloggen verplicht? Standaard UIT, zodat de app nu zonder account te
 * gebruiken is (de cloud-database/login komt later). Zet `AUTH_REQUIRED=true`
 * in de omgeving om de inlog-verplichting aan te zetten.
 */
export function authRequired(): boolean {
  return process.env.AUTH_REQUIRED === "true";
}

function sign(value: string): string {
  return createHmac("sha256", SECRET).update(value).digest("base64url");
}

function readToken(token: string | undefined): string | null {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const userId = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = sign(userId);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return userId;
}

export async function setSession(userId: string): Promise<void> {
  (await cookies()).set(COOKIE, `${userId}.${sign(userId)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30, // 30 dagen
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}

export type SessionUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  const userId = readToken(token);
  if (!userId) return null;
  const user = await db.appUser.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, role: true, active: true },
  });
  if (!user || !user.active) return null;
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
