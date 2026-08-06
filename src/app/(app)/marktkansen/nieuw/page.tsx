import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { OpportunityForm } from "../OpportunityForm";
import { createOpportunity } from "../actions";

export const metadata = { title: "Nieuwe marktkans" };

export default function NieuweMarktkansPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href="/marktkansen">
        Terug naar marktkansen
      </BackLink>
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
