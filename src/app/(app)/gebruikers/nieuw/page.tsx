import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { GebruikerForm } from "../GebruikerForm";
import { createUser } from "../actions";

export const metadata = { title: "Nieuwe gebruiker" };

export default function NieuweGebruikerPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/gebruikers"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar gebruikers
      </Link>
      <PageHeader
        title="Nieuwe gebruiker"
        description="Voeg een medewerker toe die met het dashboard werkt."
      />
      <GebruikerForm
        action={createUser}
        submitLabel="Gebruiker opslaan"
        cancelHref="/gebruikers"
      />
    </div>
  );
}
