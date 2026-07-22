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
  const year = new Date().getFullYear();

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* LINKS — gebrand zwart paneel (alleen op groot scherm). Het Q4S-logo is
          zwart-op-wit en staat daarom op een wit vlak, precies zoals in de kop van
          het Q4S-CV: zo blijft het herkenbaar in plaats van te verdwijnen. */}
      <aside className="relative hidden overflow-hidden bg-brand-600 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        {/* Subtiele geometrische accenten — monochroom, laag contrast. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 -top-40 h-[28rem] w-[28rem] rounded-full border border-white/[0.06]" />
          <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full border border-white/[0.06]" />
          <div className="absolute -bottom-48 -right-32 h-[34rem] w-[34rem] rounded-full bg-white/[0.03]" />
          <div className="absolute right-16 top-24 h-1.5 w-1.5 rounded-full bg-white/20" />
          <div className="absolute right-28 top-40 h-1 w-1 rounded-full bg-white/10" />
        </div>

        {/* Logo op een wit badge, linksboven. */}
        <div className="relative">
          {logoSrc ? (
            <span className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 shadow-sm">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} alt="Q4S Project Partners" className="h-9 w-auto object-contain" />
            </span>
          ) : (
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-lg font-bold text-brand-600">
              Q4S
            </span>
          )}
        </div>

        {/* Pay-off. */}
        <div className="relative max-w-md">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
            Q4S Project Partners
          </p>
          <h2 className="text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
            Eén dashboard voor de hele Q4S-operatie.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/60">
            Uren, facturatie, recruitment en administratie — alles op één plek.
            Iedereen ziet direct wat er moet gebeuren.
          </p>
        </div>

        {/* Voettekst. */}
        <p className="relative text-xs text-white/40">© {year} Q4S Project Partners</p>
      </aside>

      {/* RECHTS — het inlogformulier. */}
      <main className="flex items-center justify-center bg-slate-50 px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          {/* Logo — alleen op klein scherm zichtbaar (links paneel is dan verborgen). */}
          {logoSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt="Q4S Project Partners"
              className="mb-8 h-11 w-auto object-contain lg:hidden"
            />
          )}

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Inloggen</h1>
          <p className="mt-1.5 text-sm text-slate-500">Log in met je Q4S-werkaccount.</p>

          <div className="mt-8">
            <LoginForm />
          </div>

          {!authRequired() && (
            <Link
              href="/"
              className="mt-3 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Doorgaan zonder inloggen <ArrowRight className="h-4 w-4" />
            </Link>
          )}

          <p className="mt-8 text-xs leading-relaxed text-slate-400">
            Alleen voor Q4S-medewerkers. Geen toegang of wachtwoord vergeten? Vraag een beheerder
            om een account of een nieuw wachtwoord.
          </p>
        </div>
      </main>
    </div>
  );
}
