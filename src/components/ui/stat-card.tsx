import * as React from "react";
import { cn } from "@/lib/utils";
import { Card } from "./card";

type Accent = "brand" | "green" | "amber" | "red" | "slate" | "violet";

const accentMap: Record<Accent, string> = {
  brand: "bg-brand-50 text-brand-600",
  green: "bg-emerald-50 text-emerald-600",
  amber: "bg-amber-50 text-amber-600",
  red: "bg-red-50 text-red-600",
  slate: "bg-ink-100 text-ink-600",
  violet: "bg-violet-50 text-violet-600",
};

export function StatCard({
  label,
  value,
  sub,
  icon,
  accent = "brand",
  progress,
  detail,
  detailSub,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: Accent;
  /** 0..1 — toont een voortgangsbalk onder de waarde. */
  progress?: number;
  /** Uitleg-regel onder de balk, met optioneel een grijze tweede regel. */
  detail?: React.ReactNode;
  detailSub?: React.ReactNode;
  className?: string;
}) {
  return (
    // Compacte KPI-tegel: klein icoon links, label + waarde ernaast. Bewust
    // laag (~56px) — de cijfers zijn context, niet de hoofdzaak van de pagina.
    <Card className={cn("relative overflow-hidden shadow-none", className)}>
      <div className="flex items-center gap-3 px-3.5 py-2.5">
        {icon && (
          <div
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-md [&_svg]:h-4 [&_svg]:w-4",
              accentMap[accent],
            )}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-ink-500">{label}</p>
          <p className="flex items-baseline gap-2 text-lg font-semibold leading-tight tracking-tight tabular-nums text-ink-900">
            <span className="truncate">{value}</span>
            {sub && <span className="truncate text-xs font-normal tracking-normal text-ink-400">{sub}</span>}
          </p>
        </div>
      </div>
      {(progress !== undefined || detail) && (
        <div className="px-3.5 pb-2.5">
          {progress !== undefined && (
            <div className="h-1 overflow-hidden rounded-full bg-ink-100" role="presentation">
              <div
                className={cn("h-full rounded-full", accent === "red" ? "bg-red-600" : "bg-ink-900")}
                style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }}
              />
            </div>
          )}
          {detail && <p className="mt-1.5 text-xs text-ink-700">{detail}</p>}
          {detailSub && <p className="mt-0.5 text-xs text-ink-400">{detailSub}</p>}
        </div>
      )}
    </Card>
  );
}
