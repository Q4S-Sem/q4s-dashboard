import Link from "next/link";
import { FileText, Sparkles, PencilRuler, Eye, Plus, ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { DISCIPLINES, labelFor } from "@/lib/domain";
import { WebsiteVacaturesList, type VacancyRow } from "./WebsiteVacaturesList";

export const metadata = { title: "Vacatures — Website" };
export const dynamic = "force-dynamic";

export default async function WebsiteVacaturesPage() {
  const vacancies = await db.vacancy.findMany({ orderBy: [{ createdAt: "desc" }] });

  const rows: VacancyRow[] = vacancies.map((v) => ({
    id: v.id,
    title: v.title,
    disciplineRaw: v.discipline ?? "",
    disciplineLabel: v.discipline ? labelFor(DISCIPLINES, v.discipline) : "",
    location: v.location ?? "",
    company: v.companyName ?? "",
    status: v.status,
    views: v.views ?? 0,
    publishedAt: v.publishedAt ? v.publishedAt.toISOString() : null,
    createdAt: v.createdAt.toISOString(),
    slug: v.slug,
    sourcing: v.sourcing,
  }));

  const published = rows.filter((r) => r.status === "PUBLISHED").length;
  const concept = rows.filter((r) => r.status === "CONCEPT" || r.status === "IMPROVED").length;
  const totalViews = rows.reduce((s, r) => s + r.views, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vacatures"
        description="Alle vacatures voor de website op één plek — sorteer en filter op status of discipline, publiceer, pauzeer of haal ze offline."
        actions={
          <div className="flex gap-2">
            <Link href="/website" className={buttonVariants({ variant: "outline" })}>
              <ArrowLeft className="h-4 w-4" /> Terug
            </Link>
            <Link href="/vacatures/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe vacature
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Vacatures totaal" value={rows.length} icon={<FileText className="h-5 w-5" />} accent="brand" />
        <StatCard label="Live op de site" value={published} icon={<Sparkles className="h-5 w-5" />} accent="green" />
        <StatCard label="Concept" value={concept} icon={<PencilRuler className="h-5 w-5" />} accent="slate" />
        <StatCard label="Weergaven" value={totalViews} sub="kliks op vacatures" icon={<Eye className="h-5 w-5" />} accent="violet" />
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent>
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="Nog geen vacatures"
              description="Maak je eerste vacature aan; laat AI hem uitschrijven en publiceer hem op de website."
            />
          </CardContent>
        </Card>
      ) : (
        <WebsiteVacaturesList rows={rows} />
      )}
    </div>
  );
}
