/**
 * Eenmalige migratie: ClientContact -> CrmContact (recruitment-Contacten = bron).
 *
 * Draai eerst met MODE=dry (default) voor een preview; daarna MODE=apply.
 * Idempotent: slaat een ClientContact over als er al een CrmContact bestaat met
 * dezelfde clientId + naam + e-mail (voorkomt dubbelen bij een tweede run).
 *
 * Credentials komen uit .env.local (DATABASE_URL) — nooit hardcoded.
 */
import { PrismaClient } from "@prisma/client";
import { config } from "dotenv";

// Laad DB-credentials uit .env.local (of .env). Zo hoef je niets te exporteren.
config({ path: ".env.local" });
config();

const db = new PrismaClient();
// MODE=apply of `--apply` als argument = echt migreren; anders dry-run.
const MODE = process.env.MODE === "apply" || process.argv.includes("--apply") ? "apply" : "dry";

function splitName(full: string): { firstName: string; lastName: string | null } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: full.trim() || "Onbekend", lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

async function main() {
  const legacy = await db.clientContact.findMany({
    include: { client: { select: { companyName: true } } },
    orderBy: { createdAt: "asc" },
  });

  console.log(`\n[migrate] MODE=${MODE} — ${legacy.length} ClientContact-record(s) gevonden.\n`);

  let toCreate = 0;
  let skipped = 0;

  for (const lc of legacy) {
    const { firstName, lastName } = splitName(lc.name);
    // Dubbel-check: bestaat er al een CrmContact met dezelfde client + naam + e-mail?
    const existing = await db.crmContact.findFirst({
      where: {
        clientId: lc.clientId,
        firstName,
        lastName: lastName ?? null,
        email: lc.email ?? null,
      },
      select: { id: true },
    });
    if (existing) {
      skipped++;
      console.log(`  = SKIP (bestaat al): ${lc.name} @ ${lc.client?.companyName ?? lc.clientId}`);
      continue;
    }

    toCreate++;
    console.log(`  + ${MODE === "apply" ? "MIGREER" : "ZOU MIGREREN"}: ${lc.name}${lc.role ? ` (${lc.role})` : ""} @ ${lc.client?.companyName ?? lc.clientId}`);

    if (MODE === "apply") {
      await db.crmContact.create({
        data: {
          clientId: lc.clientId,
          company: lc.client?.companyName ?? null,
          firstName,
          lastName,
          role: lc.role ?? null,
          email: lc.email ?? null,
          phone: lc.phone ?? null,
          notes: lc.notes ?? null,
        },
      });
    }
  }

  console.log(`\n[migrate] Samenvatting: ${toCreate} ${MODE === "apply" ? "gemigreerd" : "te migreren"}, ${skipped} overgeslagen (al aanwezig).`);
  if (MODE === "dry") {
    console.log("[migrate] DRY-RUN — er is niets weggeschreven. Draai met MODE=apply om te migreren.\n");
  } else {
    console.log("[migrate] APPLY klaar. De oude ClientContact-records zijn NIET verwijderd (veilig bewaard).\n");
  }
}

main()
  .catch((e) => {
    console.error("[migrate] FOUT:", e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
