import { db } from "@/lib/db";

// One-time cleanup route: depublish all PUBLISHED vacancies.
// No auth required — this is a one-time operation, remove after use.
// GET /api/admin/depublish-all

export const dynamic = "force-dynamic";

export async function GET() {
  const published = await db.vacancy.findMany({ where: { status: "PUBLISHED" } });
  for (const v of published) {
    await db.vacancy.update({
      where: { id: v.id },
      data: {
        status: v.improvedText ? "IMPROVED" : "CONCEPT",
        publishedAt: null,
      },
    });
  }
  return Response.json({
    ok: true,
    count: published.length,
    depublished: published.map((v) => v.title),
  });
}
