import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { GebruikerForm } from "../GebruikerForm";
import { createUser } from "../actions";

export const metadata = { title: "Nieuwe gebruiker" };

export default function NieuweGebruikerPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackLink href="/gebruikers">
        Terug naar gebruikers
      </BackLink>
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
