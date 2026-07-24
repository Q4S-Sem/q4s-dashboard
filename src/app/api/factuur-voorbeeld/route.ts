import { getCompanySettings } from "@/lib/settings";
import { sampleInvoiceDoc } from "@/lib/verzenden";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { requireApiSession } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

/** Streamt een VOORBEELD-factuur (echte Q4S-opmaak, fictieve regels) met de
 *  huidige bedrijfsgegevens — voor de live preview op Instellingen / Factuur
 *  importeren. Achter de login: toont bedrijfsgegevens (o.a. IBAN). */
export async function GET() {
  const gate = await requireApiSession();
  if (gate) return gate;

  const settings = await getCompanySettings();
  const pdf = await renderInvoicePdf(sampleInvoiceDoc(settings));
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'inline; filename="q4s-factuur-voorbeeld.pdf"',
      "Cache-Control": "no-store",
    },
  });
}
