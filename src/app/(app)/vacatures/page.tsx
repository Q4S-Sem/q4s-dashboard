import Link from "next/link";
import { FileText, Plus, Upload, Eye, Rocket, PencilRuler, Filter } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatCard } from "@/components/ui/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { VacancyWorkList, type WorkVacancy } from "./VacancyWorkList";

export const metadata = { title: "Vacatures" };
export const dynamic = "force-dynamic";

// De secties die een vacature nodig heeft voor een volwaardige pagina op de
// website ("Over de functie", "Werkzaamheden", "Functie-eisen").
const WEBSITE_FIELDS = ["summary", "responsibilities", "requirements"] as const;

export default async function VacaturesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const sp = await searchParams;
  const vacancies = await db.vacancy.findMany({
    orderBy: { createdAt: "desc" },
    include: { vmsConnector: { select: { name: true } } },
  });

  const rows: WorkVacancy[] = vacancies.map((v) => ({
    id: v.id,
    title: v.title,
    slug: v.slug,
    discipline: v.discipline,
    location: v.location,
    companyName: v.companyName,
    sourceName: v.vmsConnector?.name ?? null,
    status: v.status,
    views: v.views ?? 0,
    publishedAt: v.publishedAt ? v.publishedAt.toISOString() : null,
    createdAt: v.createdAt.toISOString(),
    filled: WEBSITE_FIELDS.filter((f) => (v[f] ?? "").trim().length > 0).length,
    total: WEBSITE_FIELDS.length,
  }));

  const total = rows.length;
  const live = rows.filter((v) => v.status === "PUBLISHED").length;
  const todo = total - live;
  const incomplete = rows.filter((v) => v.filled < v.total).length;
  const totalViews = rows.reduce((s, v) => s + v.views, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vacatures"
        description="Alle vacatures op één plek: aanvullen wat nog mist en met één klik naar de website sturen."
        actions={
          <>
            <Link href="/vacaturehub" className={buttonVariants({ variant: "outline" })}>
              <Filter className="h-4 w-4" /> Vacaturehub
            </Link>
            <Link href="/vacatures/importeren" className={buttonVariants({ variant: "outline" })}>
              <Upload className="h-4 w-4" /> Importeren
            </Link>
            <Link href="/vacatures/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe vacature
            </Link>
          </>
        }
      />

      {sp.error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze vacature kan op dit moment niet verwijderd worden.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Vacatures totaal"
          value={total}
          icon={<FileText className="h-5 w-5" />}
          accent="slate"
        />
        <StatCard
          label="Live op de site"
          value={live}
          sub="zichtbaar op q4s.nl"
          accent="green"
          icon={<Rocket className="h-5 w-5" />}
        />
        <StatCard
          label="Nog te versturen"
          value={todo}
          sub={incomplete > 0 ? `${incomplete} nog niet compleet` : "allemaal compleet"}
          accent={todo > 0 ? "amber" : "slate"}
          icon={<PencilRuler className="h-5 w-5" />}
        />
        <StatCard
          label="Weergaven via website"
          value={totalViews}
          sub="kliks op gepubliceerde vacatures"
          accent="slate"
          icon={<Eye className="h-5 w-5" />}
        />
      </div>

      {total === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="Nog geen vacatures"
          description="Voeg een binnengekomen vacature toe en laat de AI deze uitschrijven en verbeteren."
          action={
            <Link href="/vacatures/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe vacature
            </Link>
          }
        />
      ) : (
        <VacancyWorkList vacancies={rows} />
      )}
    </div>
  );
}
