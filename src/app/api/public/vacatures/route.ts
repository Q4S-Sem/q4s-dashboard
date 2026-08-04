import { db } from "@/lib/db";
import { DISCIPLINES } from "@/lib/domain";
import { corsHeaders, dashboardBaseUrl } from "@/lib/public-api";

/**
 * Publieke vacature-feed voor de website (q4s.nl).
 *
 *   GET /api/public/vacatures   → { ok, count, vacatures: [...] }
 *
 * Levert alle GEPUBLICEERDE vacatures (status PUBLISHED) met de velden die je
 * nodig hebt voor een vacature-overzicht op q4s.nl. Detail per vacature:
 * GET /api/public/vacatures/<slug>. Solliciteren gaat via POST
 * /api/public/sollicitatie (met vacancySlug → koppelt aan de vacature).
 *
 * Publiek + CORS (standaard de request-origin; vastzetten met PUBLIC_SITE_ORIGIN).
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

export async function GET(req: Request) {
  const headers = { "content-type": "application/json", ...corsHeaders(req) };
  const base = dashboardBaseUrl();

  const rows = await db.vacancy.findMany({
    where: { status: "PUBLISHED" },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    include: { client: { select: { companyName: true } } },
  });

  const vacatures = rows.map((v) => ({
    slug: v.slug,
    title: v.title,
    company: v.client?.companyName ?? v.companyName ?? null,
    discipline: v.discipline ?? null,
    disciplineLabel: disciplineLabel(v.discipline),
    location: v.location ?? null,
    employmentType: v.employmentType ?? null,
    salary: v.salary ?? null,
    summary: v.summary ?? null,
    publishedAt: v.publishedAt?.toISOString() ?? null,
    // Link naar de door het dashboard gehoste vacature-pagina (incl. sollicitatie).
    url: `${base}/vacature/${v.slug}`,
  }));

  return Response.json({ ok: true, count: vacatures.length, vacatures }, { headers });
}
