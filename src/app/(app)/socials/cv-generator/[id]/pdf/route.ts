import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { buildCvDoc, cvFileName } from "@/lib/cv-doc";
import { renderCvPdf } from "@/lib/cv-pdf";

/**
 * Het Q4S-CV als PDF. Wordt bij elk verzoek opnieuw gerenderd, dus wat je
 * downloadt komt altijd overeen met het profiel zoals het nu in de app staat
 * (inclusief de anonimiseer-stand).
 */
export async function GET(_req: Request, ctx: RouteContext<"/socials/cv-generator/[id]/pdf">) {
  const { id } = await ctx.params;

  const profile = await db.cvProfile.findUnique({
    where: { id },
    include: { candidate: true },
  });
  if (!profile) return new Response("Niet gevonden", { status: 404 });

  const settings = await getCompanySettings();
  const doc = buildCvDoc(profile, settings, profile.candidate);
  const pdf = await renderCvPdf(doc);

  return new Response(Buffer.from(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${cvFileName(doc, "pdf")}"`,
      "Cache-Control": "no-store",
    },
  });
}
