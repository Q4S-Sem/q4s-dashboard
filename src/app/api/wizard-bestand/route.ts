import { requireApiSession } from "@/lib/api-auth";
import {
  mimeVanBestandsnaam,
  veiligeBestandsnaam,
  veiligeWeergavenaam,
} from "@/lib/document-viewer";
import { fileResponseHeaders, readUpload, receivedKey } from "@/lib/uploads";

// ---------------------------------------------------------------------------
// Streamt een bestand dat in de wizard "Week verwerken" (/verwerken/nieuw) net
// is geüpload maar nog GEEN rij in de database heeft: de factuur van stap 2
// wordt pas bij het akkoord een ReceivedInvoice. Tot dat moment kan
// /api/ontvangen-factuur/[id] er niet bij, terwijl de mens 'm juist naast de
// uitgelezen velden wil zien.
//
// Daarom leest deze route op OPSLAGNAAM in plaats van op id. Twee grendels:
//
//  1) Ingelogd (requireApiSession) — net als /api/inbox/[id]; dit zijn privé
//     financiële stukken.
//  2) De sleutel moet door `veiligeBestandsnaam` komen: alleen een kale
//     `<uuid><extensie>`, geen schuine strepen, "..", ":" of procent-codering.
//     Daarna wordt hij door `receivedKey` in de vaste map "_ontvangen/" gezet —
//     er is geen map-parameter, dus er valt geen andere map te bereiken.
//
// Het mimetype komt uit de extensie (niet uit de query): wat we niet inline
// vertrouwen wordt door fileResponseHeaders een download met nosniff + sandbox.
// ---------------------------------------------------------------------------

export async function GET(req: Request) {
  const gate = await requireApiSession();
  if (gate) return gate;

  const params = new URL(req.url).searchParams;
  const fileName = veiligeBestandsnaam(params.get("key"));
  if (!fileName) return new Response("Ongeldige bestandssleutel", { status: 400 });

  let data: Buffer;
  try {
    data = await readUpload(receivedKey(fileName));
  } catch {
    return new Response("Bestand niet gevonden", { status: 404 });
  }

  return new Response(new Uint8Array(data), {
    headers: {
      ...fileResponseHeaders(
        mimeVanBestandsnaam(fileName),
        veiligeWeergavenaam(params.get("naam"), fileName),
        data.length,
      ),
      "Cache-Control": "private, no-store",
    },
  });
}
