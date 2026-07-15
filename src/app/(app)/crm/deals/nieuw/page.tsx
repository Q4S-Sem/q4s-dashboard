import Link from "next/link";
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
      <Link href="/crm" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Terug naar CRM
      </Link>
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
