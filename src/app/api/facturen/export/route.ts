import { zipSync } from "fflate";
import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { salesSendData, purchaseSendData } from "@/lib/verzenden";
import { requireApiSession } from "@/lib/api-auth";

// Bundelt alle factuur-PDF's (verkoop + inkoop) in één ZIP om door te sturen
// naar de boekhouder. Optioneel filteren op ?year=YYYY.
// NOTE: no auth yet — add an auth check here once authentication is in place.
export async function GET(req: Request) {
  const gate = await requireApiSession();
  if (gate) return gate;

  const url = new URL(req.url);
  const yearParam = url.searchParams.get("year");
  const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : null;
  const dateFilter = year
    ? { issueDate: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } }
    : {};

  const settings = await getCompanySettings();
  const [sales, purchases] = await Promise.all([
    db.invoice.findMany({
      where: dateFilter,
      include: { client: true, lines: true },
      orderBy: { number: "asc" },
    }),
    db.purchaseInvoice.findMany({
      where: dateFilter,
      include: { consultant: true, lines: true },
      orderBy: { number: "asc" },
    }),
  ]);

  const files: Record<string, Uint8Array> = {};
  for (const inv of sales) {
    try {
      const data = salesSendData(inv, settings);
      files[`Verkoopfacturen/${data.pdfName}`] = await renderInvoicePdf(data.pdfDoc);
    } catch {
      // sla een onverwerkbare factuur over i.p.v. de hele export te laten falen
    }
  }
  for (const inv of purchases) {
    try {
      const data = purchaseSendData(inv, settings);
      files[`Inkoopfacturen/${data.pdfName}`] = await renderInvoicePdf(data.pdfDoc);
    } catch {
      // idem
    }
  }

  if (Object.keys(files).length === 0) {
    return new Response("Geen facturen gevonden", { status: 404 });
  }

  const zipped = zipSync(files, { level: 6 });
  const stamp = year ? String(year) : "alle";
  return new Response(Buffer.from(zipped), {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="Q4S-facturen-${stamp}.zip"`,
      "Cache-Control": "no-store",
    },
  });
}
