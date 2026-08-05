"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * De "mappen" van een dossier: tabbladen die er als tabs van een hangmap uitzien.
 * Twee smaken met exact dezelfde look:
 *  - `DossierTabs` — elk mapje is een eigen route (klant-, plaatsing-, medewerker-
 *    en vacaturehub-dossier). Deelbare link, terugknop werkt.
 *  - `FolderTabBar` + `FolderTab` — dezelfde mapjes, maar als knoppen; voor lijsten
 *    die client-side filteren (zie de vacaturelijst).
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

/** De rij waar de mapjes op staan (met de lijn waar ze overheen vallen). */
export function FolderTabBar({
  label = "Mapjes",
  children,
}: {
  label?: string;
  children: React.ReactNode;
}) {
  return (
    <nav
      aria-label={label}
      className="flex items-end gap-1 overflow-x-auto border-b border-slate-200"
    >
      {children}
    </nav>
  );
}

// -mb-px laat het tabje over de lijn vallen; de onderrand krijgt de paginakleur
// (#fafafa) zodat het mapje "open" staat.
const TAB_BASE =
  "-mb-px inline-flex shrink-0 items-center gap-2 rounded-t-xl border px-4 py-2.5 text-sm font-medium transition-colors";
const TAB_ACTIVE = "border-slate-200 border-b-[#fafafa] bg-white text-slate-900";
const TAB_IDLE = "border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-900";

/** De inhoud van één mapje: icoon, tekst en eventueel een aantal. */
function TabInner({
  icon,
  label,
  count,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
}) {
  return (
    <>
      <span className={active ? "text-brand-600" : "text-slate-400"}>{icon}</span>
      {label}
      {count ? (
        <span
          className={cn(
            "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
            active ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500",
          )}
        >
          {count}
        </span>
      ) : null}
    </>
  );
}

/** Eén mapje als knop — voor filters die niet in de URL staan. */
export function FolderTab({
  icon,
  label,
  count,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "true" : undefined}
      className={cn(TAB_BASE, active ? TAB_ACTIVE : TAB_IDLE)}
    >
      <TabInner icon={icon} label={label} count={count} active={active} />
    </button>
  );
}

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
    <FolderTabBar label={label}>
      {tabs.map((t) => {
        const href = t.seg ? `${base}/${t.seg}` : base;
        const active = t.seg ? pathname.startsWith(href) : pathname === base;
        return (
          <Link
            key={t.seg || "_root"}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(TAB_BASE, active ? TAB_ACTIVE : TAB_IDLE)}
          >
            <TabInner icon={t.icon} label={t.label} count={t.count} active={active} />
          </Link>
        );
      })}
    </FolderTabBar>
  );
}
