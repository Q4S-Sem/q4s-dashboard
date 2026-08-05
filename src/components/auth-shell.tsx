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
      <aside className="relative hidden overflow-hidden bg-gradient-to-br from-[#242320] to-[#0a0a0a] lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        {/* Industriële textuur: fijne raster-lijnen + een oranje gloed, zoals de
            hero-foto op q4s.nl. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />
          <div className="absolute -bottom-40 -right-32 h-[34rem] w-[34rem] rounded-full bg-brand-600/20 blur-3xl" />
          <div className="absolute -left-24 top-1/4 h-72 w-72 rounded-full bg-brand-600/10 blur-3xl" />
        </div>

        <div className="relative">
          {logoSrc ? (
            <span className="inline-flex items-center justify-center rounded-sm bg-white px-4 py-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} alt="Q4S Project Partners" className="h-9 w-auto object-contain" />
            </span>
          ) : (
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-sm bg-brand-600 text-lg font-black text-white">
              Q4S
            </span>
          )}
        </div>

        <div className="relative max-w-md">
          <p className="mb-4 text-[11px] font-bold uppercase tracking-[0.25em] text-brand-500">
            Q4S Project Partners
          </p>
          <h2 className="text-[2.6rem] font-black leading-[0.98] tracking-[-0.035em] text-white xl:text-[3.1rem]">
            Eén dashboard voor de hele Q4S-operatie.
          </h2>
          <span className="mt-6 block h-[3px] w-10 bg-brand-600" />
          <p className="mt-6 text-base leading-relaxed text-white/55">
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

          <h1 className="q4s-display text-[28px]">{title}</h1>
          <span className="q4s-rule mt-3" />
          <p className="mt-3 text-sm text-ink-500">{subtitle}</p>

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-8 text-xs leading-relaxed text-ink-400">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
