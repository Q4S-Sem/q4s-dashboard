import Link from "next/link";
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
      <Link
        href={`/socials/vakproef/${challenge.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar vakproef
      </Link>
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
