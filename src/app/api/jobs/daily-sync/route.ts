import { runDailySync } from "@/lib/sync";
import { isJobRequestAuthorized } from "@/lib/webhook-auth";

/**
 * Daily sourcing-agent job endpoint. Twee manieren om 'm te beveiligen/triggeren:
 *
 *  1. Vercel Cron — vercel.json wijst hierheen; Vercel stuurt automatisch de
 *     header `Authorization: Bearer <CRON_SECRET>` als de env-var CRON_SECRET
 *     gezet is. Dat is de productie-route (geen token in de URL nodig).
 *  2. Handmatig / externe scheduler (OS cron, cron-job.org, …):
 *     header `x-job-token: <JOB_SECRET>`.
 *
 * URL-querytokens worden bewust niet geaccepteerd, omdat ze in logs en referrers
 * terecht kunnen komen.
 *
 * Het sourcet publieke vacatures (AI web search), AI-filtert relevantie, en
 * (her)matcht kandidaten. Zonder één van beide secrets is het endpoint dicht.
 */
async function handle(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const jobSecret = process.env.JOB_SECRET ?? process.env.INBOX_WEBHOOK_SECRET;
  if (!cronSecret && !jobSecret) {
    return Response.json(
      { ok: false, error: "CRON_SECRET/JOB_SECRET niet ingesteld" },
      { status: 503 },
    );
  }
  if (!isJobRequestAuthorized(req, { cronSecret, jobSecret })) {
    return Response.json({ ok: false, error: "Ongeldige token" }, { status: 401 });
  }

  const run = await runDailySync("CRON");
  return Response.json({ ok: true, run });
}

export const GET = handle;
export const POST = handle;
