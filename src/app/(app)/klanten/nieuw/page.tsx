import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { ClientForm } from "../ClientForm";
import { createClient } from "../actions";

export const metadata = { title: "Nieuwe klant" };

export default async function NieuweKlantPage() {
  const clients = await db.client.findMany({
    orderBy: { companyName: "asc" },
    select: { id: true, companyName: true },
  });
  const existingClients = clients.map((c) => ({ id: c.id, name: c.companyName }));

  return (
    <div className="space-y-6">
      <Link
        href="/klanten"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar klanten
      </Link>
      <PageHeader title="Nieuwe klant" description="Voeg een nieuwe klant toe." />
      <ClientForm
        action={createClient}
        existingClients={existingClients}
        submitLabel="Klant opslaan"
        cancelHref="/klanten"
      />
    </div>
  );
}
