import Link from "next/link";
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
      <Link
        href={`/kandidaten/${candidate.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar kandidaat
      </Link>
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
