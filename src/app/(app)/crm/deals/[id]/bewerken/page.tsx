import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { DealForm } from "../../DealForm";
import { updateDeal } from "../../actions";
import { loadDealFormOptions } from "../../options";

export const metadata = { title: "Deal bewerken" };
export const dynamic = "force-dynamic";

export default async function EditDealPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [deal, opts] = await Promise.all([db.deal.findUnique({ where: { id } }), loadDealFormOptions()]);
  if (!deal) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/crm/deals/${deal.id}`} className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Terug naar deal
      </Link>
      <PageHeader title="Deal bewerken" description={deal.title} />
      <DealForm
        action={updateDeal}
        deal={deal}
        submitLabel="Wijzigingen opslaan"
        cancelHref={`/crm/deals/${deal.id}`}
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
