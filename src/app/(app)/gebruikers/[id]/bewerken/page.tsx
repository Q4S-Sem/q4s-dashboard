import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { GebruikerForm } from "../../GebruikerForm";
import { updateUser } from "../../actions";

export const metadata = { title: "Gebruiker bewerken" };

export default async function GebruikerBewerkenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await db.appUser.findUnique({ where: { id } });
  if (!user) notFound();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link
        href="/gebruikers"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar gebruikers
      </Link>
      <PageHeader title="Gebruiker bewerken" description={user.name} />
      <GebruikerForm
        action={updateUser}
        user={user}
        submitLabel="Wijzigingen opslaan"
        cancelHref="/gebruikers"
      />
    </div>
  );
}
