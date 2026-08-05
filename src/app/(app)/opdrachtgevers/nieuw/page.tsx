import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { TargetClientForm } from "../TargetClientForm";
import { createTargetClient } from "../actions";

export const metadata = { title: "Nieuwe opdrachtgever" };

export default async function NieuweOpdrachtgeverPage() {
  const connectors = await db.vmsConnector.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/opdrachtgevers"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar opdrachtgevers
      </Link>
      <PageHeader
        title="Nieuwe opdrachtgever"
        description="Voeg een doelbedrijf toe aan de acquisitie-roadmap."
      />
      <TargetClientForm
        action={createTargetClient}
        connectors={connectors}
        submitLabel="Opdrachtgever opslaan"
        cancelHref="/opdrachtgevers"
      />
    </div>
  );
}
