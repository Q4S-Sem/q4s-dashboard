import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { segmentVariants } from "@/components/ui/button";
import type { Periode } from "@/lib/analytics-periode";

// Gedeelde presentatie-bouwstenen voor de analytics sub-dashboards, zodat
// Facturatie / Recruitment / Plaatsingen / Evaluaties er identiek + strak uitzien.

/**
 * Tailwind bar-fill per badge-kleur. De balk krijgt dezelfde kleur als de badge
 * van dezelfde status, zodat een grafiek en een lijst dezelfde taal spreken.
 */
export const TONE: Record<string, string> = {
  slate: "bg-ink-300",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
  violet: "bg-violet-500",
  cyan: "bg-cyan-500",
  orange: "bg-brand-600",
  brand: "bg-brand-600",
};

/** A card with a consistent icon-chip header + optional right-aligned action link. */
export function SectionCard({
  icon,
  title,
  action,
  children,
  className,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          {icon && (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-sm bg-brand-50 text-brand-600">
              {icon}
            </span>
          )}
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      {children}
    </Card>
  );
}

/** A subtle "→" action link used in section headers. */
export function ActionLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="shrink-0 text-sm font-medium text-ink-500 transition-colors hover:text-ink-900"
    >
      {children}
    </Link>
  );
}

/** A horizontal labelled bar. Non-zero values keep a minimum sliver so they stay visible. */
export function Bar({
  label,
  value,
  max,
  color = "green",
  display,
  labelWidth = "w-36",
}: {
  label: React.ReactNode;
  value: number;
  max: number;
  color?: string;
  /** Override the right-hand readout (defaults to the value). */
  display?: React.ReactNode;
  labelWidth?: string;
}) {
  const raw = max > 0 ? (value / max) * 100 : 0;
  const pct = value > 0 ? Math.max(raw, 5) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className={cn("shrink-0 truncate text-sm text-ink-600", labelWidth)} title={typeof label === "string" ? label : undefined}>
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100">
        <div
          className={cn("animate-bar-in h-full origin-left rounded-full transition-all", TONE[color] ?? "bg-emerald-500")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-ink-900">
        {display ?? value}
      </span>
    </div>
  );
}

/** A consistent empty-state body inside a SectionCard. */
export function Empty({ children }: { children: React.ReactNode }) {
  return <CardContent className="py-8 text-center text-sm text-ink-400">{children}</CardContent>;
}

/**
 * Periodekiezer van Analytics: Heel jaar · Q1–Q4 + jaar ‹ ›. Links (geen JS), zodat
 * de keuze in de URL staat; `extra` = andere query-params die mee moeten (bijv. dim).
 */
export function PeriodeFilter({
  basePath,
  periode: p,
  extra = {},
}: {
  basePath: string;
  periode: Periode;
  extra?: Record<string, string>;
}) {
  const href = (q: string, year: number) =>
    `${basePath}?${new URLSearchParams({ ...extra, q, year: String(year) }).toString()}`;
  const pijl = "rounded-md p-1.5 text-ink-500 transition-colors hover:bg-ink-50 hover:text-ink-900";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="inline-flex rounded-lg border border-ink-200 bg-white p-0.5">
        <Link href={href("all", p.year)} scroll={false} className={segmentVariants(p.isYear)}>
          Heel jaar
        </Link>
        {[1, 2, 3, 4].map((q) => (
          <Link key={q} href={href(String(q), p.year)} scroll={false} className={segmentVariants(p.q === q)}>
            Q{q}
          </Link>
        ))}
      </div>
      <div className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white p-0.5">
        {p.year > p.minYear ? (
          <Link href={href(p.param, p.year - 1)} scroll={false} aria-label="Vorig jaar" className={pijl}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        ) : (
          <span className="p-1.5 text-ink-200" aria-hidden>
            <ChevronLeft className="h-4 w-4" />
          </span>
        )}
        <span className="min-w-[3rem] text-center text-sm font-semibold tabular-nums text-ink-900">{p.year}</span>
        {p.year < p.maxYear ? (
          <Link href={href(p.param, p.year + 1)} scroll={false} aria-label="Volgend jaar" className={pijl}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        ) : (
          <span className="p-1.5 text-ink-200" aria-hidden>
            <ChevronRight className="h-4 w-4" />
          </span>
        )}
      </div>
    </div>
  );
}

/** Kop van een Analytics-tab: korte uitleg links, filter (of "huidige stand") rechts. */
export function TabKop({ uitleg, children }: { uitleg: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="max-w-3xl text-sm text-ink-500">{uitleg}</p>
      {children ?? (
        <span className="rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-medium text-ink-500">
          Huidige stand
        </span>
      )}
    </div>
  );
}
