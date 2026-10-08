import { db } from "@/lib/db";
import { corsHeaders, dashboardBaseUrl } from "@/lib/public-api";
import { publiekeTekstIn, wiltEngels } from "@/lib/vacature-vertaling";

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

  const engels = wiltEngels(req);
  const vacatures = await Promise.all(
    rows.map(async (v) => {
      const tekst = await publiekeTekstIn(v, engels);
      return {
        slug: v.slug,
        title: tekst.title,
        company: null,
        discipline: v.discipline ?? null,
        disciplineLabel: tekst.disciplineLabel,
        location: tekst.location,
        employmentType: tekst.employmentType,
        salary: tekst.salary,
        summary: tekst.summary,
        publishedAt: v.publishedAt?.toISOString() ?? null,
        url: `${base}/vacature/${v.slug}`,
      };
    }),
  );

  return Response.json({ ok: true, count: vacatures.length, vacatures }, { headers });
}
