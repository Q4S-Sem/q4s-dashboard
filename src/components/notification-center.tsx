"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  CalendarDays,
  ListTodo,
  ClipboardList,
  Award,
  Receipt,
  Inbox,
  Briefcase,
  AlertTriangle,
  CheckCheck,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Notifications } from "@/lib/notifications";

// Per categorie: icoon en een korte omschrijving. Monochroom (grijs), zoals de
// referentielayout — de kleur zit alleen nog in het urgentie-stipje.
const META: Record<string, { icon: LucideIcon; desc: string }> = {
  agenda: { icon: CalendarDays, desc: "Geplande afspraken" },
  taken: { icon: ListTodo, desc: "Openstaande taken" },
  sollicitaties: { icon: ClipboardList, desc: "Nieuwe sollicitaties in de pipeline" },
  certificeringen: { icon: Award, desc: "Certificaten die (bijna) verlopen" },
  facturen: { icon: Receipt, desc: "Verzonden facturen, nog niet betaald" },
  inbox: { icon: Inbox, desc: "Timesheets om te verwerken" },
  msp: { icon: Briefcase, desc: "Ongelezen MSP-intakemeldingen" },
  "factuur-afwijking": {
    icon: AlertTriangle,
    desc: "Ontvangen factuur klopt niet met het plaatsingstarief",
  },
};

/** Korte meta-regel uit de tellingen (vervangt de "2 min geleden" uit het voorbeeld). */
function metaRegel(g: { late: number; today: number; future: number }): string {
  const delen: string[] = [];
  if (g.late > 0) delen.push(`${g.late} te laat`);
  if (g.today > 0) delen.push(`${g.today} vandaag`);
  if (g.future > 0) delen.push(`${g.future} later`);
  return delen.join(" · ");
}

/**
 * Meldingencentrum in de topbalk. Schone, lichtgrijze lijstlayout: per categorie
 * een rij met een grijs icoonvlak, titel met urgentie-stip, omschrijving en een
 * meta-regel met de tellingen. Klik op een rij → naar die module. Alle hoeken 6px.
 */
export function NotificationCenter({ data }: { data: Notifications }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const { groups, urgent } = data;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Meldingen${urgent > 0 ? ` (${urgent})` : ""}`}
        aria-haspopup="menu"
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-md border transition-all",
          open
            ? "border-brand-700 bg-brand-700 text-white"
            : urgent > 0
              ? "border-ink-200 bg-white text-ink-700 shadow-sm hover:-translate-y-0.5 hover:border-ink-300"
              : "border-transparent text-ink-400 hover:bg-ink-100 hover:text-ink-900",
        )}
      >
        <Bell className="h-[18px] w-[18px]" />
        {urgent > 0 && (
          <span className="absolute -right-1.5 -top-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold tabular-nums text-white ring-2 ring-white">
            {urgent > 99 ? "99+" : urgent}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[24rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-md border border-ink-200 bg-white shadow-2xl"
        >
          {/* Kop: titel links, aantal nieuw rechts. */}
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-3.5">
            <span className="text-[15px] font-bold tracking-tight text-ink-900">Meldingen</span>
            <span className="text-xs font-medium text-ink-400">
              {urgent > 0 ? `${urgent} nieuw` : "geen nieuwe"}
            </span>
          </div>

          {groups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-md bg-ink-50 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <p className="text-sm font-medium text-ink-700">Geen openstaande acties</p>
              <p className="text-xs text-ink-400">Je bent helemaal bij. 🎉</p>
            </div>
          ) : (
            <ul className="max-h-[26rem] space-y-1 overflow-y-auto p-2">
              {groups.map((g) => {
                const meta = META[g.key] ?? { icon: Bell, desc: "" };
                const Icon = meta.icon;
                // Urgentie-stip: rood (te laat) > oranje (vandaag) > grijs.
                const dot = g.late > 0 ? "bg-red-500" : g.today > 0 ? "bg-amber-500" : "bg-ink-300";
                return (
                  <li key={g.key}>
                    <Link
                      href={g.href}
                      onClick={() => setOpen(false)}
                      className="flex items-start gap-3 rounded-md p-3 transition-colors hover:bg-ink-50"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-ink-100 text-ink-500">
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold text-ink-900">{g.label}</span>
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
                        </span>
                        {meta.desc && <p className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-ink-500">{meta.desc}</p>}
                        <p className="mt-1 text-xs text-ink-400">{metaRegel(g)}</p>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Voetregel: link naar het volledige overzicht. */}
          <div className="border-t border-ink-100 px-4 py-2.5">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900"
            >
              <CheckCheck className="h-4 w-4" /> Volledig overzicht op het dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
