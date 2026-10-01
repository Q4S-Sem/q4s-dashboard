import { db } from "@/lib/db";
import { readUpload, receivedKey, fileResponseHeaders } from "@/lib/uploads";
import { requireAdminApiSession } from "@/lib/api-auth";

// Streamt een nog niet gekoppelde ZZP-factuur uit de wachtrij (FacturatieUpload),
// zodat de mens hem op het weekoverzicht kan bekijken vóór hij een persoon kiest.
// Dezelfde map en dezelfde auth-poort als een geboekte ontvangen factuur: dit zijn
// privé financiële stukken.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdminApiSession();
  if (gate) return gate;

  const { id } = await params;
  const upload = await db.facturatieUpload.findUnique({ where: { id } });
  if (!upload) return new Response("Bestand niet gevonden", { status: 404 });

  let data: Buffer;
  try {
    data = await readUpload(receivedKey(upload.fileName));
  } catch {
    return new Response("Bestand niet gevonden op schijf", { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: fileResponseHeaders(upload.mimeType, upload.originalName, upload.size),
  });
}
