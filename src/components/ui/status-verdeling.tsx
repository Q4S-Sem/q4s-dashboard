import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { Card } from "./card";

type Tone = "slate" | "blue" | "green" | "amber" | "red" | "violet";

const TONE: Record<Tone, { cirkel: string; label: string }> = {
  slate: { cirkel: "bg-ink-100 text-ink-600", label: "text-ink-600" },
  blue: { cirkel: "bg-blue-100 text-blue-600", label: "text-blue-600" },
  green: { cirkel: "bg-emerald-100 text-emerald-600", label: "text-emerald-600" },
  amber: { cirkel: "bg-amber-100 text-amber-600", label: "text-amber-600" },
  red: { cirkel: "bg-red-100 text-red-600", label: "text-red-600" },
  violet: { cirkel: "bg-violet-100 text-violet-600", label: "text-violet-600" },
};

export type StatusItem = {
  key: string;
  label: string;
  count: number;
  icon: React.ReactNode;
  tone: Tone;
  href: string;
  active?: boolean;
};

/**
 * Statusverdeling: een rij ronde iconen met aantal + label. Elk item is een
 * filterlink — klikken toont alleen die status in de tabel eronder.
 */
export function StatusVerdeling({ title, items }: { title: string; items: StatusItem[] }) {
  return (
    <Card className="p-5">
      <h3 className="text-[15px] font-semibold text-ink-900">{title}</h3>
      <div
        className="mt-4 grid gap-2"
        style={{ gridTemplateColumns: `repeat(auto-fit, minmax(7.5rem, 1fr))` }}
      >
        {items.map((it) => (
          <Link
            key={it.key}
            href={it.href}
            scroll={false}
            aria-current={it.active ? "page" : undefined}
            className={cn(
              "flex flex-col items-center gap-1.5 rounded-md px-2 py-3 transition-colors hover:bg-ink-50",
              it.active && "bg-ink-50 ring-1 ring-inset ring-ink-200",
            )}
          >
            <span className={cn("flex h-10 w-10 items-center justify-center rounded-full", TONE[it.tone].cirkel)}>
              {it.icon}
            </span>
            <span className="text-lg font-semibold tabular-nums text-ink-900">{it.count}</span>
            <span className={cn("text-xs", TONE[it.tone].label)}>{it.label}</span>
          </Link>
        ))}
      </div>
    </Card>
  );
}
