"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, Briefcase, StickyNote, Receipt, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * De "mappen" van het klantdossier: tabbladen in de kop die er als tabs van een
 * hangmap uitzien. Elk mapje is een eigen route (/klanten/[id]/plaatsingen, …),
 * dus je kunt er direct naartoe linken en de browser-terugknop werkt gewoon.
 */

type Tab = { seg: string; label: string; icon: LucideIcon; count: number };

export function DossierTabs({
  clientId,
  counts,
}: {
  clientId: string;
  counts: { contacts: number; placements: number; notes: number; invoices: number };
}) {
  const pathname = usePathname();
  const base = `/klanten/${clientId}`;

  const tabs: Tab[] = [
    { seg: "", label: "Overzicht", icon: Building2, count: counts.contacts },
    { seg: "plaatsingen", label: "Plaatsingen", icon: Briefcase, count: counts.placements },
    { seg: "notities", label: "Notities", icon: StickyNote, count: counts.notes },
    { seg: "facturen", label: "Facturen", icon: Receipt, count: counts.invoices },
  ];

  return (
    <nav
      aria-label="Klantdossier"
      className="flex items-end gap-1 overflow-x-auto border-b border-slate-200"
    >
      {tabs.map((t) => {
        const href = t.seg ? `${base}/${t.seg}` : base;
        const active = t.seg ? pathname.startsWith(href) : pathname === base;
        const Icon = t.icon;
        return (
          <Link
            key={t.seg || "overzicht"}
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
            <Icon className={cn("h-4 w-4", active ? "text-brand-600" : "text-slate-400")} />
            {t.label}
            {t.count > 0 && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  active ? "bg-brand-50 text-brand-700" : "bg-slate-100 text-slate-500",
                )}
              >
                {t.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
