import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { DealForm } from "../../../deals/DealForm";
import { updateDeal } from "../../../deals/actions";
import { loadDealFormOptions } from "../../../deals/options";

export const metadata = { title: "Vacature bewerken" };
export const dynamic = "force-dynamic";

/**
 * Zelfde bewerkformulier als /crm/deals/[id]/bewerken, maar in de
 * vacature-context: Terug/Annuleren en Opslaan blijven op /crm/vacatures.
 */
export default async function EditVacaturePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [deal, opts] = await Promise.all([db.deal.findUnique({ where: { id } }), loadDealFormOptions(id)]);
  if (!deal) notFound();

  const isPlaatsing = Boolean(deal.candidateId);
  const titel = isPlaatsing ? "Plaatsing bewerken" : "Vacature bewerken";

  return (
    <div className="space-y-6">
      <BackLink href={`/crm/vacatures/${deal.id}`}>
        Terug naar vacature
      </BackLink>
      <PageHeader title={titel} description={deal.title} />
      <DealForm
        action={updateDeal}
        deal={deal}
        submitLabel="Wijzigingen opslaan"
        cancelHref={`/crm/vacatures/${deal.id}`}
        returnTo={`/crm/vacatures/${deal.id}`}
        currentRecruiterId={opts.currentId}
        stages={opts.stages}
        recruiters={opts.recruiters}
        targets={opts.targets}
        clients={opts.clients}
        companies={opts.companies}
        vacancies={opts.vacancies}
        vacatureDeals={opts.vacatureDeals}
        contacts={opts.contacts}
      />
    </div>
  );
}
