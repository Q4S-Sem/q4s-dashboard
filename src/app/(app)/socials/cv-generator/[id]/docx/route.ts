import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { buildCvDoc, cvFileName } from "@/lib/cv-doc";
import { renderCvDocx } from "@/lib/cv-docx";

/**
 * Hetzelfde Q4S-CV als bewerkbaar Word-document. `attachment` i.p.v. `inline`:
 * de browser kan .docx toch niet tonen, dus meteen downloaden.
 */
export async function GET(_req: Request, ctx: RouteContext<"/socials/cv-generator/[id]/docx">) {
  const { id } = await ctx.params;

  const profile = await db.cvProfile.findUnique({
    where: { id },
    include: { candidate: true },
  });
  if (!profile) return new Response("Niet gevonden", { status: 404 });

  const settings = await getCompanySettings();
  const doc = buildCvDoc(profile, settings, profile.candidate);
  const docx = await renderCvDocx(doc);

  // Buffer.from() → Buffer<ArrayBuffer>: Packer geeft Buffer<ArrayBufferLike>, en
  // dat accepteert Response niet als body.
  return new Response(Buffer.from(docx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${cvFileName(doc, "docx")}"`,
      "Cache-Control": "no-store",
    },
  });
}
