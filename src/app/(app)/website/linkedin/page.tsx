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
    db.vacancy.findMany({
      orderBy: { createdAt: "desc" },
      take: 150,
      select: {
        id: true, title: true, discipline: true, location: true, employmentType: true, salary: true,
        responsibilities: true, requirements: true, summary: true, slug: true, status: true,
      },
    }),
    getCompanySettings(),
  ]);

  // Live (gepubliceerde) vacatures bovenaan, verder nieuwste eerst.
  const vacatures: StudioVacature[] = [...vacancies]
    .sort((a, b) => Number(b.status === "PUBLISHED") - Number(a.status === "PUBLISHED"))
    .map((v) => ({
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
