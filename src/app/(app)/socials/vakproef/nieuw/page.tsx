import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ChallengeForm } from "../ChallengeForm";
import { createChallenge } from "../actions";

export const metadata = { title: "Nieuwe vakproef" };

export default function NieuweVakproefPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href="/socials/vakproef">
        Terug naar vakproef
      </BackLink>
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
