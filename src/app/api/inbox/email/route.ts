import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { saveInboxBytes, MAX_UPLOAD_BYTES } from "@/lib/uploads";
import { expandFiles } from "@/lib/file-intake";
import { isSpreadsheet } from "@/lib/excel";
import { ensureAiKeysLoaded } from "@/lib/ai-keys";
import { isAIConfigured, isVisionConfigured } from "@/lib/ai";
import { runInboxExtraction } from "@/lib/inbox-extract";

/**
 * Inbound-email webhook for incoming timesheets at admin@q4s.nl.
 *
 * Point an inbound-email service (Mailgun Routes, SendGrid Inbound Parse,
 * Postmark, Cloudflare Email Workers, …) at:
 *     POST /api/inbox/email?token=<INBOX_WEBHOOK_SECRET>
 * configured to forward mail sent to admin@q4s.nl as multipart/form-data with
 * the timesheet(s) as attachment(s). ELKE bijlage wordt een eigen TimesheetInbox-
 * rij en wordt METEEN uitgelezen — zo sorteert een mail met meerdere staten (bv.
 * week 29 én 30 in één mail) elke bijlage automatisch op zijn EIGEN week (de week
 * komt uit de staat zelf, niet uit de datum van de mail).
 *
 * Security: set INBOX_WEBHOOK_SECRET in .env and pass it as the `token` query
 * param (or `x-inbox-token` header). Without the secret the endpoint is closed.
 * NOTE: add real signature verification per provider before production.
 */

/** Herkent een bijlage die een urenstaat kan zijn (PDF, afbeelding of Excel/CSV). */
function isTimesheetFile(name: string, mime: string): boolean {
  const n = name.toLowerCase();
  return (
    isSpreadsheet(name, mime) ||
    mime.includes("pdf") ||
    n.endsWith(".pdf") ||
    /^image\/(png|jpe?g|gif|webp)$/.test(mime) ||
    /\.(png|jpe?g|gif|webp)$/.test(n)
  );
}

export async function POST(req: Request) {
  const secret = process.env.INBOX_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json({ ok: false, error: "INBOX_WEBHOOK_SECRET niet ingesteld" }, { status: 503 });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token") ?? req.headers.get("x-inbox-token");
  if (token !== secret) {
    return Response.json({ ok: false, error: "Ongeldige token" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ ok: false, error: "Verwacht multipart/form-data" }, { status: 400 });
  }

  const sender = String(form.get("sender") ?? form.get("from") ?? "") || null;
  const subject = String(form.get("subject") ?? "") || null;

  // Alle bijlagen (ongeacht veldnaam: attachment-1, attachment2, …), ZIP uitgepakt.
  const attachments = [...form.values()].filter(
    (v): v is File => v instanceof File && v.size > 0,
  );
  const files = (await expandFiles(attachments)).filter(
    (c) => c.bytes.length <= MAX_UPLOAD_BYTES && isTimesheetFile(c.name, c.mime),
  );
  if (files.length === 0) {
    return Response.json(
      { ok: false, error: "Geen bruikbare urenstaat-bijlage (PDF, afbeelding of Excel) gevonden" },
      { status: 400 },
    );
  }

  // Sleutels laden zodat het automatisch uitlezen ook op een verse instance werkt.
  await ensureAiKeysLoaded();
  const aiReady = isAIConfigured() || isVisionConfigured();

  const created: string[] = [];
  for (const c of files) {
    const fileName = await saveInboxBytes(c.bytes, c.name);
    const item = await db.timesheetInbox.create({
      data: {
        source: "EMAIL",
        status: "NEW",
        fileName,
        originalName: c.name,
        mimeType: c.mime,
        size: c.bytes.length,
        senderEmail: sender,
        emailSubject: subject,
        receivedAt: new Date(),
      },
    });
    created.push(item.id);

    // Meteen uitlezen → elke bijlage sorteert op zijn eigen week (wk 29 vs 30).
    if (aiReady) {
      try {
        await runInboxExtraction(item.id);
      } catch {
        // laat 'm op NEW staan voor handmatig uitlezen
      }
    }
  }

  revalidatePath("/inbox");
  revalidatePath("/", "layout");
  return Response.json({ ok: true, created });
}
