import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { currentUser } from "@/lib/session";
import { navTree } from "@/components/nav";
import { GebruikerForm } from "../../GebruikerForm";
import { updateUser } from "../../actions";
import { PasswordForm } from "../../PasswordForm";

export const metadata = { title: "Gebruiker bewerken" };
export const dynamic = "force-dynamic";

/** JSON-array uit de DB lezen; kapot/leeg → lege lijst. */
function parseList(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

export default async function GebruikerBewerkenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [user, me] = await Promise.all([
    db.appUser.findUnique({ where: { id } }),
    currentUser(),
  ]);
  if (!user) notFound();

  // Je eigen wachtwoord wijzig je hier, met de bevestiging per e-mail. Bij een
  // ander account blijft het directe wachtwoordveld in het formulier staan —
  // een beheerder moet een collega kunnen helpen die buitengesloten is.
  const isSelf = me?.id === user.id;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href="/gebruikers">Terug naar gebruikers</BackLink>
      <PageHeader title="Gebruiker bewerken" description={user.name} />

      <GebruikerForm
        action={updateUser}
        user={user}
        isSelf={isSelf}
        submitLabel="Wijzigingen opslaan"
        cancelHref="/gebruikers"
        navTree={navTree()}
        initialHubs={parseList(user.allowedHubs)}
        initialPages={parseList(user.allowedPages)}
      />

      {isSelf && <PasswordForm email={user.email} />}
    </div>
  );
}
