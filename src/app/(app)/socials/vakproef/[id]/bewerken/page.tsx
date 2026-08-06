import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { ChallengeForm } from "../../ChallengeForm";
import { updateChallenge } from "../../actions";

export const metadata = { title: "Vakproef bewerken" };

export default async function VakproefBewerkenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const challenge = await db.challenge.findUnique({ where: { id } });
  if (!challenge) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href={`/socials/vakproef/${challenge.id}`}>
        Terug naar vakproef
      </BackLink>
      <PageHeader title="Vakproef bewerken" />
      <ChallengeForm
        action={updateChallenge}
        challenge={challenge}
        submitLabel="Wijzigingen opslaan"
        cancelHref={`/socials/vakproef/${challenge.id}`}
      />
    </div>
  );
}
