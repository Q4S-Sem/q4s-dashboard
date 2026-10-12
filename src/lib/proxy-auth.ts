import { createHmac, timingSafeEqual } from "node:crypto";

// ---------------------------------------------------------------------------
// Toegang op de rand (proxy): alles behalve de openbare pagina's vraagt een
// geldige sessie-cookie. Zonder deze poort konden server actions en de PDF-
// routes in (app) (facturen, CV's, evaluaties) zonder login worden aangeroepen:
// de login-check in (app)/layout.tsx draait pas NA een action en geldt niet
// voor route handlers.
// ---------------------------------------------------------------------------

/** Pagina's die zonder login moeten werken (inloggen, sollicitaties, vakproef…). */
const OPENBAAR = ["/login", "/talentpool", "/v/", "/vacature", "/vakproef", "/wachtwoord-herstellen", "/wachtwoord-vergeten"];

export function isOpenbaar(pad: string): boolean {
  return OPENBAAR.some((p) => pad === p || pad.startsWith(p.endsWith("/") ? p : `${p}/`));
}

/** userId uit de cookie "<userId>.<hmac>", of null als hij niet klopt. */
export function userIdUitCookie(token: string | undefined, secret: string | null): string | null {
  if (!token || !secret) return null;
  const i = token.lastIndexOf(".");
  if (i < 1) return null;
  const userId = token.slice(0, i);
  const a = Buffer.from(token.slice(i + 1));
  const b = Buffer.from(createHmac("sha256", secret).update(userId).digest("base64url"));
  return a.length === b.length && timingSafeEqual(a, b) ? userId : null;
}
