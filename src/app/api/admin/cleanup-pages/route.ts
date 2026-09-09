import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";

// TIJDELIJKE, token-beveiligde schoonmaak van operationele pagina-data.
//
// Wist de data van 7 pagina's (Facturatie, Agenda, Recruitment, Vacatures,
// Evaluaties, Analytics, Data) en BEHOUDT de fundamenten + alle configuratie
// (freelancers, plaatsingen, klanten, opdrachtgevers, gebruikers, instellingen,
// AI-sleutels, CRM-pipelinekolommen, connectoren, medewerkers, certificaten).
//
// Beveiliging: header `x-cleanup-token` === env CLEANUP_TOKEN.
// GET  = dry-run (telt alleen).   POST met ?apply=1 = wist echt (in transactie).
// Deze route wordt na de schoonmaak weer VERWIJDERD.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function tokenOk(req: Request): boolean {
  const secret = process.env.CLEANUP_TOKEN;
  const given = req.headers.get("x-cleanup-token");
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Volgorde = FK-veilig (kinderen vóór ouders).
const STEPS: [string, () => Promise<{ count: number }>][] = [
  // Facturatie
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
  // Agenda
  ["calendarEvent", () => db.calendarEvent.deleteMany({})],
  ["task", () => db.task.deleteMany({})],
  // Recruitment (CRM + kandidaten)
  ["crmNote", () => db.crmNote.deleteMany({})],
  ["activity", () => db.activity.deleteMany({})],
  ["deal", () => db.deal.deleteMany({})],
  ["crmContact", () => db.crmContact.deleteMany({})],
  ["application", () => db.application.deleteMany({})],
  ["vacancyMatch", () => db.vacancyMatch.deleteMany({})],
  ["candidatePlacement", () => db.candidatePlacement.deleteMany({})],
  ["cvIntakeRun", () => db.cvIntakeRun.deleteMany({})],
  ["cvProfile", () => db.cvProfile.deleteMany({})],
  ["challengeAttempt", () => db.challengeAttempt.deleteMany({})],
  ["challenge", () => db.challenge.deleteMany({})],
  ["candidate", () => db.candidate.deleteMany({})],
  ["outreachMessage", () => db.outreachMessage.deleteMany({})],
  // Vacatures
  ["postLink", () => db.postLink.deleteMany({})],
  ["socialPost", () => db.socialPost.deleteMany({})],
  ["vacancy", () => db.vacancy.deleteMany({})],
  // Evaluaties
  ["evaluation", () => db.evaluation.deleteMany({})],
  // Data
  ["opportunity", () => db.opportunity.deleteMany({})],
  ["recruiterAlert", () => db.recruiterAlert.deleteMany({})],
  ["syncRun", () => db.syncRun.deleteMany({})],
  ["cloudSyncLog", () => db.cloudSyncLog.deleteMany({})],
  ["mailIntakeLog", () => db.mailIntakeLog.deleteMany({})],
  ["archivedItem", () => db.archivedItem.deleteMany({})],
];

const KEEP = [
  "consultant", "placement", "client", "clientContact", "targetClient",
  "appUser", "companySettings", "crmSettings", "crmStage",
  "aiKey", "aiSetting", "aiUsage", "senderProfile", "vmsConnector",
  "automationRule", "placementDraft", "employee", "certificate", "document",
] as const;

async function countAll() {
  const del: Record<string, number> = {};
  for (const [name] of STEPS) {
    // @ts-expect-error dynamische delegate-toegang
    del[name] = await db[name].count();
  }
  const keep: Record<string, number> = {};
  for (const name of KEEP) {
    // @ts-expect-error dynamische delegate-toegang
    keep[name] = await db[name].count();
  }
  return { del, keep };
}

export async function GET(req: Request) {
  if (!tokenOk(req)) return new NextResponse("Geen toegang", { status: 403, headers: { "Cache-Control": "no-store" } });
  const { del, keep } = await countAll();
  const totaal = Object.values(del).reduce((s, n) => s + n, 0);
  return NextResponse.json(
    { mode: "dry-run", teVerwijderen: del, totaalTeVerwijderen: totaal, behouden: keep },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(req: Request) {
  if (!tokenOk(req)) return new NextResponse("Geen toegang", { status: 403, headers: { "Cache-Control": "no-store" } });
  const url = new URL(req.url);
  if (url.searchParams.get("apply") !== "1") {
    return NextResponse.json({ error: "Voeg ?apply=1 toe om echt te wissen." }, { status: 400 });
  }

  const verwijderd: Record<string, number> = {};
  // Factuurnummering resetten hoort bij het schoonmaken.
  await db.$transaction(async (tx) => {
    for (const [name, fn] of STEPS) {
      // deleteMany binnen tx: bind aan tx-client
      // @ts-expect-error dynamische delegate-toegang
      const res = await tx[name].deleteMany({});
      verwijderd[name] = res.count;
    }
    const seq = await tx.numberSequence.deleteMany({
      where: { OR: [{ key: { startsWith: "invoice-" } }, { key: { startsWith: "purchase-invoice-" } }] },
    });
    verwijderd["numberSequence(invoice/purchase)"] = seq.count;
  });

  const totaal = Object.values(verwijderd).reduce((s, n) => s + n, 0);
  return NextResponse.json(
    { mode: "applied", verwijderd, totaalVerwijderd: totaal },
    { headers: { "Cache-Control": "no-store" } },
  );
}
