import { db } from "@/lib/db";
import { readUpload, cvKey, fileResponseHeaders } from "@/lib/uploads";

// Streams a candidate's stored CV for preview/download.
// NOTE: no auth yet — add an auth check here once authentication is in place.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const candidate = await db.candidate.findUnique({ where: { id } });
  if (!candidate || !candidate.cvFileName) {
    return new Response("Niet gevonden", { status: 404 });
  }

  let data: Buffer;
  try {
    data = await readUpload(cvKey(candidate.cvFileName));
  } catch {
    return new Response("Bestand niet gevonden op schijf", { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: fileResponseHeaders(
      candidate.cvMimeType ?? "application/octet-stream",
      candidate.cvOriginalName ?? "cv",
      candidate.cvSize ?? data.length,
    ),
  });
}
