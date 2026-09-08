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
  className,
}: {
  label: string;
  value: React.ReactNode;
  sub?: React.ReactNode;
  icon?: React.ReactNode;
  accent?: Accent;
  className?: string;
}) {
  return (
    <Card className={cn("group relative overflow-hidden transition-shadow hover:shadow-md", className)}>
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
    </Card>
  );
}
