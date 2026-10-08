import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { PaginaKop } from "@/components/ui/filter-tegels";
import { cardDefaultsFromVacancy } from "@/lib/linkedin-card";
import { LinkedInStudio, type StudioVacature } from "./LinkedInStudio";

export const metadata = { title: "LinkedIn-studio" };
export const dynamic = "force-dynamic";

export default async function LinkedInStudioPage({ searchParams }: { searchParams: Promise<{ vac?: string }> }) {
  const { vac } = await searchParams;
  const [vacancies, settings] = await Promise.all([
    // Alleen vacatures die echt online staan op q4s.nl.
    db.vacancy.findMany({
      where: { status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
      take: 150,
      select: {
        id: true, title: true, discipline: true, location: true, employmentType: true, salary: true,
        responsibilities: true, requirements: true, summary: true, slug: true, status: true,
        socialPosts: {
          where: { platform: "LINKEDIN", status: "PUBLISHED" },
          orderBy: { publishedAt: "desc" },
          take: 1,
          select: { publishedAt: true },
        },
      },
    }),
    getCompanySettings(),
  ]);

  const vacatures: StudioVacature[] = vacancies.map((v) => ({
      id: v.id,
      title: v.title,
      discipline: v.discipline ?? "",
      location: v.location ?? "",
      employmentType: v.employmentType ?? "",
      salary: v.salary ?? "",
      responsibilities: v.responsibilities ?? "",
      requirements: v.requirements ?? "",
      summary: v.summary ?? "",
      slug: v.slug,
      status: v.status,
      card: cardDefaultsFromVacancy(v),
      gepostOp: v.socialPosts[0]?.publishedAt?.toISOString() ?? null,
    }));

  return (
    <div className="space-y-5">
      <PaginaKop titel="LinkedIn-studio" sub="Kies een vacature → tekst en afbeelding staan klaar → kopiëren, downloaden en plaatsen." />
      <LinkedInStudio
        vacatures={vacatures}
        preselectId={vac}
        ogBase="/website/linkedin-afbeelding/og"
        contact={{
          companyName: settings.companyName || "Q4S",
          contactName: "",
          contactEmail: "cv@q4s.nl",
          contactPhone: "+31 6 83859566",
        }}
      />
    </div>
  );
}
