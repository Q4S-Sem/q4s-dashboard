import { zipSync } from "fflate";
import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { renderInvoicePdf } from "@/lib/invoice-pdf";
import { salesSendData } from "@/lib/verzenden";
import { requireAdminApiSession } from "@/lib/api-auth";

// Bundelt alle door Q4S gemaakte verkoopfactuur-PDF's in één ZIP.
// Freelancerfacturen zijn ontvangen brondocumenten en worden niet gegenereerd.
// NOTE: no auth yet — add an auth check here once authentication is in place.
export async function GET(req: Request) {
  const gate = await requireAdminApiSession();
  if (gate) return gate;

  const url = new URL(req.url);
  const yearParam = url.searchParams.get("year");
  const year = yearParam && /^\d{4}$/.test(yearParam) ? Number(yearParam) : null;
  const dateFilter = year
    ? { issueDate: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } }
    : {};

  const settings = await getCompanySettings();
  const sales = await db.invoice.findMany({
    where: dateFilter,
    include: { client: true, lines: true },
    orderBy: { number: "asc" },
  });

  const files: Record<string, Uint8Array> = {};
  for (const inv of sales) {
    try {
      const data = salesSendData(inv, settings);
      files[`Verkoopfacturen/${data.pdfName}`] = await renderInvoicePdf(data.pdfDoc);
    } catch {
      // sla een onverwerkbare factuur over i.p.v. de hele export te laten falen
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
