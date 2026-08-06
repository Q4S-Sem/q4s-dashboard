import Link from "next/link";
import { BackLink } from "@/components/back-link";
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
      <BackLink href={`/vacatures/${vacancy.id}`}>
        Terug naar vacature
      </BackLink>
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
