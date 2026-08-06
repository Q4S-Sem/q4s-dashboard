import Link from "next/link";
import { BackLink } from "@/components/back-link";
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
      <BackLink href={`/connectors/${connector.id}`}>
        Terug naar connector
      </BackLink>
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
