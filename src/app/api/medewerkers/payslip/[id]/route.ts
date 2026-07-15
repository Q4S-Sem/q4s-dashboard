import { db } from "@/lib/db";
import { readUpload, uploadKey, fileResponseHeaders } from "@/lib/uploads";

// Streams a stored payslip (loonstrook) PDF for preview/download.
// NOTE: no auth yet — add an auth check here once authentication is in place.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const slip = await db.employeePayslip.findUnique({ where: { id } });
  if (!slip || !slip.fileName) return new Response("Niet gevonden", { status: 404 });

  let data: Buffer;
  try {
    data = await readUpload(uploadKey(slip.employeeId, slip.fileName));
  } catch {
    return new Response("Bestand niet gevonden op schijf", { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: fileResponseHeaders(
      slip.mimeType ?? "application/octet-stream",
      slip.originalName ?? "loonstrook",
      slip.fileSize ?? data.length,
    ),
  });
}
