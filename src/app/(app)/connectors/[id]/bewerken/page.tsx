import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { ConnectorForm } from "../../ConnectorForm";
import { updateConnector } from "../../actions";

export const metadata = { title: "Connector bewerken" };

export default async function ConnectorBewerkenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const full = await db.vmsConnector.findUnique({ where: { id } });
  if (!full) notFound();
  // De API-key blijft op de server: client-props worden geserialiseerd, dus het
  // formulier krijgt alleen te weten óf er een key is.
  const { apiKey, ...connector } = full;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/connectors/${connector.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar connector
      </Link>
      <PageHeader title="Connector bewerken" description={connector.name} />
      <ConnectorForm
        action={updateConnector}
        connector={connector}
        hasApiKey={Boolean(apiKey)}
        submitLabel="Wijzigingen opslaan"
        cancelHref={`/connectors/${connector.id}`}
      />
    </div>
  );
}
