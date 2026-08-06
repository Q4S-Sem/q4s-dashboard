import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { CandidateForm } from "../CandidateForm";
import { createCandidate } from "../actions";

export const metadata = { title: "Nieuwe kandidaat" };

export default function NieuweKandidaatPage() {
  return (
    <div className="space-y-6">
      <BackLink href="/kandidaten">
        Terug naar kandidaten
      </BackLink>
      <PageHeader title="Nieuwe kandidaat" description="Voeg een nieuwe kandidaat toe." />
      <CandidateForm
        action={createCandidate}
        submitLabel="Kandidaat opslaan"
        cancelHref="/kandidaten"
      />
    </div>
  );
}
