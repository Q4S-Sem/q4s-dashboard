import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { DealForm } from "../DealForm";
import { createDeal } from "../actions";
import { loadDealFormOptions } from "../options";

export const metadata = { title: "Nieuwe kans" };
export const dynamic = "force-dynamic";

export default async function NewDealPage({
  searchParams,
}: {
  searchParams: Promise<{ company?: string }>;
}) {
  const sp = await searchParams;
  const defaultCompany = sp.company?.trim() || "";
  const opts = await loadDealFormOptions();

  return (
    <div className="space-y-6">
      <BackLink href="/crm/kansen">Terug naar kansen</BackLink>
      <PageHeader
        title="Nieuwe kans"
        description="Leg een kans vast: een bedrijf waar (binnenkort) een vacature ingevuld moet worden. Nog geen kandidaat nodig — koppel die later vanuit de talentpool."
      />
      <DealForm
        action={createDeal}
        submitLabel="Kans vastleggen"
        cancelHref="/crm/kansen"
        currentRecruiterId={opts.currentId}
        stages={opts.stages}
        recruiters={opts.recruiters}
        targets={opts.targets}
        clients={opts.clients}
        companies={opts.companies}
        vacancies={opts.vacancies}
        contacts={opts.contacts}
        defaultCompany={defaultCompany}
      />
    </div>
  );
}
