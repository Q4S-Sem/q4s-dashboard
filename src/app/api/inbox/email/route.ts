import { db } from "@/lib/db";
import { saveInboxUpload, MAX_UPLOAD_BYTES } from "@/lib/uploads";

/**
 * Inbound-email webhook for incoming timesheets at admin@q4s.nl.
 *
 * Point an inbound-email service (Mailgun Routes, SendGrid Inbound Parse,
 * Postmark, Cloudflare Email Workers, …) at:
 *     POST /api/inbox/email?token=<INBOX_WEBHOOK_SECRET>
 * configured to forward mail sent to admin@q4s.nl as multipart/form-data with
 * the PDF as an attachment. Each PDF attachment becomes a TimesheetInbox row.
 *
 * Security: set INBOX_WEBHOOK_SECRET in .env and pass it as the `token` query
 * param (or `x-inbox-token` header). Without the secret the endpoint is closed.
 * NOTE: add real signature verification per provider before production.
 */
export async function POST(req: Request) {
  const secret = process.env.INBOX_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json(
      { ok: false, error: "INBOX_WEBHOOK_SECRET niet ingesteld" },
      { status: 503 },
    );
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
    return Response.json(
      { ok: false, error: "Verwacht multipart/form-data" },
      { status: 400 },
    );
  }

  const sender = String(form.get("sender") ?? form.get("from") ?? "") || null;
  const subject = String(form.get("subject") ?? "") || null;

  // Collect PDF attachments (providers name them attachment-1, attachment1, …).
  const files: File[] = [];
  for (const [, value] of form.entries()) {
    if (value instanceof File && value.size > 0 && value.size <= MAX_UPLOAD_BYTES) {
      const isPdf =
        value.type.includes("pdf") || value.name.toLowerCase().endsWith(".pdf");
      if (isPdf) files.push(value);
    }
  }
  if (files.length === 0) {
    return Response.json(
      { ok: false, error: "Geen PDF-bijlage gevonden" },
      { status: 400 },
    );
  }

  const created: string[] = [];
  for (const file of files) {
    const fileName = await saveInboxUpload(file);
    const item = await db.timesheetInbox.create({
      data: {
        source: "EMAIL",
        status: "NEW",
        fileName,
        originalName: file.name,
        mimeType: file.type || "application/pdf",
        size: file.size,
        senderEmail: sender,
        emailSubject: subject,
        receivedAt: new Date(),
      },
    });
    created.push(item.id);
  }

  return Response.json({ ok: true, created });
}
