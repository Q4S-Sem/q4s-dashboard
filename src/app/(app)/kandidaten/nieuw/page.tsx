import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { SPOOR, spoorVan } from "@/lib/spoor";
import { CandidateForm } from "../CandidateForm";
import { createCandidate } from "../actions";

export const metadata = { title: "Nieuwe kandidaat" };

export default async function NieuweKandidaatPage({ searchParams }: { searchParams: Promise<{ spoor?: string }> }) {
  const spoor = spoorVan((await searchParams).spoor);
  const terug = SPOOR[spoor].alle;
  return (
    <div className="space-y-6">
      <BackLink href={terug}>Terug naar kandidaten</BackLink>
      <PageHeader title="Nieuwe kandidaat" description={`${SPOOR[spoor].label} — lees een CV automatisch in, of vul de gegevens handmatig in.`} />
      <CandidateForm action={createCandidate} submitLabel="Kandidaat opslaan" cancelHref={terug} showCvIntake spoor={spoor} />
    </div>
  );
}
