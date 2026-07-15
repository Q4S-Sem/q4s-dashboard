import { db } from "@/lib/db";
import { readUpload, uploadKey, fileResponseHeaders } from "@/lib/uploads";

// Streams a dossier document. NOTE: no auth yet — add an auth check here once
// authentication is in place (these are private files: contracts, IDs).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const doc = await db.document.findUnique({ where: { id } });
  if (!doc) return new Response("Document niet gevonden", { status: 404 });

  let data: Buffer;
  try {
    data = await readUpload(uploadKey(doc.consultantId, doc.fileName));
  } catch {
    return new Response("Bestand niet gevonden op schijf", { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: fileResponseHeaders(doc.mimeType, doc.originalName, doc.size),
  });
}
