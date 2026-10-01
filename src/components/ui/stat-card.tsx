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
    <Card className={cn("group relative overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md", className)}>
      <div className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-ink-500">{label}</p>
          <p className="mt-2 text-[30px] font-semibold tracking-[-0.02em] tabular-nums text-ink-900">
            {value}
          </p>
          {sub && <p className="mt-1.5 text-xs text-ink-400">{sub}</p>}
        </div>
        {icon && (
          <div
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-md",
              accentMap[accent],
            )}
          >
            {icon}
          </div>
        )}
      </div>
      {(progress !== undefined || detail) && (
        <div className="-mt-1 px-5 pb-5">
          {progress !== undefined && (
            <div className="h-1.5 overflow-hidden rounded-full bg-ink-100" role="presentation">
              <div
                className={cn("h-full rounded-full", accent === "red" ? "bg-red-600" : "bg-ink-900")}
                style={{ width: `${Math.round(Math.min(1, Math.max(0, progress)) * 100)}%` }}
              />
            </div>
          )}
          {detail && <p className="mt-3 text-[13px] text-ink-700">{detail}</p>}
          {detailSub && <p className="mt-0.5 text-xs text-ink-400">{detailSub}</p>}
        </div>
      )}
    </Card>
  );
}
