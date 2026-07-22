import { db } from "@/lib/db";
import { readUpload, uploadKey, fileResponseHeaders } from "@/lib/uploads";
import { requireApiSession } from "@/lib/api-auth";

// Streams a stored employee document (contract, ID, diploma, …) for preview/download.
// NOTE: no auth yet — add an auth check here once authentication is in place.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiSession();
  if (gate) return gate;

  const { id } = await params;
  const doc = await db.employeeDocument.findUnique({ where: { id } });
  if (!doc) return new Response("Niet gevonden", { status: 404 });

  let data: Buffer;
  try {
    data = await readUpload(uploadKey(doc.employeeId, doc.fileName));
  } catch {
    return new Response("Bestand niet gevonden op schijf", { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: fileResponseHeaders(doc.mimeType, doc.originalName, doc.fileSize || data.length),
  });
}
