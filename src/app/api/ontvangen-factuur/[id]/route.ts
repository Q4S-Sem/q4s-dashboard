import { db } from "@/lib/db";
import { readUpload, receivedKey, fileResponseHeaders } from "@/lib/uploads";
import { requireApiSession } from "@/lib/api-auth";

// Streamt de geüploade factuur van een ontvangen-factuur (van een ZZP'er).
// NOTE: nog geen auth — toevoegen zodra authenticatie live is (privé financiële stukken).
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireApiSession();
  if (gate) return gate;

  const { id } = await params;
  const inv = await db.receivedInvoice.findUnique({ where: { id } });
  if (!inv || !inv.fileName) return new Response("Bestand niet gevonden", { status: 404 });

  let data: Buffer;
  try {
    data = await readUpload(receivedKey(inv.fileName));
  } catch {
    return new Response("Bestand niet gevonden op schijf", { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: fileResponseHeaders(
      inv.mimeType ?? "application/octet-stream",
      inv.originalName ?? inv.fileName,
      inv.size ?? data.length,
    ),
  });
}
