import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ChallengeForm } from "../ChallengeForm";
import { createChallenge } from "../actions";

export const metadata = { title: "Nieuwe vakproef" };

export default function NieuweVakproefPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/socials/vakproef"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar vakproef
      </Link>
      <PageHeader
        title="Nieuwe vakproef"
        description="Maak een vakinhoudelijke challenge. Zet 'm op ACTIEF om 'm publiek te delen."
      />
      <ChallengeForm
        action={createChallenge}
        submitLabel="Vakproef opslaan"
        cancelHref="/socials/vakproef"
      />
    </div>
  );
}
