import { db } from "@/lib/db";
import { readUpload, inboxKey, fileResponseHeaders } from "@/lib/uploads";

// Streams the original incoming timesheet file (PDF) for preview/download.
// NOTE: no auth yet — add an auth check here once authentication is in place.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const item = await db.timesheetInbox.findUnique({ where: { id } });
  if (!item) return new Response("Niet gevonden", { status: 404 });

  let data: Buffer;
  try {
    data = await readUpload(inboxKey(item.fileName));
  } catch {
    return new Response("Bestand niet gevonden op schijf", { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: fileResponseHeaders(item.mimeType, item.originalName, item.size),
  });
}
