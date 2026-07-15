import Link from "next/link";
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

  return (
    <div className="space-y-6">
      <Link
        href={`/klanten/${client.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar klant
      </Link>
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
