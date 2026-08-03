import { pullInboxMail } from "@/lib/mail-intake";

/**
 * Automatische postvak-intake. Twee manieren om te triggeren/beveiligen (zoals
 * daily-sync):
 *  1. Vercel Cron — vercel.json wijst hierheen; Vercel stuurt
 *     `Authorization: Bearer <CRON_SECRET>`.
 *  2. Handmatig/extern: GET /api/jobs/mail-intake?token=<JOB_SECRET>
 *     (of header x-job-token).
 *
 * Leest ongelezen mail met bijlagen uit admin@q4s.nl, importeert urenstaten
 * automatisch en houdt facturen apart. Zonder MS_*-koppeling: no-op (connected:false).
 */
async function handle(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const viaVercelCron =
    Boolean(cronSecret) && req.headers.get("authorization") === `Bearer ${cronSecret}`;

  if (!viaVercelCron) {
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

  const result = await pullInboxMail();
  return Response.json({ ok: result.ok, result });
}

export const GET = handle;
export const POST = handle;
