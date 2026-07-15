import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { OpportunityForm } from "../OpportunityForm";
import { createOpportunity } from "../actions";

export const metadata = { title: "Nieuwe marktkans" };

export default function NieuweMarktkansPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/marktkansen"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar marktkansen
      </Link>
      <PageHeader
        title="Nieuwe marktkans"
        description="Voeg handmatig een nieuwe groeikans toe."
      />
      <OpportunityForm
        action={createOpportunity}
        submitLabel="Kans opslaan"
        cancelHref="/marktkansen"
      />
    </div>
  );
}
