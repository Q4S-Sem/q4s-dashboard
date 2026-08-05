import Link from "next/link";
import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";

// Kleurrijke, Odoo-achtige dashboard-bouwstenen. BEWUST alleen op /dashboard —
// de rest van de app houdt de neutrale zwarte huisstijl. Elke kleur is een
// lichte tint (-50/-100) met donkere tekst (-700), een bewezen toegankelijk
// patroon (ruim boven 3:1 contrast) dat toch duidelijk kleur geeft.

export type DashColor =
  | "blue"
  | "emerald"
  | "violet"
  | "amber"
  | "cyan"
  | "rose"
  | "orange"
  | "indigo"
  | "slate";

const KPI: Record<DashColor, { tile: string; ring: string; icon: string; value: string }> = {
  blue: { tile: "bg-blue-50", ring: "ring-blue-100", icon: "bg-blue-100 text-blue-700", value: "text-blue-700" },
  emerald: { tile: "bg-emerald-50", ring: "ring-emerald-100", icon: "bg-emerald-100 text-emerald-700", value: "text-emerald-700" },
  violet: { tile: "bg-violet-50", ring: "ring-violet-100", icon: "bg-violet-100 text-violet-700", value: "text-violet-700" },
  amber: { tile: "bg-amber-50", ring: "ring-amber-100", icon: "bg-amber-100 text-amber-700", value: "text-amber-700" },
  cyan: { tile: "bg-cyan-50", ring: "ring-cyan-100", icon: "bg-cyan-100 text-cyan-700", value: "text-cyan-700" },
  rose: { tile: "bg-rose-50", ring: "ring-rose-100", icon: "bg-rose-100 text-rose-700", value: "text-rose-700" },
  orange: { tile: "bg-brand-50", ring: "ring-brand-100", icon: "bg-brand-100 text-brand-700", value: "text-brand-700" },
  indigo: { tile: "bg-indigo-50", ring: "ring-indigo-100", icon: "bg-indigo-100 text-indigo-700", value: "text-indigo-700" },
  slate: { tile: "bg-ink-50", ring: "ring-ink-200", icon: "bg-ink-200 text-ink-600", value: "text-ink-800" },
};

const BAR: Record<DashColor, string> = {
  blue: "bg-blue-500",
  emerald: "bg-emerald-500",
  violet: "bg-violet-500",
  amber: "bg-amber-500",
  cyan: "bg-cyan-500",
  rose: "bg-rose-500",
  orange: "bg-brand-600",
  indigo: "bg-indigo-500",
  slate: "bg-ink-300",
};

/** Grote, kleurrijke KPI-tegel (Odoo-stijl): label + fors getal + optionele sub. */
export function KpiTile({
  label,
  value,
  sub,
  icon,
  color = "blue",
  href,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  color?: DashColor;
  href?: string;
}) {
  const c = KPI[color];
  const inner = (
    <div className={cn("h-full rounded-xl p-4 ring-1 transition-shadow", c.tile, c.ring, href && "hover:shadow-md")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="q4s-label truncate">{label}</p>
          {/* Groot getal: proportionele cijfers (geen tabular) en in de kleur­tint. */}
          <p className={cn("mt-2.5 text-3xl font-black leading-none tracking-[-0.035em]", c.value)}>{value}</p>
          {sub && <p className="mt-2 text-xs font-medium text-ink-500">{sub}</p>}
        </div>
        {icon && (
          <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", c.icon)}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
  return href ? (
    <Link href={href} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

/** Sectiekop met een gekleurd accent-balkje (Odoo-achtig). */
export function SectionHeading({
  title,
  color = "blue",
  action,
}: {
  title: React.ReactNode;
  color?: DashColor;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="flex items-center gap-2.5 text-base font-black tracking-tight text-ink-900">
        <span className={cn("h-5 w-1 rounded-full", BAR[color])} />
        {title}
      </h2>
      {action}
    </div>
  );
}

/** Kleurrijke hub-tegel met gekleurde icon-chip + mini-cijfers. */
export function HubTile({
  icon,
  title,
  href,
  rows,
  color,
}: {
  icon: React.ReactNode;
  title: string;
  href: string;
  rows: [string, string][];
  color: DashColor;
}) {
  const c = KPI[color];
  return (
    <Link
      href={href}
      className={cn(
        "group q4s-hoverable flex flex-col rounded-md border border-ink-100 bg-white p-4 hover:-translate-y-0.5",
      )}
    >
      <div className="flex items-center gap-2.5">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", c.icon)}>{icon}</span>
        <span className="flex-1 font-extrabold tracking-tight text-ink-900">{title}</span>
        <ChevronRight className={cn("h-4 w-4 text-ink-300 transition-all group-hover:translate-x-0.5 group-hover:text-brand-600")} />
      </div>
      <div className="mt-3 space-y-1.5 border-t border-ink-100 pt-3">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-sm">
            <span className="text-ink-500">{k}</span>
            <span className="font-semibold tabular-nums text-ink-900">{v}</span>
          </div>
        ))}
      </div>
    </Link>
  );
}

/** Eén regel in de "van omzet naar winst"-uitsplitsing (resultatenrekening).
 *  variant: "line" = normaal (+), "cost" = kostenpost (− in rood),
 *  "subtotal" = brutomarge (streep + groen), "total" = nettowinst (fors, groen/rood). */
export function ResultRow({
  label,
  amount,
  variant = "line",
}: {
  label: string;
  amount: number;
  variant?: "line" | "cost" | "subtotal" | "total";
}) {
  const bordered = variant === "subtotal" || variant === "total";
  const shown =
    variant === "total"
      ? formatCurrency(amount)
      : `${variant === "cost" ? "− " : ""}${formatCurrency(Math.abs(amount))}`;
  const valueColor =
    variant === "total"
      ? amount >= 0
        ? "text-emerald-700"
        : "text-rose-700"
      : variant === "subtotal"
        ? "text-emerald-700"
        : variant === "cost"
          ? "text-rose-600"
          : "text-ink-900";
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3",
        bordered ? "mt-1.5 border-t border-ink-200 pt-2.5" : "py-1",
      )}
    >
      <span
        className={cn(
          variant === "total"
            ? "text-sm font-bold text-ink-900"
            : variant === "subtotal"
              ? "text-sm font-semibold text-ink-800"
              : "text-sm text-ink-600",
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          variant === "total" ? "text-xl font-extrabold" : "text-sm font-semibold",
          valueColor,
        )}
      >
        {shown}
      </span>
    </div>
  );
}

/** Gekleurde horizontale mini-bar (voor de pipeline-verdeling). */
export function MiniBar({
  label,
  value,
  max,
  color,
  display,
}: {
  label: string;
  value: number;
  max: number;
  color: DashColor;
  display?: React.ReactNode;
}) {
  const raw = max > 0 ? (value / max) * 100 : 0;
  const pct = value > 0 ? Math.max(raw, 4) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 truncate text-sm text-ink-600" title={label}>
        {label}
      </span>
      {/* Balk krimpt mee (met een minimum) zodat het bedrag rechts altijd binnen
          de kaart past en niet meer buiten het vak valt. */}
      <div className="h-2.5 min-w-[2rem] flex-1 overflow-hidden rounded-full bg-ink-100">
        <div className={cn("h-full rounded-full transition-all", BAR[color])} style={{ width: `${pct}%` }} />
      </div>
      <span className="shrink-0 whitespace-nowrap text-right text-sm font-semibold tabular-nums text-ink-900">
        {display ?? value}
      </span>
    </div>
  );
}
