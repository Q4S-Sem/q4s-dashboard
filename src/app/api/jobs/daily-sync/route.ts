import { runDailySync } from "@/lib/sync";

/**
 * Daily sourcing-agent job endpoint. Twee manieren om 'm te beveiligen/triggeren:
 *
 *  1. Vercel Cron — vercel.json wijst hierheen; Vercel stuurt automatisch de
 *     header `Authorization: Bearer <CRON_SECRET>` als de env-var CRON_SECRET
 *     gezet is. Dat is de productie-route (geen token in de URL nodig).
 *  2. Handmatig / externe scheduler (OS cron, cron-job.org, …):
 *     GET /api/jobs/daily-sync?token=<JOB_SECRET>  (of header x-job-token).
 *
 * Het sourcet publieke vacatures (AI web search), AI-filtert relevantie, en
 * (her)matcht kandidaten. Zonder één van beide secrets is het endpoint dicht.
 */
async function handle(req: Request) {
  // Route 1: door Vercel Cron aangeroepen (Bearer CRON_SECRET).
  const cronSecret = process.env.CRON_SECRET;
  const viaVercelCron =
    Boolean(cronSecret) && req.headers.get("authorization") === `Bearer ${cronSecret}`;

  if (!viaVercelCron) {
    // Route 2: handmatige/externe trigger met JOB_SECRET.
    const secret = process.env.JOB_SECRET ?? process.env.INBOX_WEBHOOK_SECRET;
    if (!secret && !cronSecret) {
      return Response.json(
        { ok: false, error: "CRON_SECRET/JOB_SECRET niet ingesteld" },
        { status: 503 },
      );
    }
    const url = new URL(req.url);
    const token = url.searchParams.get("token") ?? req.headers.get("x-job-token");
    if (!secret || token !== secret) {
      return Response.json({ ok: false, error: "Ongeldige token" }, { status: 401 });
    }
  }

  const run = await runDailySync("CRON");
  return Response.json({ ok: true, run });
}

export const GET = handle;
export const POST = handle;
