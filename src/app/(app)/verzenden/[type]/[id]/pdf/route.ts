import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { salesSendData, purchaseSendData } from "@/lib/verzenden";

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

  if (type === "inkoop") {
    const inv = await db.purchaseInvoice.findUnique({
      where: { id },
      include: { consultant: true, lines: true },
    });
    if (!inv) return new Response("Niet gevonden", { status: 404 });
    const data = purchaseSendData(inv, settings);
    return pdfResponse(await renderInvoicePdf(data.pdfDoc), data.pdfName);
  }

  return new Response("Onbekend type", { status: 400 });
}
