import "server-only";
import { cookies } from "next/headers";
import { createHmac } from "node:crypto";
import { userIdUitCookie } from "@/lib/proxy-auth";
import { db } from "@/lib/db";
import { migrateAccessHrefs } from "@/components/nav";
import { isAdminRole, isAuthRequired, sessionSigningSecret } from "@/lib/auth-policy";

// Cookie-based sessions for app-gebruikers. The cookie holds "<userId>.<hmac>";
// the HMAC (secret = AUTH_SECRET) makes it tamper-proof. The actual user is
// looked up from the DB on every request (so deactivating a user logs them out).
// Route protection happens in src/app/(app)/layout.tsx (server, Node runtime).

const COOKIE = "q4s_session";

/**
 * Is inloggen verplicht? Standaard UIT, zodat de app nu zonder account te
 * gebruiken is (de cloud-database/login komt later). Zet `AUTH_REQUIRED=true`
 * in de omgeving om de inlog-verplichting aan te zetten.
 */
export function authRequired(): boolean {
  return isAuthRequired();
}

function sign(value: string, secret: string): string {
  return createHmac("sha256", secret).update(value).digest("base64url");
}

function readToken(token: string | undefined): string | null {
  return userIdUitCookie(token, sessionSigningSecret());
}

export async function setSession(userId: string): Promise<void> {
  const secret = sessionSigningSecret();
  if (!secret) {
    throw new Error("AUTH_SECRET is niet veilig geconfigureerd.");
  }
  (await cookies()).set(COOKIE, `${userId}.${sign(userId, secret)}`, {
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
  /** Toegestane hub-hrefs (leeg = geen, bij een GEBRUIKER). ADMIN negeert dit. */
  allowedHubs: string[];
  /** Toegestane pagina-hrefs binnen toegestane hubs. */
  allowedPages: string[];
};

/** Parse een JSON-array uit de database; kapotte/lege waarde → lege lijst. */
function parseHrefList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

/**
 * Mag de huidige sessie beheerdersacties doen (geld afboeken, boekhouding)?
 *
 * Zelfde grens als `requireAdminApiSession` in src/lib/api-auth.ts: staat
 * inloggen uit (de open dev-modus), dan gaat alles door; zodra het aan staat
 * moet er een actieve ADMIN achter de knop zitten. Server Actions zijn eigen
 * endpoints — de paginagate in (app)/layout.tsx dekt ze niet.
 */
export async function isAdminSession(): Promise<boolean> {
  if (!authRequired()) return true;
  const user = await currentUser();
  return isAdminRole(user?.role);
}

export async function currentUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  const userId = readToken(token);
  if (!userId) return null;
  const user = await db.appUser.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      allowedHubs: true,
      allowedPages: true,
    },
  });
  if (!user || !user.active) return null;
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    allowedHubs: migrateAccessHrefs(parseHrefList(user.allowedHubs)),
    allowedPages: migrateAccessHrefs(parseHrefList(user.allowedPages)),
  };
}

/** Server action alleen voor beheerders. Gooit (geen stille no-op), zodat een
 *  niet-beheerder die de action toch aanroept niets kan wijzigen. */
export async function vereisBeheerder(): Promise<void> {
  if (!(await isAdminSession())) throw new Error("Alleen een beheerder mag dit doen.");
}
