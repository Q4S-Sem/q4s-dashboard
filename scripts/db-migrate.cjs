// Vercel build-stap: migreer de database ALLEEN als DIRECT_URL beschikbaar is.
//
// - Productie-deploy: DIRECT_URL is gezet -> `prisma db push` draait echt. Faalt
//   die (DB onbereikbaar, riskante wijziging), dan faalt de BUILD bewust — we
//   deployen nooit code tegen een niet-gemigreerde productie-database.
// - Preview/lokaal zonder DIRECT_URL: db push wordt netjes overgeslagen, build
//   gaat door. Zo blokkeert een preview niet op een ontbrekende credential.
//
// Met --accept-data-loss: nodig om unieke indexen toe te voegen. Dit WIST GEEN
// kolommen/tabellen bij onze additieve wijzigingen — het staat Prisma alleen toe
// een unieke constraint te zetten. Bestaan er toch duplicaten, dan faalt de push
// alsnog (en daarmee de build), zodat we nooit stil data of integriteit verliezen.

const { execSync } = require("node:child_process");

if (!process.env.DIRECT_URL) {
  console.log("[db-migrate] DIRECT_URL ontbreekt — db push overgeslagen (preview/lokaal).");
  process.exit(0);
}

console.log("[db-migrate] DIRECT_URL aanwezig — prisma db push draait...");
try {
  execSync("prisma db push --skip-generate --accept-data-loss", { stdio: "inherit" });
  console.log("[db-migrate] Database in sync met het schema.");
} catch (e) {
  console.error("[db-migrate] db push FAALT — build gestopt om een niet-gemigreerde deploy te voorkomen.");
  process.exit(1);
}
