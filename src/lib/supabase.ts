// Gated Supabase-koppeling. De app draait lokaal op SQLite (prisma/schema.prisma
// datasource = sqlite, bewust gepind). "In Supabase" betekent de app-database
// omzetten naar Supabase Postgres — een migratie die je connection string nodig
// heeft. Deze helper detecteert of die er is en of de app er al op draait, zodat
// de Data-pijplijn eerlijk de status toont (voorbereid vs. actief).
//
//   SUPABASE_DB_URL=postgresql://…@db.<ref>.supabase.co:5432/postgres
//   (of DATABASE_URL naar dezelfde host, + provider "postgresql" in schema.prisma)

// De huidige Prisma-datasource. Zolang dit "sqlite" is, draait de app niet op
// Supabase — ook al staat er een connection string klaar. Bij de migratie wordt
// dit "postgresql".
const PRISMA_PROVIDER = "sqlite" as const;

export type SupabaseStatus = {
  /** Er is een (Supabase-)connection string aanwezig. */
  configured: boolean;
  /** De app-database draait daadwerkelijk op Supabase Postgres. */
  active: boolean;
  host: string | null;
  note: string;
};

function supabaseUrl(): string {
  return (
    process.env.SUPABASE_DB_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    process.env.DATABASE_URL?.trim() ||
    ""
  );
}

export function getSupabaseStatus(): SupabaseStatus {
  const url = supabaseUrl();
  const configured = /supabase/i.test(url) || Boolean(process.env.SUPABASE_URL || process.env.SUPABASE_DB_URL);
  const active = PRISMA_PROVIDER !== "sqlite" && configured;

  let host: string | null = null;
  try {
    if (url) host = new URL(url).host || null;
  } catch {
    host = null;
  }

  const note = active
    ? "De app-database draait op Supabase."
    : configured
      ? "Connection string gevonden — voer de migratie uit (SQLite → Supabase Postgres) om over te schakelen."
      : "Nog geen Supabase-connection string. Zet SUPABASE_DB_URL in je .env om te koppelen.";

  return { configured, active, host, note };
}
