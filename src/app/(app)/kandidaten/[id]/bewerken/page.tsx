import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { CandidateForm } from "../../CandidateForm";
import { updateCandidate } from "../../actions";

export const metadata = { title: "Kandidaat bewerken" };

export default async function KandidaatBewerkenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const candidate = await db.candidate.findUnique({ where: { id } });
  if (!candidate) notFound();

  return (
    <div className="space-y-6">
      <BackLink href={`/kandidaten/${candidate.id}`}>
        Terug naar kandidaat
      </BackLink>
      <PageHeader
        title="Kandidaat bewerken"
        description={`${candidate.firstName} ${candidate.lastName}`}
      />
      <CandidateForm
        action={updateCandidate}
        candidate={candidate}
        submitLabel="Wijzigingen opslaan"
        cancelHref={`/kandidaten/${candidate.id}`}
      />
    </div>
  );
}
