"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DateInput } from "@/components/ui/date-input";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Volgende/vorige maandag als "YYYY-MM-DD". */
function shiftWeek(week: string, delta: number): string {
  const d = new Date(`${week}T00:00:00`);
  d.setDate(d.getDate() + delta * 7);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * Week-navigator voor de verzendmap: vorige/volgende week + klikbare week-box
 * (zelfde kalender als /uren), plus een "Alle weken"-knop. Standaard staat de
 * verzendmap op "Alle weken" zodat je geen openstaande factuur mist; bladeren
 * beperkt tot één week. Behoudt de actieve tab + zoekopdracht.
 */
export function WeekNav({
  tab,
  q,
  week,
  currentWeek,
}: {
  tab: string;
  q: string;
  /** Actieve week ("YYYY-MM-DD") of "" voor alle weken. */
  week: string;
  /** Maandag van de huidige week — instappunt wanneer er nog geen week gekozen is. */
  currentWeek: string;
}) {
  const router = useRouter();
  const isAll = !week;
  const anchor = week || currentWeek;

  function go(w: string) {
    const params = new URLSearchParams({ tab });
    if (w) params.set("week", w);
    if (q) params.set("q", q);
    router.push(`/verzenden?${params.toString()}`, { scroll: false });
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => go(shiftWeek(anchor, -1))}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        <ChevronLeft className="h-4 w-4" /> Vorige week
      </button>

      <DateInput
        key={anchor}
        weekMode
        value={anchor}
        onValueChange={(v) => {
          if (v) go(v);
        }}
        className="w-64"
      />

      <button
        type="button"
        onClick={() => go(shiftWeek(anchor, 1))}
        className={buttonVariants({ variant: "outline", size: "sm" })}
      >
        Volgende week <ChevronRight className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={() => go("")}
        aria-pressed={isAll ? "true" : "false"}
        className={cn(
          "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
          isAll
            ? "bg-brand-600 text-white shadow-sm"
            : "border border-ink-200 text-ink-600 hover:bg-ink-50",
        )}
      >
        Alle weken
      </button>
    </div>
  );
}
