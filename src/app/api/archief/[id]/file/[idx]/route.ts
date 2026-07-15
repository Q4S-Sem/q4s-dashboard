import { db } from "@/lib/db";
import { archiveKey } from "@/lib/archive";
import { readUpload, fileResponseHeaders } from "@/lib/uploads";

// Serves a file that was copied into the archive when a record was deleted.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string; idx: string }> },
) {
  const { id, idx } = await params;
  const item = await db.archivedItem.findUnique({ where: { id } });
  if (!item || !item.filesJson) {
    return new Response("Niet gevonden", { status: 404 });
  }

  let files: { name: string; mimeType: string; file: string }[] = [];
  try {
    files = JSON.parse(item.filesJson);
  } catch {
    return new Response("Niet gevonden", { status: 404 });
  }

  const f = files[Number(idx)];
  if (!f) return new Response("Niet gevonden", { status: 404 });

  let data: Buffer;
  try {
    data = await readUpload(archiveKey(id, f.file));
  } catch {
    return new Response("Bestand niet meer beschikbaar", { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: fileResponseHeaders(
      f.mimeType || "application/octet-stream",
      f.name || f.file,
      data.length,
    ),
  });
}
