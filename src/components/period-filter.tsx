"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn, getISOWeek, startOfISOWeek } from "@/lib/utils";
import { DateInput } from "@/components/ui/date-input";

/**
 * Gedeelde periode-filter voor de factuuroverzichten (verkoop + inkoop). Toggle
 * tussen Alles / Week / Maand / Kwartaal / Jaar met vorige/volgende en "Nu". In
 * Week-stand is het label de klikbare week-box (zelfde kalender als /uren).
 * Ouder-component houdt gran + anchor vast en berekent het bereik via periodRange.
 */

export type Gran = "all" | "week" | "month" | "quarter" | "year";

const MONTHS = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];
const dm = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" });
const dmy = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });

export const GRANS: { key: Gran; label: string }[] = [
  { key: "all", label: "Alles" },
  { key: "week", label: "Week" },
  { key: "month", label: "Maand" },
  { key: "quarter", label: "Kwartaal" },
  { key: "year", label: "Jaar" },
];

/** [start, end) millis voor de gekozen periode rond `anchor`, plus een label. */
export function periodRange(
  g: Gran,
  anchor: Date,
): { start: number; end: number; label: string } | null {
  if (g === "all") return null;
  const y = anchor.getFullYear();
  if (g === "week") {
    const mon = startOfISOWeek(anchor);
    const sun = new Date(mon);
    sun.setDate(sun.getDate() + 6);
    const end = new Date(mon);
    end.setDate(end.getDate() + 7);
    return {
      start: mon.getTime(),
      end: end.getTime(),
      label: `Week ${getISOWeek(mon)} · ${dm.format(mon)} – ${dmy.format(sun)}`,
    };
  }
  if (g === "month") {
    return {
      start: new Date(y, anchor.getMonth(), 1).getTime(),
      end: new Date(y, anchor.getMonth() + 1, 1).getTime(),
      label: `${MONTHS[anchor.getMonth()]} ${y}`,
    };
  }
  if (g === "quarter") {
    const q = Math.floor(anchor.getMonth() / 3);
    return {
      start: new Date(y, q * 3, 1).getTime(),
      end: new Date(y, q * 3 + 3, 1).getTime(),
      label: `Q${q + 1} ${y}`,
    };
  }
  return {
    start: new Date(y, 0, 1).getTime(),
    end: new Date(y + 1, 0, 1).getTime(),
    label: `${y}`,
  };
}

function shift(g: Gran, anchor: Date, dir: number): Date {
  const y = anchor.getFullYear();
  const m = anchor.getMonth();
  // Week houdt de weekdag (±7 dagen). Maand/kwartaal/jaar snappen eerst naar dag 1
  // zodat een dag-31 anchor niet via setMonth een periode overslaat.
  if (g === "week") {
    const d = new Date(anchor);
    d.setDate(d.getDate() + dir * 7);
    return d;
  }
  if (g === "month") return new Date(y, m + dir, 1);
  if (g === "quarter") return new Date(y, m + dir * 3, 1);
  if (g === "year") return new Date(y + dir, m, 1);
  return anchor;
}

/** Maandag van de week van `d` als "YYYY-MM-DD" (voor de week-box). */
function weekYmd(d: Date): string {
  const mon = startOfISOWeek(d);
  const mm = String(mon.getMonth() + 1).padStart(2, "0");
  const dd = String(mon.getDate()).padStart(2, "0");
  return `${mon.getFullYear()}-${mm}-${dd}`;
}

export function PeriodFilter({
  gran,
  anchor,
  onGran,
  onAnchor,
}: {
  gran: Gran;
  anchor: Date;
  onGran: (g: Gran) => void;
  onAnchor: (d: Date) => void;
}) {
  const range = periodRange(gran, anchor);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-ink-200 bg-white p-4 shadow-sm">
      <div className="inline-flex rounded-lg border border-ink-200 bg-ink-50 p-1 text-sm">
        {GRANS.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => onGran(g.key)}
            className={cn(
              "rounded-md px-3 py-1.5 font-medium transition-colors",
              gran === g.key
                ? "bg-white text-brand-700 shadow-sm"
                : "text-ink-600 hover:text-ink-900",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>
      {range && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Vorige periode"
            onClick={() => onAnchor(shift(gran, anchor, -1))}
            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {gran === "week" ? (
            <DateInput
              weekMode
              value={weekYmd(anchor)}
              onValueChange={(v) => {
                if (v) onAnchor(new Date(`${v}T00:00:00`));
              }}
              className="w-60"
            />
          ) : (
            <span className="min-w-[11rem] text-center text-sm font-semibold capitalize text-ink-800">
              {range.label}
            </span>
          )}
          <button
            type="button"
            aria-label="Volgende periode"
            onClick={() => onAnchor(shift(gran, anchor, 1))}
            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => onAnchor(new Date())}
            className="ml-1 rounded-lg px-2 py-1 text-sm font-medium text-brand-700 hover:bg-brand-50"
          >
            Nu
          </button>
        </div>
      )}
    </div>
  );
}
