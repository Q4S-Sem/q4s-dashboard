import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { requireAdminApiSession } from "@/lib/api-auth";

// TIJDELIJKE, dubbel-beveiligde volledige database-export (backup).
//
// Doel: de huidige productie-data veilig naar buiten halen zonder de (Sensitive,
// niet-uitleesbare) DATABASE_URL te kennen — de gedeployde app heeft die wél.
//
// Beveiliging (allebei verplicht):
//   1) Admin-sessie (requireAdminApiSession) — moet ingelogd admin zijn.
//   2) Geheime sleutel in header `x-export-token` === env EXPORT_BACKUP_TOKEN.
//
// Deze route wordt na het maken van de backup weer VERWIJDERD.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function tokenOk(req: Request): boolean {
  const secret = process.env.EXPORT_BACKUP_TOKEN;
  const given = req.headers.get("x-export-token");
  if (!secret || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function GET(req: Request) {
  // 1) admin-login
  const gate = await requireAdminApiSession();
  if (gate) return gate;
  // 2) geheime sleutel
  if (!tokenOk(req)) {
    return new NextResponse("Geen toegang", { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  // Alle modellen dumpen. Volgorde maakt niet uit voor een backup.
  const dump: Record<string, unknown> = {};
  const models: [string, () => Promise<unknown>][] = [
    ["consultant", () => db.consultant.findMany()],
    ["timesheetReminder", () => db.timesheetReminder.findMany()],
    ["certificate", () => db.certificate.findMany()],
    ["document", () => db.document.findMany()],
    ["client", () => db.client.findMany()],
    ["clientContact", () => db.clientContact.findMany()],
    ["placement", () => db.placement.findMany()],
    ["timesheet", () => db.timesheet.findMany()],
    ["timesheetEntry", () => db.timesheetEntry.findMany()],
    ["invoice", () => db.invoice.findMany()],
    ["invoiceLine", () => db.invoiceLine.findMany()],
    ["numberSequence", () => db.numberSequence.findMany()],
    ["companySettings", () => db.companySettings.findMany()],
    ["cloudSyncLog", () => db.cloudSyncLog.findMany()],
    ["vacancy", () => db.vacancy.findMany()],
    ["outreachMessage", () => db.outreachMessage.findMany()],
    ["socialPost", () => db.socialPost.findMany()],
    ["postLink", () => db.postLink.findMany()],
    ["opportunity", () => db.opportunity.findMany()],
    ["timesheetInbox", () => db.timesheetInbox.findMany()],
    ["senderProfile", () => db.senderProfile.findMany()],
    ["placementDraft", () => db.placementDraft.findMany()],
    ["purchaseInvoice", () => db.purchaseInvoice.findMany()],
    ["purchaseInvoiceLine", () => db.purchaseInvoiceLine.findMany()],
    ["vmsConnector", () => db.vmsConnector.findMany()],
    ["recruiterAlert", () => db.recruiterAlert.findMany()],
    ["targetClient", () => db.targetClient.findMany()],
    ["candidate", () => db.candidate.findMany()],
    ["cvProfile", () => db.cvProfile.findMany()],
    ["cvIntakeRun", () => db.cvIntakeRun.findMany()],
    ["candidatePlacement", () => db.candidatePlacement.findMany()],
    ["application", () => db.application.findMany()],
    ["vacancyMatch", () => db.vacancyMatch.findMany()],
    ["syncRun", () => db.syncRun.findMany()],
    ["calendarEvent", () => db.calendarEvent.findMany()],
    ["task", () => db.task.findMany()],
    ["challenge", () => db.challenge.findMany()],
    ["challengeAttempt", () => db.challengeAttempt.findMany()],
    ["evaluation", () => db.evaluation.findMany()],
    ["appUser", () => db.appUser.findMany()],
    ["passwordResetToken", () => db.passwordResetToken.findMany()],
    ["passwordChangeRequest", () => db.passwordChangeRequest.findMany()],
    ["expense", () => db.expense.findMany()],
    ["archivedItem", () => db.archivedItem.findMany()],
    ["employee", () => db.employee.findMany()],
    ["employeeWorklog", () => db.employeeWorklog.findMany()],
    ["employeePayslip", () => db.employeePayslip.findMany()],
    ["employeeDocument", () => db.employeeDocument.findMany()],
    ["employeeLeave", () => db.employeeLeave.findMany()],
    ["employeeBonus", () => db.employeeBonus.findMany()],
    ["employeeReview", () => db.employeeReview.findMany()],
    ["crmStage", () => db.crmStage.findMany()],
    ["crmContact", () => db.crmContact.findMany()],
    ["deal", () => db.deal.findMany()],
    ["crmNote", () => db.crmNote.findMany()],
    ["activity", () => db.activity.findMany()],
    ["automationRule", () => db.automationRule.findMany()],
    ["crmSettings", () => db.crmSettings.findMany()],
    ["aiKey", () => db.aiKey.findMany()],
    ["aiSetting", () => db.aiSetting.findMany()],
    ["aiUsage", () => db.aiUsage.findMany()],
    ["receivedInvoice", () => db.receivedInvoice.findMany()],
    ["mailIntakeLog", () => db.mailIntakeLog.findMany()],
  ];

  const counts: Record<string, number> = {};
  for (const [naam, fn] of models) {
    const rows = (await fn()) as unknown[];
    dump[naam] = rows;
    counts[naam] = rows.length;
  }

  const body = JSON.stringify(
    { exportedAt: new Date().toISOString(), counts, data: dump },
    // BigInt/Date veilig serialiseren
    (_k, v) => (typeof v === "bigint" ? v.toString() : v),
    2,
  );

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="q4s-backup-${Date.now()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
