import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { currentUser, authRequired } from "@/lib/session";
import { getLogoSrc } from "@/lib/branding";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Inloggen — Q4S" };
export const dynamic = "force-dynamic";

export default async function LoginPage() {
  // Al ingelogd? Door naar de app.
  if (await currentUser()) redirect("/");

  const logoSrc = getLogoSrc();

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          {logoSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt="Q4S Project Partners"
              className="mx-auto mb-4 h-14 w-auto object-contain"
            />
          ) : (
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900 text-lg font-bold text-white">
              Q4S
            </div>
          )}
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Inloggen</h1>
          <p className="mt-1 text-sm text-slate-500">Log in op het Q4S-dashboard.</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm />
        </div>

        {!authRequired() && (
          <Link
            href="/"
            className="mt-3 flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Doorgaan zonder inloggen <ArrowRight className="h-4 w-4" />
          </Link>
        )}

        <p className="mt-4 text-center text-xs text-slate-400">
          Alleen voor Q4S-medewerkers. Wachtwoord vergeten? Vraag een beheerder.
        </p>
      </div>
    </div>
  );
}
