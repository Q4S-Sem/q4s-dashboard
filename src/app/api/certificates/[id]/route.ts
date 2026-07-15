import { db } from "@/lib/db";
import { readUpload, uploadKey, fileResponseHeaders } from "@/lib/uploads";

// Streams an uploaded certificate file (scan/PDF). NOTE: no auth yet — add an
// auth check here once authentication is in place (private dossier files).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const cert = await db.certificate.findUnique({ where: { id } });
  if (!cert || !cert.fileName) {
    return new Response("Bestand niet gevonden", { status: 404 });
  }

  let data: Buffer;
  try {
    data = await readUpload(uploadKey(cert.consultantId, cert.fileName));
  } catch {
    return new Response("Bestand niet gevonden op schijf", { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: fileResponseHeaders(
      cert.mimeType ?? "application/octet-stream",
      cert.originalName ?? cert.fileName,
      cert.fileSize ?? data.length,
    ),
  });
}
