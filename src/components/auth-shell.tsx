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
        {/* Industriële textuur: fijne raster-lijnen + drijvende witte gloed,
            zoals de hero-foto op q4s.nl — nu zacht bewegend en pulserend. */}
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <div
            className="absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
              backgroundSize: "56px 56px",
            }}
          />
          {/* Grote, langzaam drijvende witte gloed */}
          <div className="animate-aurora absolute -top-48 -left-32 h-[42rem] w-[42rem] rounded-full bg-white/20 blur-[120px]" />
          {/* Tweede, tegengesteld pulserende gloed voor diepte */}
          <div className="animate-glow-pulse absolute -bottom-40 -right-24 h-[34rem] w-[34rem] rounded-full bg-white/10 blur-[100px]" />
          <div className="animate-glow-pulse absolute left-1/3 top-1/2 h-72 w-72 rounded-full bg-white/[0.06] blur-3xl [animation-delay:2s]" />
        </div>

        <div className="relative">
          {logoSrc ? (
            <span className="inline-flex items-center justify-center rounded-sm bg-white px-6 py-5 shadow-[0_0_60px_-12px_rgba(255,255,255,0.5)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoSrc} alt="Q4S Project Partners" className="h-16 w-auto object-contain xl:h-20" />
            </span>
          ) : (
            <span className="inline-flex h-20 w-20 items-center justify-center rounded-sm bg-brand-600 text-2xl font-bold text-white">
              Q4S
            </span>
          )}
        </div>

        <div className="animate-fade-up relative max-w-md">
          <p className="mb-4 text-sm font-semibold text-white/70">
            Q4S Project Partners
          </p>
          <h2 className="text-[2.3rem] font-bold leading-[1.15] tracking-[-0.01em] text-white xl:text-[2.7rem]">
            Eén dashboard voor de hele Q4S-operatie.
          </h2>
          <p className="mt-6 text-base leading-relaxed text-white/55">
            Uren, facturatie, recruitment en administratie — alles op één plek.
            Iedereen ziet direct wat er moet gebeuren.
          </p>
        </div>

        <p className="relative text-xs text-white/35">© {year} Q4S Project Partners</p>
      </aside>

      {/* RECHTS — inhoud */}
      <main className="flex items-center justify-center bg-white px-6 py-12 sm:px-10">
        <div className="animate-fade-up w-full max-w-md">
          {logoSrc && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoSrc}
              alt="Q4S Project Partners"
              className="mb-8 h-14 w-auto object-contain lg:hidden"
            />
          )}

          <h1 className="text-[30px] font-semibold tracking-[-0.01em] text-ink-900">{title}</h1>
          <p className="mt-2 text-[15px] text-ink-500">{subtitle}</p>

          <div className="mt-8">{children}</div>

          {footer && <div className="mt-8 text-xs leading-relaxed text-ink-400">{footer}</div>}
        </div>
      </main>
    </div>
  );
}
