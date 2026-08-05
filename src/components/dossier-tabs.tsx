"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * De "mappen" van een dossier: tabbladen in de kop die er als tabs van een
 * hangmap uitzien. Elk mapje is een eigen route, dus je kunt er direct naartoe
 * linken en de browser-terugknop werkt gewoon. Gedeeld door de klant- en
 * plaatsing-dossiers (zie /klanten/[id] en /plaatsingen/[id]).
 */

export type DossierTab = {
  /** Pad-segment onder `base`; leeg = het eerste mapje (de basisroute zelf). */
  seg: string;
  label: string;
  /** Een al gerenderd icoon (`<Users className="h-4 w-4" />`), zodat een
   *  server-component het gewoon kan meegeven. Kleurt mee met het tabblad. */
  icon: React.ReactNode;
  /** Getal op het mapje — laat weg (of 0) om het te verbergen. */
  count?: number;
};

export function DossierTabs({
  base,
  tabs,
  label = "Dossier",
}: {
  base: string;
  tabs: DossierTab[];
  label?: string;
}) {
  const pathname = usePathname();

  return (
    <nav
      aria-label={label}
      className="flex items-end gap-1 overflow-x-auto border-b border-slate-200"
    >
      {tabs.map((t) => {
        const href = t.seg ? `${base}/${t.seg}` : base;
        const active = t.seg ? pathname.startsWith(href) : pathname === base;
        return (
          <Link
            key={t.seg || "_root"}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              // -mb-px laat het tabje over de lijn vallen; de onderrand krijgt de
              // paginakleur (#fafafa) zodat het mapje "open" staat.
              "-mb-px inline-flex shrink-0 items-center gap-2 rounded-t-xl border px-4 py-2.5 text-sm font-medium transition-colors",
              active
                ? "border-slate-200 border-b-[#fafafa] bg-white text-slate-900"
                : "border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <span className={active ? "text-brand-600" : "text-slate-400"}>{t.icon}</span>
            {t.label}
            {t.count ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  active ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500",
                )}
              >
                {t.count}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
