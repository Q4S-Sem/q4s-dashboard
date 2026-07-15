import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { renderEvaluationPdf } from "@/lib/evaluation-pdf";

/** Stream the filled-in VCU evaluation as a PDF (always reflects the latest data). */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [ev, settings] = await Promise.all([
    db.evaluation.findUnique({
      where: { id },
      include: { consultant: { select: { firstName: true, lastName: true } } },
    }),
    getCompanySettings(),
  ]);
  if (!ev) return new Response("Niet gevonden", { status: 404 });

  const name = `${ev.consultant.firstName} ${ev.consultant.lastName}`;
  const pdf = await renderEvaluationPdf(ev, name, {
    name: settings.companyName,
    email: settings.email,
  });
  const fileName = `evaluatie-${name}-Q${ev.quarter}-${ev.year}.pdf`.replace(
    /[^\w.-]+/g,
    "-",
  );

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
