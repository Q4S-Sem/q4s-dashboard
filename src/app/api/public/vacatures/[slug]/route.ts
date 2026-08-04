import { db } from "@/lib/db";
import { DISCIPLINES } from "@/lib/domain";
import { corsHeaders, dashboardBaseUrl, splitLines } from "@/lib/public-api";

/**
 * Publieke vacature-DETAIL voor de website (q4s.nl).
 *
 *   GET /api/public/vacatures/<slug>  → { ok, vacature: {...} }
 *
 * Volledige inhoud van één gepubliceerde vacature (summary + werkzaamheden/
 * eisen/pré als lijsten, of de volledige verbeterde tekst als fallback), zodat
 * q4s.nl een eigen detailpagina kan renderen. 404 als de slug niet bestaat of de
 * vacature niet (meer) gepubliceerd is.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function disciplineLabel(value: string | null): string | null {
  if (!value) return null;
  return DISCIPLINES.find((d) => d.value === value)?.label ?? value;
}

export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req) });
}

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const headers = { "content-type": "application/json", ...corsHeaders(req) };
  const { slug } = await params;

  const v = await db.vacancy.findUnique({
    where: { slug },
    include: { client: { select: { companyName: true } } },
  });
  if (!v || v.status !== "PUBLISHED") {
    return Response.json({ ok: false, error: "Vacature niet gevonden." }, { status: 404, headers });
  }

  const responsibilities = splitLines(v.responsibilities);
  const requirements = splitLines(v.requirements);
  const niceToHave = splitLines(v.niceToHave);
  const hasStructured = Boolean(v.summary) || responsibilities.length > 0 || requirements.length > 0;

  const vacature = {
    slug: v.slug,
    title: v.title,
    company: v.client?.companyName ?? v.companyName ?? null,
    discipline: v.discipline ?? null,
    disciplineLabel: disciplineLabel(v.discipline),
    location: v.location ?? null,
    employmentType: v.employmentType ?? null,
    salary: v.salary ?? null,
    summary: v.summary ?? null,
    responsibilities,
    requirements,
    niceToHave,
    // Volledige verbeterde tekst als er geen gestructureerde secties zijn.
    fullText: !hasStructured ? v.improvedText ?? null : null,
    publishedAt: v.publishedAt?.toISOString() ?? null,
    url: `${dashboardBaseUrl()}/vacature/${v.slug}`,
  };

  return Response.json({ ok: true, vacature }, { headers });
}
