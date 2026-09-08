import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { currentUser, authRequired } from "@/lib/session";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Inloggen — Q4S" };
export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  // Al ingelogd? Door naar de app.
  if (await currentUser()) redirect("/");
  const { reset } = await searchParams;

  return (
    <AuthShell
      title="Inloggen"
      subtitle="Log in met je Q4S-werkaccount."
      footer={
        <span className="text-sm leading-relaxed text-ink-500">
          <Link
            href="/wachtwoord-vergeten"
            className="font-semibold text-ink-800 underline-offset-2 hover:text-ink-900 hover:underline"
          >
            Wachtwoord vergeten?
          </Link>{" "}
          — je krijgt een e-mail om een nieuw wachtwoord in te stellen. Alleen voor Q4S-medewerkers.
        </span>
      }
    >
      {reset === "1" && (
        <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
          Je wachtwoord is gewijzigd. Log in met je nieuwe wachtwoord.
        </p>
      )}

      <LoginForm />

      {!authRequired() && (
        <Link
          href="/"
          className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-ink-200 bg-white px-4 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50"
        >
          Doorgaan zonder inloggen <ArrowRight className="h-4 w-4" />
        </Link>
      )}
    </AuthShell>
  );
}
