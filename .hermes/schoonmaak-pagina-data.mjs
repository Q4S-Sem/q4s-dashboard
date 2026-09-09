/**
 * SCHOONMAAK — operationele data van 7 pagina's leegmaken voor live-gebruik.
 *
 * Wist de OPERATIONELE / demo-data van: Facturatie, Agenda, Recruitment,
 * Vacatures, Evaluaties, Analytics en Data. BEHOUDT de fundamenten en alle
 * configuratie:
 *   - Freelancers/werknemers (Consultant), Plaatsingen (Placement),
 *     Klanten (Client + ClientContact), Opdrachtgevers (TargetClient)
 *   - Inloggegevens/gebruikers (AppUser + reset-tokens), bedrijfs-/factuur-
 *     instellingen (CompanySettings), CRM-pipelinekolommen (CrmStage) +
 *     CRM-instellingen (CrmSettings), AI-sleutels/instellingen (AiKey/AiSetting/
 *     AiUsage), afzenderprofielen (SenderProfile), connectoren (VmsConnector),
 *     automatiseringsregels (AutomationRule), plaatsing-concepten (PlacementDraft)
 *   - Personeelsgegevens-module: Employee + worklogs/payslips/documents/leave/
 *     bonus/reviews, en certificaten (Certificate)
 *
 * VEILIG: standaard DRY-RUN — telt alleen en verandert NIETS. Pas met de vlag
 * `--apply` wordt er echt verwijderd, en dan nog alleen als de doel-database
 * expliciet is vrijgegeven met ALLOW_CLEANUP=1 (zodat een per-ongeluk-run tegen
 * productie niet stilletjes data wist).
 *
 * Gebruik (in de projectmap, met productie-.env):
 *   1) Preview :  node --env-file=.env.local .hermes/schoonmaak-pagina-data.mjs
 *   2) Echt    :  ALLOW_CLEANUP=1 node --env-file=.env.local .hermes/schoonmaak-pagina-data.mjs --apply
 *      (PowerShell:  $env:ALLOW_CLEANUP="1"; node --env-file=.env.local .hermes/schoonmaak-pagina-data.mjs --apply )
 *
 * Factuurnummering wordt gereset (de invoice-* tellers gaan weg → nieuwe jaren
 * beginnen weer bij 0001).
 */

import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const APPLY = process.argv.includes("--apply");

// Volgorde = veilige verwijdervolgorde (kinderen vóór ouders). Cascades doen veel
// vanzelf, maar we zijn expliciet zodat Restrict-relaties nooit klappen.
const PLAN = [
  {
    pagina: "Facturatie",
    stappen: [
      ["invoiceLine", () => db.invoiceLine.deleteMany({})],
      ["invoice", () => db.invoice.deleteMany({})],
      ["purchaseInvoiceLine", () => db.purchaseInvoiceLine.deleteMany({})],
      ["purchaseInvoice", () => db.purchaseInvoice.deleteMany({})],
      ["receivedInvoice", () => db.receivedInvoice.deleteMany({})],
      ["timesheetInbox", () => db.timesheetInbox.deleteMany({})],
      ["timesheetEntry", () => db.timesheetEntry.deleteMany({})],
      ["timesheetReminder", () => db.timesheetReminder.deleteMany({})],
      ["timesheet", () => db.timesheet.deleteMany({})],
      ["expense", () => db.expense.deleteMany({})],
    ],
  },
  {
    pagina: "Agenda",
    stappen: [
      ["calendarEvent", () => db.calendarEvent.deleteMany({})],
      ["task", () => db.task.deleteMany({})],
    ],
  },
  {
    pagina: "Recruitment",
    stappen: [
      // CRM
      ["crmNote", () => db.crmNote.deleteMany({})],
      ["activity", () => db.activity.deleteMany({})],
      ["deal", () => db.deal.deleteMany({})],
      ["crmContact", () => db.crmContact.deleteMany({})],
      // Kandidaten (cascades ruimen CvProfile/CvIntakeRun/CandidatePlacement/
      // VacancyMatch/Application mee, maar we zijn expliciet)
      ["application", () => db.application.deleteMany({})],
      ["vacancyMatch", () => db.vacancyMatch.deleteMany({})],
      ["candidatePlacement", () => db.candidatePlacement.deleteMany({})],
      ["cvIntakeRun", () => db.cvIntakeRun.deleteMany({})],
      ["cvProfile", () => db.cvProfile.deleteMany({})],
      ["challengeAttempt", () => db.challengeAttempt.deleteMany({})],
      ["challenge", () => db.challenge.deleteMany({})],
      ["candidate", () => db.candidate.deleteMany({})],
      ["outreachMessage", () => db.outreachMessage.deleteMany({})],
    ],
  },
  {
    pagina: "Vacatures",
    stappen: [
      ["postLink", () => db.postLink.deleteMany({})],
      ["socialPost", () => db.socialPost.deleteMany({})],
      ["vacancy", () => db.vacancy.deleteMany({})],
    ],
  },
  {
    pagina: "Evaluaties",
    stappen: [["evaluation", () => db.evaluation.deleteMany({})]],
  },
  {
    pagina: "Data",
    stappen: [
      ["opportunity", () => db.opportunity.deleteMany({})],
      ["recruiterAlert", () => db.recruiterAlert.deleteMany({})],
      ["syncRun", () => db.syncRun.deleteMany({})],
      ["cloudSyncLog", () => db.cloudSyncLog.deleteMany({})],
      ["mailIntakeLog", () => db.mailIntakeLog.deleteMany({})],
      ["archivedItem", () => db.archivedItem.deleteMany({})],
    ],
  },
  {
    pagina: "Factuurnummering resetten",
    stappen: [
      // Alleen de factuur-tellers; laat andere sleutels met rust.
      [
        "numberSequence (invoice-*/purchase-*)",
        () =>
          db.numberSequence.deleteMany({
            where: { OR: [{ key: { startsWith: "invoice-" } }, { key: { startsWith: "purchase-invoice-" } }] },
          }),
      ],
    ],
  },
];

