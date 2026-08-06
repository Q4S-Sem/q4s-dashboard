import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { ClientForm } from "../../ClientForm";
import { updateClient } from "../../actions";

export const metadata = { title: "Klant bewerken" };

export default async function KlantBewerkenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const client = await db.client.findUnique({ where: { id } });
  if (!client) notFound();

  const clients = await db.client.findMany({
    orderBy: { companyName: "asc" },
    select: { id: true, companyName: true },
  });
  const existingClients = clients.map((c) => ({ id: c.id, name: c.companyName }));

  return (
    <div className="space-y-6">
      <BackLink href={`/klanten/${client.id}`}>
        Terug naar klant
      </BackLink>
      <PageHeader title="Klant bewerken" description={client.companyName} />
      <ClientForm
        action={updateClient}
        client={client}
        submitLabel="Wijzigingen opslaan"
        cancelHref={`/klanten/${client.id}`}
      />
    </div>
  );
}
