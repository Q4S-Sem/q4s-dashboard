import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { OpportunityForm } from "../../OpportunityForm";
import { updateOpportunity } from "../../actions";

export const metadata = { title: "Marktkans bewerken" };

export default async function MarktkansBewerkenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const opportunity = await db.opportunity.findUnique({ where: { id } });
  if (!opportunity) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href={`/marktkansen/${opportunity.id}`}>
        Terug naar kans
      </BackLink>
      <PageHeader title="Marktkans bewerken" description={opportunity.title} />
      <OpportunityForm
        action={updateOpportunity}
        opportunity={opportunity}
        submitLabel="Wijzigingen opslaan"
        cancelHref={`/marktkansen/${opportunity.id}`}
      />
    </div>
  );
}
