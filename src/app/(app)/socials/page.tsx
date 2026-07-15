import { db } from "@/lib/db";
import { getCompanySettings } from "@/lib/settings";
import { PageHeader } from "@/components/ui/page-header";
import { LinkedInGenerator, type VacancyOption } from "./LinkedInGenerator";

export const metadata = { title: "LinkedIn-generator" };
export const dynamic = "force-dynamic";

export default async function SocialsPage() {
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

  const options: VacancyOption[] = sorted.map((v) => ({
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="LinkedIn-vacaturegenerator"
        description="Genereer in één klik een vacaturepost in het vaste Q4S-format — tekst én beeld altijd hetzelfde, zodat iedereen meteen ziet: dat is Q4S."
      />
      <LinkedInGenerator
        vacancies={options}
        defaults={{
          companyName: settings.companyName || "Q4S",
          contactName: "",
          // Vaste recruitment-contactgegevens voor vacatureposts.
          contactEmail: "cv@q4s.nl",
          contactPhone: "+31 6 83859566",
        }}
        siteUrl={process.env.NEXT_PUBLIC_SITE_URL ?? ""}
      />
    </div>
  );
}
