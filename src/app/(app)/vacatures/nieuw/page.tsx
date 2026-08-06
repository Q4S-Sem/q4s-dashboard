import Link from "next/link";
import { BackLink } from "@/components/back-link";
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
      <BackLink href="/vacatures">
        Terug naar vacatures
      </BackLink>
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
