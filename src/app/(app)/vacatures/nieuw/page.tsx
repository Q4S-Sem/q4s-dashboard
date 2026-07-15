import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { isAIConfigured } from "@/lib/ai";
import { PageHeader } from "@/components/ui/page-header";
import { VacancyForm } from "../VacancyForm";
import { createVacancy } from "../actions";

export const metadata = { title: "Nieuwe vacature" };

export default async function NieuweVacaturePage() {
  const [clients, discRows] = await Promise.all([
    db.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
    // Al eerder gebruikte (zelf toegevoegde) disciplines als extra suggesties.
    db.vacancy.findMany({
      where: { discipline: { not: null } },
      select: { discipline: true },
      distinct: ["discipline"],
    }),
  ]);
  const disciplineSuggestions = discRows.map((r) => r.discipline ?? "").filter(Boolean);

  return (
    <div className="space-y-6">
      <Link
        href="/vacatures"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar vacatures
      </Link>
      <PageHeader
        title="Nieuwe vacature"
        description="Voeg een binnengekomen vacature toe."
      />
      <VacancyForm
        action={createVacancy}
        clients={clients}
        disciplineSuggestions={disciplineSuggestions}
        submitLabel="Vacature opslaan"
        cancelHref="/vacatures"
        aiReady={isAIConfigured()}
      />
    </div>
  );
}
