import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { CandidateForm } from "../CandidateForm";
import { createCandidate } from "../actions";

export const metadata = { title: "Nieuwe kandidaat" };

export default function NieuweKandidaatPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/kandidaten"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar kandidaten
      </Link>
      <PageHeader title="Nieuwe kandidaat" description="Voeg een nieuwe kandidaat toe." />
      <CandidateForm
        action={createCandidate}
        submitLabel="Kandidaat opslaan"
        cancelHref="/kandidaten"
      />
    </div>
  );
}
