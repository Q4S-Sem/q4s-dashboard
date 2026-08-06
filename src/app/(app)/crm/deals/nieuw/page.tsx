import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { DealForm } from "../DealForm";
import { createDeal } from "../actions";
import { loadDealFormOptions } from "../options";

export const metadata = { title: "Nieuwe deal" };
export const dynamic = "force-dynamic";

export default async function NewDealPage() {
  const opts = await loadDealFormOptions();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href="/crm">
        Terug naar CRM
      </BackLink>
      <PageHeader
        title="Nieuwe deal"
        description="Een kans om een openstaande vacature van een opdrachtgever in te vullen."
      />
      <DealForm
        action={createDeal}
        submitLabel="Deal aanmaken"
        cancelHref="/crm"
        currentRecruiterId={opts.currentId}
        stages={opts.stages}
        recruiters={opts.recruiters}
        targets={opts.targets}
        clients={opts.clients}
        vacancies={opts.vacancies}
        contacts={opts.contacts}
      />
    </div>
  );
}
