import { db } from "@/lib/db";
import { readUpload, uploadKey, fileResponseHeaders } from "@/lib/uploads";
import { requireApiSession } from "@/lib/api-auth";

// Een dossierstuk van een klant (bv. getekende offerte).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireApiSession();
  if (gate) return gate;
  const { id } = await params;
  const doc = await db.clientDocument.findUnique({ where: { id } });
  if (!doc) return new Response("Document niet gevonden", { status: 404 });
  let data: Buffer;
  try {
    data = await readUpload(uploadKey(doc.clientId, doc.fileName));
  } catch {
    return new Response("Bestand niet gevonden", { status: 404 });
  }
  return new Response(new Uint8Array(data), { headers: fileResponseHeaders(doc.mimeType, doc.originalName, doc.size) });
}
