import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { DealForm } from "../../deals/DealForm";
import { createDeal } from "../../deals/actions";
import { loadDealFormOptions } from "../../deals/options";

export const metadata = { title: "Nieuwe vacature" };
export const dynamic = "force-dynamic";

export default async function NewVacaturePage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const sp = await searchParams;
  const defaultCompany = sp.company?.trim() || "";
  const opts = await loadDealFormOptions();

  return (
    <div className="space-y-6">
      <BackLink href="/crm/vacatures">Terug naar vacatures</BackLink>
      <PageHeader
        title="Nieuwe vacature"
        description="Lees een vacature in (bestand, foto of link) of vul hem zelf in. In vier korte stappen; opslaan kan altijd."
      />
      <DealForm
        action={createDeal}
        submitLabel="Vacature vastleggen"
        cancelHref="/crm/vacatures"
        currentRecruiterId={opts.currentId}
        stages={opts.stages}
        recruiters={opts.recruiters}
        targets={opts.targets}
        clients={opts.clients}
        companies={opts.companies}
        vacancies={opts.vacancies}
        vacatureDeals={opts.vacatureDeals}
        contacts={opts.contacts}
        defaultCompany={defaultCompany}
      />
    </div>
  );
}
