import { PrismaClient } from "@prisma/client";
import { randomUUID } from "crypto";
import {
  sourceFilesFor,
  copyArchiveFiles,
  deriveLabel,
  deriveSummary,
} from "./archive";

function lowerFirst(s: string): string {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

/**
 * Bouw de verbindings-URL met robuuste pool-instellingen.
 *
 * De dashboard-startpagina vuurt ~32 query's tegelijk af (nav-badges + analytics).
 * Met `connection_limit=1` staan die allemaal achter één verbinding in de rij; op
 * Vercel (functie ver van de DB) liep die wachtrij over `pool_timeout` (standaard
 * 10s) → P2024 "Timed out fetching a new connection" op elke pagina. We forceren
 * daarom een paar parallelle verbindingen + ruimere timeout, ongeacht wat er in de
 * env-string staat. Voor een intern dashboard (enkele gebruikers) put dit de
 * Supabase-pooler niet uit.
 *
 * Alleen voor Postgres; laat een andere/lege URL ongemoeid (dan gebruikt Prisma de
 * env uit het schema).
 */
function pooledDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw || !/^postgres(ql)?:\/\//.test(raw)) return undefined;
  try {
    const u = new URL(raw);
    u.searchParams.set("pgbouncer", "true"); // transactie-pooler: prepared statements uit
    u.searchParams.set("connection_limit", "5");
    u.searchParams.set("pool_timeout", "20");
    return u.toString();
  } catch {
    return undefined;
  }
}

// A single client, extended with a delete-hook that snapshots every deleted
// record (+ copies its files) into ArchivedItem first — so nothing removed from
// the dashboard is ever truly lost (browse/restore at /archief).
function createClient() {
  const base = new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
    datasourceUrl: pooledDatabaseUrl(),
  });

  return base.$extends({
    query: {
      $allModels: {
        async delete({ model, args, query }) {
          // Never archive the archive itself; never let archiving block a delete.
          if (model !== "ArchivedItem") {
            try {
              const delegate = (base as unknown as Record<string, { findUnique: (a: unknown) => Promise<unknown> }>)[
                lowerFirst(model)
              ];
              const rec = (await delegate.findUnique({
                where: (args as { where: unknown }).where,
              })) as Record<string, unknown> | null;

              if (rec) {
                const archiveId = randomUUID();
                const stored = await copyArchiveFiles(archiveId, sourceFilesFor(model, rec));
                await base.archivedItem.create({
                  data: {
                    id: archiveId,
                    entityType: model,
                    entityId: String(rec.id ?? ""),
                    label: deriveLabel(rec),
                    summary: deriveSummary(rec) || null,
                    dataJson: JSON.stringify(
                      rec,
                      (_k, v) => (typeof v === "bigint" ? v.toString() : v),
                      2,
                    ),
                    filesJson: stored.length ? JSON.stringify(stored) : null,
                  },
                });
              }
            } catch {
              // archiving is best-effort — the delete must still proceed
            }
          }
          return query(args);
        },
      },
    },
  });
}

// Reuse a single client across hot-reloads in development. The runtime client is
// the extended one (so the delete-hook fires), but it's typed as a plain
// PrismaClient so every existing call site keeps compiling.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const db =
  globalForPrisma.prisma ?? (createClient() as unknown as PrismaClient);

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
