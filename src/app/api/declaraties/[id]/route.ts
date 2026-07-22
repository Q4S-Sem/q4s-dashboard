import { db } from "@/lib/db";
import { readUpload, expenseKey, fileResponseHeaders } from "@/lib/uploads";

// Streams an uploaded receipt (bonnetje). NOTE: no auth yet — add an auth check
// once authentication is in place (private financial files).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const exp = await db.expense.findUnique({ where: { id } });
  if (!exp) return new Response("Bestand niet gevonden", { status: 404 });
  // Handmatig ingevoerde bon heeft geen bestand.
  if (!exp.fileName) return new Response("Deze declaratie heeft geen bon-bestand", { status: 404 });

  let data: Buffer;
  try {
    data = await readUpload(expenseKey(exp.fileName));
  } catch {
    return new Response("Bestand niet gevonden op schijf", { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: fileResponseHeaders(
      exp.mimeType ?? "application/octet-stream",
      exp.originalName ?? exp.fileName,
      exp.size ?? data.length,
    ),
  });
}
