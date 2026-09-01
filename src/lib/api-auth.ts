import { currentUser, authRequired } from "@/lib/session";
import { isAdminRole } from "@/lib/auth-policy";

/**
 * Toegangscontrole voor data-/bestand-API-routes (CV's, ID-documenten, loonstroken,
 * facturen, bonnetjes). Deze routes serveren persoonsgegevens en moeten achter de
 * login zitten — de pagina-gate in (app)/layout.tsx dekt ze NIET (dat zijn losse
 * route handlers). Zonder deze check kon iedereen met een URL de bestanden ophalen.
 *
 * Gebruik boven in een handler:
 *   const gate = await requireApiSession();
 *   if (gate) return gate;
 *
 * Consistent met de rest van de app: als inloggen uit staat (AUTH_REQUIRED=false,
 * de "open" dev-modus) wordt er niet gegate, net als bij de pagina's. Zodra
 * inloggen aan staat (productie) is een geldige sessie verplicht.
 *
 * NB: dit geldt NIET voor de webhook-/cron-routes (inbox/email, inbox/calendar,
 * jobs/daily-sync, msp/webhook) — die hebben hun eigen token-beveiliging — en niet
 * voor /api/ping.
 */
export async function requireApiSession(): Promise<Response | null> {
  if (!authRequired()) return null;
  const user = await currentUser();
  if (!user) {
    return new Response("Niet ingelogd", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return null;
}

/** Require an administrator for financial exports and personnel administration. */
export async function requireAdminApiSession(): Promise<Response | null> {
  if (!authRequired()) return null;
  const user = await currentUser();
  if (!user) {
    return new Response("Niet ingelogd", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }
  if (!isAdminRole(user.role)) {
    return new Response("Geen toegang", {
      status: 403,
      headers: { "Cache-Control": "no-store" },
    });
  }
  return null;
}
