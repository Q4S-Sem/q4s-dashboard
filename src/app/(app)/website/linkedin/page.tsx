import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { cardDefaultsFromVacancy, type LinkedInCardData } from "@/lib/linkedin-card";
import type { VacancyOption } from "../../socials/LinkedInGenerator";
import type { VacancyImageOption } from "./LinkedInImagePicker";
import { LinkedInTabs } from "./LinkedInTabs";

export const metadata = { title: "LinkedIn" };
export const dynamic = "force-dynamic";

export default async function WebsiteLinkedInPage({
  searchParams,
}: {
  searchParams: Promise<{ vac?: string; view?: string }>;
}) {
  const { vac, view } = await searchParams;
  const [vacancies, settings] = await Promise.all([
    db.vacancy.findMany({
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
        requirements: true,
        summary: true,
        slug: true,
        status: true,
      },
    }),
    getCompanySettings(),
  ]);

  // Gepubliceerde (live) vacatures bovenaan tonen.
  const sorted = [...vacancies].sort((a, b) => {
    const rank = (s: string) => (s === "PUBLISHED" ? 0 : 1);
    return rank(a.status) - rank(b.status);
  });

  const textOptions: VacancyOption[] = sorted.map((v) => ({
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
  }));

  const imageOptions: VacancyImageOption[] = sorted.map((v) => ({
    id: v.id,
    label: v.title,
    status: v.status,
    card: cardDefaultsFromVacancy(v) as LinkedInCardData,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="LinkedIn"
        description="Maak in het vaste Q4S-format een LinkedIn-post: schakel tussen de vacaturetekst en de afbeelding."
      />
      <LinkedInTabs
        initialView={view === "afbeelding" ? "afbeelding" : "tekst"}
        preselectId={vac}
        textOptions={textOptions}
        imageOptions={imageOptions}
        textDefaults={{
          companyName: settings.companyName || "Q4S",
          contactName: "",
          // Vaste recruitment-contactgegevens voor vacatureposts.
          contactEmail: "cv@q4s.nl",
          contactPhone: "+31 6 83859566",
        }}
        siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
        ogBase="/website/linkedin-afbeelding/og"
      />
    </div>
  );
}
