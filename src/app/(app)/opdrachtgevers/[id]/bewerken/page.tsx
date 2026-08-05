import Link from "next/link";
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
      <Link
        href={`/opdrachtgevers/${target.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar opdrachtgever
      </Link>
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
