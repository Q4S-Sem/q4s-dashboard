"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bell,
  BellRing,
  CalendarDays,
  ListTodo,
  ClipboardList,
  Award,
  Receipt,
  Inbox,
  Zap,
  AlertTriangle,
  ChevronRight,
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
  msp: { icon: Zap, color: "orange", desc: "Ongelezen MSP-intakemeldingen" },
  "factuur-afwijking": {
    icon: AlertTriangle,
    color: "red",
    desc: "Ontvangen factuur klopt niet met het plaatsingstarief",
  },
};

const CHIP: Record<string, string> = {
  blue: "bg-blue-100 text-blue-700",
  violet: "bg-violet-100 text-violet-700",
  cyan: "bg-cyan-100 text-cyan-700",
  amber: "bg-amber-100 text-amber-700",
  emerald: "bg-emerald-100 text-emerald-700",
  indigo: "bg-indigo-100 text-indigo-700",
  orange: "bg-orange-100 text-orange-700",
  red: "bg-red-100 text-red-700",
  slate: "bg-ink-100 text-ink-500",
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
          // Het aantal staat náást de bel in plaats van er bovenop: geen bolletje
          // dat het icoon wegdrukt, en het getal blijft goed leesbaar.
          "inline-flex h-9 items-center gap-1.5 rounded-sm transition-colors",
          urgent > 0
            ? "bg-brand-50 px-2 text-brand-700 hover:bg-brand-100"
            : "w-9 justify-center text-ink-400 hover:bg-ink-100 hover:text-ink-900",
        )}
      >
        <Bell className="h-[18px] w-[18px]" />
        {urgent > 0 && (
          <span className="text-[13px] font-semibold tabular-nums">
            {urgent > 99 ? "99+" : urgent}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-[26rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-md border border-ink-200 bg-white shadow-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-5 py-3.5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-ink-900 text-white">
                <BellRing className="h-4 w-4" />
              </span>
              <div>
                <div className="text-[15px] font-bold leading-tight text-ink-900">Meldingen</div>
                <div className="text-xs text-ink-400">
                  {urgent > 0 ? `${urgent} ${urgent === 1 ? "vraagt" : "vragen"} aandacht` : "Alles bij — niets urgents"}
                </div>
              </div>
            </div>
          </div>

          {/* Overzichtsstrip */}
          <div className="grid grid-cols-3 gap-2 px-4 pt-4">
            <SummaryTile label="Te laat" value={totalLate} tone="red" />
            <SummaryTile label="Vandaag" value={totalToday} tone="amber" />
            <SummaryTile label="Later" value={totalFuture} tone="slate" />
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
            <ul className="mt-3 max-h-[26rem] divide-y divide-ink-50 overflow-y-auto">
              {groups.map((g) => {
                const meta = META[g.key] ?? { icon: Bell, color: "slate", desc: "" };
                const Icon = meta.icon;
                return (
                  <li key={g.key}>
                    <Link
                      href={g.href}
                      onClick={() => setOpen(false)}
                      className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-ink-50"
                    >
                      <span
                        className={cn(
                          "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
                          CHIP[meta.color] ?? CHIP.slate,
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-ink-900">{g.label}</span>
                          <ChevronRight className="h-4 w-4 shrink-0 text-ink-300 transition-colors group-hover:text-ink-500" />
                        </div>
                        {meta.desc && <p className="truncate text-xs text-ink-400">{meta.desc}</p>}
                        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                          {g.late > 0 && <Pill n={g.late} label="te laat" tone="red" />}
                          {g.today > 0 && <Pill n={g.today} label="vandaag" tone="amber" />}
                          {g.future > 0 && <Pill n={g.future} label="later" tone="slate" />}
                        </div>
                      </div>
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

function SummaryTile({ label, value, tone }: { label: string; value: number; tone: "red" | "amber" | "slate" }) {
  const map = {
    red: { tile: "bg-red-50 ring-red-100", value: value > 0 ? "text-red-600" : "text-ink-300" },
    amber: { tile: "bg-amber-50 ring-amber-100", value: value > 0 ? "text-amber-600" : "text-ink-300" },
    slate: { tile: "bg-ink-50 ring-ink-200", value: value > 0 ? "text-ink-700" : "text-ink-300" },
  }[tone];
  return (
    <div className={cn("rounded-xl px-3 py-2.5 text-center ring-1", map.tile)}>
      <div className={cn("text-2xl font-bold leading-none tabular-nums", map.value)}>{value}</div>
      <div className="mt-1 text-[11px] font-medium uppercase tracking-wide text-ink-500">{label}</div>
    </div>
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
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ring-1 ring-inset", cls)}>
      <span className="tabular-nums">{n}</span>
      <span className="font-medium">{label}</span>
    </span>
  );
}
