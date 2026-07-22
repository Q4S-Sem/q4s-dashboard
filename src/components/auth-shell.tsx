import { getLogoSrc } from "@/lib/branding";

/**
 * Gedeelde split-screen voor de openbare auth-pagina's (login, wachtwoord vergeten,
 * wachtwoord herstellen). Links een gebrand zwart paneel met het Q4S-logo op een
 * wit vlak (het logo is zwart-op-wit en zou anders verdwijnen — zelfde signatuur
 * als de kop van het Q4S-CV). Rechts de inhoud (formulier). Onder lg klapt het naar
 * één kolom: het paneel verdwijnt en het logo staat boven de inhoud.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const logoSrc = getLogoSrc();
  const year = new Date().getFullYear();

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* LINKS — gebrand paneel */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#1c1c1c] to-[#0a0a0a] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div className="absolute -left-40 -top-40 h-[30rem] w-[30rem] rounded-full border border-white/[0.05]" />
          <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full border border-white/[0.05]" />
          <div className="absolute -bottom-52 -right-36 h-[38rem] w-[38rem] rounded-full bg-white/[0.025]" />
          <div className="absolute -bottom-32 -right-20 h-[24rem] w-[24rem] rounded-full border border-white/[0.04]" />
          <div className="absolute right-16 top-24 h-1.5 w-1.5 rounded-full bg-white/25" />
          <div className="absolute right-28 top-40 h-1 w-1 rounded-full bg-white/15" />
          <div className="absolute left-1/3 top-16 h-1 w-1 rounded-full bg-white/10" />
        </div>

        <div className="relative">
          {logoSrc ? (
            <span className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-3 shadow-lg shadow-black/20">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} alt="Q4S Project Partners" className="h-9 w-auto object-contain" />
            </span>
          ) : (
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-lg font-bold text-neutral-900">
              Q4S
            </span>
          )}
        </div>

        <div className="relative max-w-md">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-white/45">
            Q4S Project Partners
          </p>
          <h2 className="text-3xl font-bold leading-[1.15] tracking-tight text-white xl:text-[2.6rem]">
            Eén dashboard voor de hele Q4S-operatie.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-white/55">
            Uren, facturatie, recruitment en administratie — alles op één plek.
            Iedereen ziet direct wat er moet gebeuren.
          </p>
        </div>

        <p className="relative text-xs text-white/35">© {year} Q4S Project Partners</p>
      </aside>

      {/* RECHTS — inhoud */}
      <main className="flex items-center justify-center bg-white px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          {logoSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt="Q4S Project Partners"
              className="mb-8 h-11 w-auto object-contain lg:hidden"
            />
          )}

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          <p className="mt-1.5 text-sm text-slate-500">{subtitle}</p>

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-8 text-xs leading-relaxed text-slate-400">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
