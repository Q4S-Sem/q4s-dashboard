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

// Het gekleurde streepje bovenaan de kaart — houdt het speels én rustig.
const barMap: Record<Accent, string> = {
  brand: "bg-brand-600",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  slate: "bg-ink-900",
  violet: "bg-violet-500",
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
    <Card className={cn("group relative overflow-hidden", className)}>
      {/* Kleuraccent bovenaan; groeit bij hover over de volle breedte. */}
      <span
        className={cn(
          "absolute inset-x-0 top-0 h-[3px] w-10 transition-all duration-200 group-hover:w-full",
          barMap[accent],
        )}
      />
      <div className="flex items-start justify-between gap-3 p-5 pt-6">
        <div className="min-w-0">
          <p className="q4s-label truncate">{label}</p>
          <p className="q4s-display mt-2.5 text-[28px] tabular-nums">{value}</p>
          {sub && <p className="mt-2 text-xs text-ink-400">{sub}</p>}
        </div>
        {icon && (
          <div
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-sm",
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
