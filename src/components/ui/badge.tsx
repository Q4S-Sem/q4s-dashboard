import * as React from "react";
import { cn } from "@/lib/utils";
import { type BadgeColor, type Option, colorFor, labelFor } from "@/lib/domain";

const colorMap: Record<BadgeColor, string> = {
  slate: "bg-slate-100 text-slate-700 ring-slate-200",
  blue: "bg-blue-50 text-blue-700 ring-blue-200",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  amber: "bg-amber-50 text-amber-700 ring-amber-200",
  red: "bg-red-50 text-red-700 ring-red-200",
  violet: "bg-violet-50 text-violet-700 ring-violet-200",
  cyan: "bg-cyan-50 text-cyan-700 ring-cyan-200",
};

export function Badge({
  color = "slate",
  className,
  children,
}: {
  color?: BadgeColor;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        colorMap[color],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Renders a badge for a value using an option set's label + color. */
export function StatusBadge({
  options,
  value,
}: {
  options: Option[];
  value: string | null | undefined;
}) {
  return <Badge color={colorFor(options, value)}>{labelFor(options, value)}</Badge>;
}
