import { db } from "@/lib/db";
import { parseIcs, icsStorageUid } from "@/lib/ics";
import { isUploadWithinLimit } from "@/lib/upload-policy";
import { isWebhookRequestAuthorized } from "@/lib/webhook-auth";

/**
 * Inbound-email webhook for calendar invites (.ics) sent to the Q4S mailbox.
 *
 * Point an inbound-email service (Mailgun Routes, SendGrid Inbound Parse,
 * Postmark, Cloudflare Email Workers, …) at:
 *     POST /api/inbox/calendar
 * forwarded as multipart/form-data. Every .ics attachment (or text/calendar
 * part, or a form field containing a VCALENDAR body) is parsed and each VEVENT
 * becomes a CalendarEvent (source EMAIL), de-duplicated on the iCalendar UID.
 *
 * Security: set INBOX_WEBHOOK_SECRET in .env and pass it in the
 * `x-inbox-token` header. Add real per-provider signature verification before
 * production.
 */
export async function POST(req: Request) {
  const secret = process.env.INBOX_WEBHOOK_SECRET;
  if (!secret) {
    return Response.json(
      { ok: false, error: "INBOX_WEBHOOK_SECRET niet ingesteld" },
      { status: 503 },
    );
  }

  if (!isWebhookRequestAuthorized(req, secret, "x-inbox-token")) {
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

  // Collect calendar text from .ics attachments and/or VCALENDAR form fields.
  const blobs: string[] = [];
  for (const [, value] of form.entries()) {
    if (value instanceof File) {
      if (value.size === 0 || !isUploadWithinLimit(value.size)) continue;
      const isIcs =
        value.type.includes("calendar") ||
        value.name.toLowerCase().endsWith(".ics");
      if (isIcs) blobs.push(await value.text());
    } else if (typeof value === "string" && value.includes("BEGIN:VEVENT")) {
      blobs.push(value);
    }
  }

  if (blobs.length === 0) {
    return Response.json(
      { ok: false, error: "Geen agenda-uitnodiging (.ics) gevonden" },
      { status: 400 },
    );
  }

  const created: string[] = [];
  for (const text of blobs) {
    for (const ev of parseIcs(text)) {
      const data = {
        title: ev.title,
        type: "MEETING",
        start: ev.start,
        end: ev.end ?? null,
        allDay: ev.allDay,
        location: ev.location ?? null,
        notes: ev.description ?? null,
        source: "EMAIL",
      };
      const uid = icsStorageUid(ev);
      const row = uid
        ? await db.calendarEvent.upsert({
            where: { uid },
            create: { ...data, uid },
            update: data,
          })
        : await db.calendarEvent.create({ data });
      created.push(row.id);
    }
  }

  return Response.json({ ok: true, created });
}
