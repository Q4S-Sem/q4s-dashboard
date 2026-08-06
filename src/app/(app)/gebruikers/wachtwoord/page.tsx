import { redirect } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { currentUser } from "@/lib/session";
import { PasswordForm } from "./PasswordForm";

export const metadata = { title: "Mijn wachtwoord" };
export const dynamic = "force-dynamic";

export default async function WachtwoordPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href="/gebruikers">Terug naar gebruikers</BackLink>

      <PageHeader
        title="Mijn wachtwoord"
        description="Kies een nieuw wachtwoord en bevestig met de code die we naar je e-mail sturen."
      />

      <PasswordForm email={user.email} />
    </div>
  );
}
