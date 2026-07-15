import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { isAIConfigured } from "@/lib/ai";
import { PageHeader } from "@/components/ui/page-header";
import { VacancyForm } from "../../VacancyForm";
import { updateVacancy } from "../../actions";

export const metadata = { title: "Vacature bewerken" };

export default async function VacatureBewerkenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [vacancy, clients, discRows] = await Promise.all([
    db.vacancy.findUnique({ where: { id } }),
    db.client.findMany({
      orderBy: { companyName: "asc" },
      select: { id: true, companyName: true },
    }),
    db.vacancy.findMany({
      where: { discipline: { not: null } },
      select: { discipline: true },
      distinct: ["discipline"],
    }),
  ]);
  if (!vacancy) notFound();
  const disciplineSuggestions = discRows.map((r) => r.discipline ?? "").filter(Boolean);

  return (
    <div className="space-y-6">
      <Link
        href={`/vacatures/${vacancy.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar vacature
      </Link>
      <PageHeader title="Vacature bewerken" description={vacancy.title} />
      <VacancyForm
        action={updateVacancy}
        vacancy={vacancy}
        clients={clients}
        disciplineSuggestions={disciplineSuggestions}
        submitLabel="Wijzigingen opslaan"
        cancelHref={`/vacatures/${vacancy.id}`}
        aiReady={isAIConfigured()}
      />
    </div>
  );
}