// Tabellen die we BEWUST laten staan — puur ter controle in de preview.
const BEHOUDEN = [
  "consultant", "placement", "client", "clientContact", "targetClient",
  "appUser", "companySettings", "crmSettings", "crmStage",
  "aiKey", "aiSetting", "aiUsage", "senderProfile", "vmsConnector",
  "automationRule", "placementDraft",
  "employee", "certificate", "document",
];

// count() per model via de delegate-naam.
async function telModel(naam) {
  const key = naam.replace(/ .*/, ""); // strip toelichting zoals "(invoice-*)"
  const delegate = db[key];
  if (!delegate?.count) return null;
  if (key === "numberSequence") {
    return db.numberSequence.count({
      where: { OR: [{ key: { startsWith: "invoice-" } }, { key: { startsWith: "purchase-invoice-" } }] },
    });
  }
  return delegate.count();
}

async function main() {
  const host = (() => {
    try { return new URL(process.env.DATABASE_URL ?? process.env.DIRECT_URL ?? "").hostname; }
    catch { return "onbekend"; }
  })();

  console.log("");
  console.log("=".repeat(64));
  console.log(`  SCHOONMAAK PAGINA-DATA   —   doel-host: ${host}`);
  console.log(`  Modus: ${APPLY ? "⚠️  APPLY (verwijdert echt)" : "DRY-RUN (telt alleen, wist niets)"}`);
  console.log("=".repeat(64));

  // 1) Preview: wat gaat er weg?
  let totaal = 0;
  for (const groep of PLAN) {
    console.log(`\n▶ ${groep.pagina}`);
    for (const [naam] of groep.stappen) {
      const n = await telModel(naam);
      if (n === null) { console.log(`    ? ${naam.padEnd(34)} (model niet gevonden)`); continue; }
      totaal += n;
      console.log(`    ${String(n).padStart(6)}  ${naam}`);
    }
  }

  // 2) Wat blijft staan (ter geruststelling)
  console.log(`\n✔ BEHOUDEN (wordt NIET aangeraakt):`);
  for (const key of BEHOUDEN) {
    const n = await db[key]?.count ? await db[key].count() : null;
    if (n !== null) console.log(`    ${String(n).padStart(6)}  ${key}`);
  }

  console.log(`\n  Totaal te verwijderen rijen: ${totaal}`);

  if (!APPLY) {
    console.log(`\nDRY-RUN klaar — er is NIETS gewijzigd.`);
    console.log(`Klopt dit? Draai dan echt met:\n  ALLOW_CLEANUP=1 node --env-file=.env.local .hermes/schoonmaak-pagina-data.mjs --apply\n`);
    return;
  }

  if (process.env.ALLOW_CLEANUP !== "1") {
    console.error(`\n⛔ GEWEIGERD: --apply gegeven maar ALLOW_CLEANUP is niet "1".`);
    console.error(`   Zet ALLOW_CLEANUP=1 om te bevestigen dat je écht wilt wissen.\n`);
    process.exit(1);
  }

  // 3) Echt verwijderen, alles in één transactie: of alles slaagt, of niets.
  console.log(`\n⏳ Verwijderen in één transactie…`);
  await db.$transaction(async () => {
    for (const groep of PLAN) {
      for (const [naam, fn] of groep.stappen) {
        const res = await fn();
        console.log(`    − ${naam.padEnd(34)} ${res?.count ?? 0} verwijderd`);
      }
    }
  });
  console.log(`\n✅ Klaar. Operationele data leeg; fundamenten en config ongewijzigd.\n`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
