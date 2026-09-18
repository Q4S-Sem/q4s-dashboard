import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { cardDefaultsFromVacancy, type LinkedInCardData } from "@/lib/linkedin-card";
import { LinkedInImagePicker, type VacancyImageOption } from "./LinkedInImagePicker";

export const metadata = { title: "LinkedIn-afbeelding" };
export const dynamic = "force-dynamic";

export default async function WebsiteLinkedInImagePage({
  searchParams,
}: {
  searchParams: Promise<{ vac?: string }>;
}) {
  const { vac } = await searchParams;
  const vacancies = await db.vacancy.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      discipline: true,
      location: true,
      employmentType: true,
      salary: true,
      responsibilities: true,
      summary: true,
      status: true,
    },
  });

  // Gepubliceerde vacatures bovenaan.
  const sorted = [...vacancies].sort((a, b) => {
    const rank = (s: string) => (s === "PUBLISHED" ? 0 : 1);
    return rank(a.status) - rank(b.status);
  });

  const options: VacancyImageOption[] = sorted.map((v) => ({
    id: v.id,
    label: v.title,
    status: v.status,
    card: cardDefaultsFromVacancy(v) as LinkedInCardData,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="LinkedIn-afbeelding"
        description="Kies een vacature en maak in de vaste Q4S-huisstijl een LinkedIn-afbeelding (1080×1080). Alle tekst is aanpasbaar; het logo en de opmaak liggen vast."
      />
      <LinkedInImagePicker
        vacancies={options}
        preselectId={vac}
        ogBase="/website/linkedin-afbeelding/og"
      />
    </div>
  );
}
