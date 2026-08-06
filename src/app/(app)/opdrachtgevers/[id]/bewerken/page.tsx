import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { TargetClientForm } from "../../TargetClientForm";
import { updateTargetClient } from "../../actions";

export const metadata = { title: "Opdrachtgever bewerken" };

export default async function OpdrachtgeverBewerkenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [target, connectors] = await Promise.all([
    db.targetClient.findUnique({ where: { id } }),
    db.vmsConnector.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);
  if (!target) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href={`/opdrachtgevers/${target.id}`}>
        Terug naar opdrachtgever
      </BackLink>
      <PageHeader title="Opdrachtgever bewerken" description={target.name} />
      <TargetClientForm
        action={updateTargetClient}
        target={target}
        connectors={connectors}
        submitLabel="Wijzigingen opslaan"
        cancelHref={`/opdrachtgevers/${target.id}`}
      />
    </div>
  );
}
