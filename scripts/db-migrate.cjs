// Vercel build-stap: migreer de database ALLEEN als DIRECT_URL beschikbaar is.
//
// - Productie-deploy: DIRECT_URL is gezet -> `prisma db push` draait echt. Faalt
//   die (DB onbereikbaar, riskante wijziging), dan faalt de BUILD bewust — we
//   deployen nooit code tegen een niet-gemigreerde productie-database.
// - Preview/lokaal zonder DIRECT_URL: db push wordt netjes overgeslagen, build
//   gaat door. Zo blokkeert een preview niet op een ontbrekende credential.
//
// GEEN --accept-data-loss: bij twijfel stopt Prisma i.p.v. data te wissen.

const { execSync } = require("node:child_process");

if (!process.env.DIRECT_URL) {
  console.log("[db-migrate] DIRECT_URL ontbreekt — db push overgeslagen (preview/lokaal).");
  process.exit(0);
}

console.log("[db-migrate] DIRECT_URL aanwezig — prisma db push draait...");
try {
  execSync("prisma db push --skip-generate", { stdio: "inherit" });
  console.log("[db-migrate] Database in sync met het schema.");
} catch (e) {
  console.error("[db-migrate] db push FAALT — build gestopt om een niet-gemigreerde deploy te voorkomen.");
  process.exit(1);
}
