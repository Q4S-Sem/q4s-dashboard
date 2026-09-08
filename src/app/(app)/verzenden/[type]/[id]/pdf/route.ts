import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { salesSendData } from "@/lib/verzenden";
import { isVerzendtypeToegestaan } from "@/lib/facturatiebeleid";

function pdfResponse(pdf: Uint8Array, name: string) {
  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Stream the generated invoice PDF — same file that gets attached to the mail. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ type: string; id: string }> },
) {
  const { type, id } = await params;
  if (!isVerzendtypeToegestaan(type)) {
    return new Response("Q4S verstuurt geen inkoopfacturen.", { status: 404 });
  }
  const settings = await getCompanySettings();

  if (type === "verkoop") {
    const inv = await db.invoice.findUnique({
      where: { id },
      include: { client: true, lines: true },
    });
    if (!inv) return new Response("Niet gevonden", { status: 404 });
    const data = salesSendData(inv, settings);
    return pdfResponse(await renderInvoicePdf(data.pdfDoc), data.pdfName);
  }


  return new Response("Onbekend type", { status: 400 });
}
