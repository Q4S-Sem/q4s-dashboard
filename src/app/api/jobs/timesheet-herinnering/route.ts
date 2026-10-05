import { stuurTimesheetHerinneringen } from "@/lib/timesheet-herinnering";
import { isJobRequestAuthorized } from "@/lib/webhook-auth";

/**
 * Dagelijks na de deadline (Vercel Cron, zie vercel.json): mail freelancers die
 * nog niets inleverden. Doet niets zolang de herinnering op Week verwerken UIT staat.
 */
async function handle(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const jobSecret = process.env.JOB_SECRET ?? process.env.INBOX_WEBHOOK_SECRET;
  if (!cronSecret && !jobSecret) {
    return Response.json({ ok: false, error: "CRON_SECRET/JOB_SECRET niet ingesteld" }, { status: 503 });
  }
  if (!isJobRequestAuthorized(req, { cronSecret, jobSecret })) {
    return Response.json({ ok: false, error: "Ongeldige token" }, { status: 401 });
  }
  const result = await stuurTimesheetHerinneringen();
  return Response.json({ ok: true, result });
}

export const GET = handle;
export const POST = handle;
