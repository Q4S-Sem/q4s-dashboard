import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { salesSendData } from "@/lib/verzenden";

/**
 * De verkoopfactuur als PDF — exact hetzelfde bestand dat als bijlage meegaat
 * naar de klant. Eén renderer (`renderInvoicePdf`), dus het voorbeeld, de print
 * en de verzending kunnen nooit van elkaar afwijken.
 *
 * Q4S verstuurt uitsluitend VERKOOPfacturen: de factuur van een ZZP'er is zijn
 * eigen document (Optie A) en wordt nooit door ons gegenereerd. Vandaar dat deze
 * route alleen over `Invoice` gaat.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const inv = await db.invoice.findUnique({
    where: { id },
    include: { client: true, lines: true },
  });
  if (!inv) return new Response("Niet gevonden", { status: 404 });

  const settings = await getCompanySettings();
  const data = salesSendData(inv, settings);
  const pdf = await renderInvoicePdf(data.pdfDoc);

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${data.pdfName}"`,
      "Cache-Control": "no-store",
    },
  });
}
