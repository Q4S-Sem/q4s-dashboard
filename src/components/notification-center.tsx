"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Activity,
  Bell,
  CalendarDays,
  ListTodo,
  ClipboardList,
  Award,
  Receipt,
  Inbox,
  Briefcase,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  LayoutDashboard,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Notifications } from "@/lib/notifications";

// Per categorie: icoon, accentkleur en een korte omschrijving.
const META: Record<string, { icon: LucideIcon; color: string; desc: string }> = {
  agenda: { icon: CalendarDays, color: "blue", desc: "Geplande afspraken" },
  taken: { icon: ListTodo, color: "violet", desc: "Openstaande taken" },
  sollicitaties: { icon: ClipboardList, color: "cyan", desc: "Nieuwe sollicitaties in de pipeline" },
  certificeringen: { icon: Award, color: "amber", desc: "Certificaten die (bijna) verlopen" },
  facturen: { icon: Receipt, color: "emerald", desc: "Verzonden facturen, nog niet betaald" },
  inbox: { icon: Inbox, color: "indigo", desc: "Timesheets om te verwerken" },
  msp: { icon: Briefcase, color: "orange", desc: "Ongelezen MSP-intakemeldingen" },
  "factuur-afwijking": {
    icon: AlertTriangle,
    color: "red",
    desc: "Ontvangen factuur klopt niet met het plaatsingstarief",
  },
};

// Per categorie: gekleurde accentstreep + icoonkleur (tekst) voor de nieuwe
// timeline-stijl. Geen gevulde chip meer — alleen een streep links en een
// gekleurd icoon, rustiger en anders dan de oude ronde badges.
const ACCENT: Record<string, { bar: string; icon: string; ring: string }> = {
  blue: { bar: "bg-blue-500", icon: "text-blue-600", ring: "ring-blue-100" },
  violet: { bar: "bg-violet-500", icon: "text-violet-600", ring: "ring-violet-100" },
  cyan: { bar: "bg-cyan-500", icon: "text-cyan-600", ring: "ring-cyan-100" },
  amber: { bar: "bg-amber-500", icon: "text-amber-600", ring: "ring-amber-100" },
  emerald: { bar: "bg-emerald-500", icon: "text-emerald-600", ring: "ring-emerald-100" },
  indigo: { bar: "bg-indigo-500", icon: "text-indigo-600", ring: "ring-indigo-100" },
  orange: { bar: "bg-orange-500", icon: "text-orange-600", ring: "ring-orange-100" },
  red: { bar: "bg-red-500", icon: "text-red-600", ring: "ring-red-100" },
  slate: { bar: "bg-ink-300", icon: "text-ink-500", ring: "ring-ink-200" },
};

/**
 * Activiteiten-/meldingencentrum in de topbalk. Toont openstaande acties uit de
 * hele back-office, met bovenaan een overzicht (te laat / vandaag / later) en per
 * categorie een gekleurde rij met omschrijving en telling. De rode badge telt wat
 * nú aandacht vraagt (te laat + vandaag). Klik op een rij → naar die module.
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

  const { groups, urgent, totalLate, totalToday } = data;
  const totalFuture = groups.reduce((s, g) => s + g.future, 0);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Meldingen${urgent > 0 ? ` (${urgent})` : ""}`}
        aria-haspopup="menu"
        className={cn(
          "relative inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all",
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
          className="absolute right-0 z-50 mt-2 w-[27rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-2xl"
        >
          {/* Lichte, rustige kop met de telling eronder. */}
          <div className="border-b border-ink-100 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-ink-100 text-ink-600">
                  <Activity className="h-[16px] w-[16px]" />
                </span>
                <span className="text-[15px] font-bold tracking-tight text-ink-900">Activiteit</span>
              </div>
              <span className="text-xs font-medium text-ink-400">
                {urgent > 0 ? `${urgent} open` : "alles bij"}
              </span>
            </div>
            {/* Inline mini-telling in de kop i.p.v. drie losse tegels. */}
            <div className="mt-3 flex items-center gap-4 text-sm">
              <HeaderStat value={totalLate} label="te laat" dot="bg-red-500" />
              <span className="h-4 w-px bg-ink-200" />
              <HeaderStat value={totalToday} label="vandaag" dot="bg-amber-500" />
              <span className="h-4 w-px bg-ink-200" />
              <HeaderStat value={totalFuture} label="later" dot="bg-ink-300" />
            </div>
          </div>

          {groups.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </span>
              <p className="text-sm font-medium text-ink-700">Geen openstaande acties</p>
              <p className="text-xs text-ink-400">Je bent helemaal bij. 🎉</p>
            </div>
          ) : (
            <ul className="max-h-[26rem] overflow-y-auto p-2">
              {groups.map((g) => {
                const meta = META[g.key] ?? { icon: Activity, color: "slate", desc: "" };
                const Icon = meta.icon;
                const accent = ACCENT[meta.color] ?? ACCENT.slate;
                const total = g.late + g.today + g.future;
                return (
                  <li key={g.key}>
                    <Link
                      href={g.href}
                      onClick={() => setOpen(false)}
                      className="group relative flex items-center gap-3 overflow-hidden rounded-xl py-2.5 pl-4 pr-3 transition-colors hover:bg-ink-50"
                    >
                      {/* Gekleurde accentstreep links i.p.v. een gevulde badge. */}
                      <span className={cn("absolute inset-y-1.5 left-0 w-1 rounded-full", accent.bar)} />
                      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white ring-1", accent.ring)}>
                        <Icon className={cn("h-[18px] w-[18px]", accent.icon)} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink-900">{g.label}</span>
                        {meta.desc && <p className="truncate text-xs text-ink-400">{meta.desc}</p>}
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          {g.late > 0 && <Pill n={g.late} label="te laat" tone="red" />}
                          {g.today > 0 && <Pill n={g.today} label="vandaag" tone="amber" />}
                          {g.future > 0 && <Pill n={g.future} label="later" tone="slate" />}
                        </div>
                      </div>
                      {/* Grote telling rechts + pijl-naar-buiten i.p.v. chevron. */}
                      <span className="flex shrink-0 flex-col items-end">
                        <span className="text-lg font-bold tabular-nums leading-none text-ink-900">{total}</span>
                        <ArrowUpRight className="mt-1 h-4 w-4 text-ink-300 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink-600" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Footer */}
          <div className="border-t border-ink-100 bg-ink-50/60 px-4 py-2.5">
            <Link
              href="/dashboard"
              onClick={() => setOpen(false)}
              className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-sm font-medium text-ink-600 transition-colors hover:bg-white hover:text-ink-900"
            >
              <LayoutDashboard className="h-4 w-4" /> Volledig overzicht op het dashboard
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function HeaderStat({ value, label, dot }: { value: number; label: string; dot: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={cn("h-1.5 w-1.5 rounded-full", value > 0 ? dot : "bg-ink-200")} />
      <span className="font-bold tabular-nums text-ink-900">{value}</span>
      <span className="text-ink-400">{label}</span>
    </span>
  );
}

function Pill({ n, label, tone }: { n: number; label: string; tone: "red" | "amber" | "slate" }) {
  const cls =
    tone === "red"
      ? "bg-red-50 text-red-700 ring-red-100"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700 ring-amber-100"
        : "bg-ink-100 text-ink-500 ring-ink-200";
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-semibold ring-1 ring-inset", cls)}>
      <span className="tabular-nums">{n}</span>
      <span className="font-medium">{label}</span>
    </span>
  );
}
