/**
 * Beveiliging tegen dataverlies.
 *
 * De seed- en reset-scripts WISSEN de volledige database (`deleteMany` op alle
 * modellen, resp. `prisma db push --force-reset`) en zetten er demo-data voor
 * terug. Sinds de database Postgres (Supabase) is, raakt élke lokale run meteen
 * de PRODUCTIE-database — dan verdwijnen echte plaatsingen, klanten, facturen en
 * medewerkers.
 *
 * Deze guard weigert een destructieve actie zodra het doelwit géén lokale
 * database is. Bewust overschrijven kan alleen met ALLOW_DESTRUCTIVE_SEED=1.
 */

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

/**
 * Stopt (process.exit(1)) een destructieve actie als het doelwit niet
 * onmiskenbaar een lokale database is. `action` is puur voor de melding.
 */
export function assertDestructiveAllowed(action: string): void {
  const host = hostOf(process.env.DATABASE_URL) ?? hostOf(process.env.DIRECT_URL);
  const isLocal = host !== null && LOCAL_HOSTS.has(host);
  const override = process.env.ALLOW_DESTRUCTIVE_SEED === "1";

  if (isLocal || override) {
    if (override && !isLocal) {
      console.warn(
        `\n⚠️  ${action}: ALLOW_DESTRUCTIVE_SEED=1 gezet — destructieve actie tegen "${host}" TOEGESTAAN.\n`,
      );
    }
    return;
  }

  console.error(
    [
      "",
      `⛔  GEWEIGERD: "${action}" wist ALLE data en het doelwit is geen lokale database.`,
      `    Doel-host: ${host ?? "onbekend"}`,
      "",
      "    Dit script verwijdert plaatsingen, klanten, facturen en medewerkers en",
      "    zet er demo-data voor terug. Tegen productie verlies je dus echte data.",
      "",
      "    Alleen als dit écht een lege/nieuwe database is, bevestig expliciet:",
      "      bash/CI :  ALLOW_DESTRUCTIVE_SEED=1 npm run db:reset",
      '      PowerShell: $env:ALLOW_DESTRUCTIVE_SEED="1"; npm run db:reset',
      "",
    ].join("\n"),
  );
  process.exit(1);
}
