import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthShell } from "@/components/auth-shell";
import { userIdForToken } from "@/lib/password-reset";
import { ResetForm } from "./ResetForm";

export const metadata = { title: "Nieuw wachtwoord — Q4S" };
export const dynamic = "force-dynamic";

export default async function ResetPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const valid = token ? (await userIdForToken(token)) !== null : false;

  if (!valid) {
    return (
      <AuthShell
        title="Link verlopen"
        subtitle="Deze herstel-link is verlopen, al gebruikt of ongeldig."
      >
        <div className="space-y-4">
          <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Vraag een nieuwe herstel-link aan — die is opnieuw een uur geldig.
          </p>
          <Link
            href="/wachtwoord-vergeten"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-ink-600 hover:text-ink-900"
          >
            <ArrowLeft className="h-4 w-4" /> Nieuwe link aanvragen
          </Link>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Nieuw wachtwoord" subtitle="Kies een nieuw wachtwoord voor je Q4S-account.">
      <ResetForm token={token!} />
    </AuthShell>
  );
}
