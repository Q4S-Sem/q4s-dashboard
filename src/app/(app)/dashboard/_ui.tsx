import Link from "next/link";
import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// Gedeelde presentatie-bouwstenen voor de analytics sub-dashboards, zodat
// Facturatie / Recruitment / Plaatsingen / Evaluaties er identiek + strak uitzien.

/** Tailwind bar-fill per badge-kleur — minimalistisch zwart/neutraal/groen palet. */
export const TONE: Record<string, string> = {
  slate: "bg-slate-400",
  blue: "bg-slate-500",
  green: "bg-emerald-500",
  emerald: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-rose-500",
  violet: "bg-slate-500",
  cyan: "bg-slate-500",
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
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
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
      className="shrink-0 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
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
      <span className={cn("shrink-0 truncate text-sm text-slate-600", labelWidth)} title={typeof label === "string" ? label : undefined}>
        {label}
      </span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={cn("h-full rounded-full transition-all", TONE[color] ?? "bg-emerald-500")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-900">
        {display ?? value}
      </span>
    </div>
  );
}

/** A consistent empty-state body inside a SectionCard. */
export function Empty({ children }: { children: React.ReactNode }) {
  return <CardContent className="py-8 text-center text-sm text-slate-400">{children}</CardContent>;
}
