import { db } from "@/lib/db";
import { readUpload, photoKey } from "@/lib/uploads";
import { requireApiSession } from "@/lib/api-auth";

/**
 * Streamt de profielfoto van een kandidaat voor de recruitment-schermen.
 * Achter de sessiepoort: een pasfoto is een persoonsgegeven (AVG), dus geen
 * publieke URL en `private` in de cache-header.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const gate = await requireApiSession();
  if (gate) return gate;

  const { id } = await params;
  const candidate = await db.candidate.findUnique({
    where: { id },
    select: { photoFileName: true, photoMimeType: true },
  });
  if (!candidate?.photoFileName) {
    return new Response("Niet gevonden", { status: 404 });
  }

  let data: Buffer;
  try {
    data = await readUpload(photoKey(candidate.photoFileName));
  } catch {
    return new Response("Bestand niet gevonden", { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: {
      "Content-Type": candidate.photoMimeType ?? "image/jpeg",
      "Content-Length": String(data.length),
      // De bestandsnaam is willekeurig en verandert bij elke nieuwe upload,
      // dus de browser mag 'm rustig lang vasthouden.
      "Cache-Control": "private, max-age=86400",
    },
  });
}
