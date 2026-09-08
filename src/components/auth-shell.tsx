import { Globe } from "lucide-react";
import { getLogoSrc } from "@/lib/branding";

/**
 * Gedeelde split-screen voor de openbare auth-pagina's (login, wachtwoord
 * vergeten/herstellen). Layout naar het aangeleverde voorbeeld: LINKS het
 * formulier (wit, kop + subtitel gecentreerd, footer met copyright + taal),
 * RECHTS een zwart gebrand paneel als afgeronde inset-kaart met het Q4S-logo,
 * een drijvende gloed, en onderin een twee-koloms infoblok. Alles in de
 * Q4S-huisstijl: zwart/antraciet, strakke hoeken, het zwart-op-wit logo op een
 * wit vlak. Onder lg klapt het naar één kolom (paneel verdwijnt, logo boven).
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
    <div className="min-h-screen bg-white lg:grid lg:grid-cols-[1fr_1.02fr]">
      {/* LINKS — formulier */}
      <main className="flex min-h-screen flex-col px-6 py-8 sm:px-10 lg:px-14">
        {logoSrc && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoSrc}
            alt="Q4S Project Partners"
            className="mb-8 h-12 w-auto object-contain lg:hidden"
          />
        )}

        <div className="flex flex-1 items-center justify-center">
          <div className="animate-fade-up w-full max-w-md">
            <div className="text-center">
              <h1 className="text-[30px] font-semibold tracking-[-0.01em] text-ink-900">{title}</h1>
              <p className="mt-2 text-[15px] text-ink-500">{subtitle}</p>
            </div>

            <div className="mt-8 text-left">{children}</div>

            {footer && <div className="mt-8 text-sm leading-relaxed text-ink-500">{footer}</div>}
          </div>
        </div>

        <div className="flex items-center justify-between pt-8 text-xs text-ink-400">
          <span>© {year} Q4S Project Partners</span>
          <span className="inline-flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" /> NL
          </span>
        </div>
      </main>

      {/* RECHTS — zwart gebrand paneel als inset-kaart */}
      <div className="hidden p-3 lg:block">
        <aside className="relative flex h-full flex-col justify-between overflow-hidden rounded-lg bg-gradient-to-br from-[#242320] to-[#0a0a0a] p-12 xl:p-14">
          {/* Industriële textuur: fijne raster-lijnen + een gloed die schuin van
              links-boven naar rechts-onder door het vak drijft. */}
          <div aria-hidden className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-0 opacity-[0.07]"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
                backgroundSize: "56px 56px",
              }}
            />
            <div className="animate-diagonal-glow absolute left-0 top-0 h-[38rem] w-[38rem] rounded-full bg-white/25 blur-[130px]" />
          </div>

          {/* Boven: logo linksboven, los */}
          <div className="relative">
            {logoSrc ? (
              <span className="inline-flex items-center justify-center rounded-sm bg-white px-5 py-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoSrc} alt="Q4S Project Partners" className="h-14 w-auto object-contain xl:h-16" />
              </span>
            ) : (
              <span className="inline-flex h-16 w-16 items-center justify-center rounded-sm bg-white text-xl font-bold text-ink-900">
                Q4S
              </span>
            )}
          </div>

          {/* Midden: naam, tagline en uitleg */}
          <div className="relative max-w-md">
            <h2 className="text-3xl font-bold tracking-[-0.01em] text-white xl:text-4xl">
              Q4S Project Partners
            </h2>
            <p className="mt-3 text-lg font-medium text-white/70">
              Detacheren. Factureren. Groeien.
            </p>
            <p className="mt-6 text-[15px] leading-relaxed text-white/55">
              Hét interne platform voor de complete Q4S-operatie — van gecertificeerd
              staalbouwtalent op de juiste klus tot de factuur die de deur uitgaat.
            </p>
            <p className="mt-4 text-[15px] leading-relaxed text-white/55">
              Urenstaten, recruitment, plaatsingen, facturatie en betalingen lopen hier
              samen in één overzicht, zodat je in één oogopslag ziet wat er speelt en
              wat er moet gebeuren — zonder los geknutsel in mappen en mailboxen.
            </p>
          </div>

          {/* Onder: twee kolommen met info */}
          <div className="relative grid grid-cols-2 gap-6 border-t border-white/10 pt-6">
            <div>
              <h3 className="text-sm font-bold text-white">Alles op één plek</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/50">
                Uren, facturatie, recruitment en administratie in één dashboard —
                altijd actueel, altijd bij de hand.
              </p>
            </div>
            <div className="border-l border-white/10 pl-6">
              <h3 className="text-sm font-bold text-white">Hulp nodig?</h3>
              <p className="mt-1.5 text-[13px] leading-relaxed text-white/50">
                Vraag de beheerder om toegang of hulp bij het inloggen — je bent
                zo weer op weg.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
