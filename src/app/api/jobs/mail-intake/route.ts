import { pullInboxMail } from "@/lib/mail-intake";
import { isJobRequestAuthorized } from "@/lib/webhook-auth";

/**
 * Automatische postvak-intake. Twee manieren om te triggeren/beveiligen (zoals
 * daily-sync):
 *  1. Vercel Cron — vercel.json wijst hierheen; Vercel stuurt
 *     `Authorization: Bearer <CRON_SECRET>`.
 *  2. Handmatig/extern: header `x-job-token: <JOB_SECRET>`.
 *     URL-querytokens worden bewust niet geaccepteerd.
 *
 * Leest ongelezen mail met bijlagen uit admin@q4s.nl, importeert urenstaten
 * automatisch en houdt facturen apart. Zonder MS_*-koppeling: no-op (connected:false).
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

  const result = await pullInboxMail();
  return Response.json({ ok: result.ok, result });
}

export const GET = handle;
export const POST = handle;
