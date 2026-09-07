import { cn } from "@/lib/utils";
import type { WeekStripCel, WeekStripStatus } from "@/lib/week-koppeling";

// ---------------------------------------------------------------------------
// De WEEKSTROOK van één persoon: tien weken op een rij, zodat de eigenaar in één
// blik ziet welke weken verwerkt zijn en welke er nog ontbreken.
//
// Puur weergave: dit component rekent niets uit en haalt niets op. De cellen
// (met hun status) komen van buildWeekStrip (src/lib/week-koppeling.ts), gevoed
// door een server-query op de goedgekeurde urenstaten van deze plaatsing.
//
// Eén strakke rij die netjes afbreekt: gelijke, hoekige pillen met tabulaire
// weeknummers — geen blokken onder elkaar.
// ---------------------------------------------------------------------------

const STIJL: Record<WeekStripStatus, string> = {
  verwerkt: "border-emerald-200 bg-emerald-50 text-emerald-700",
  afwijking: "border-brand-300 bg-brand-50 text-brand-700",
  bezig: "border-blue-300 bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-300",
  loopt: "border-dashed border-ink-200 bg-white text-ink-400",
  ontbreekt: "border-amber-200 bg-amber-50 text-amber-700",
};

/** De legenda — alleen de drie toestanden waar de eigenaar iets mee moet. */
const LEGENDA: { status: WeekStripStatus; label: string }[] = [
  { status: "verwerkt", label: "verwerkt" },
  { status: "ontbreekt", label: "ontbreekt" },
  { status: "afwijking", label: "weekafwijking" },
];

export function WeekStrip({
  cellen,
  className,
}: {
  cellen: WeekStripCel[];
  className?: string;
}) {
  if (cellen.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2", className)}>
      <span className="text-[11px] font-bold uppercase tracking-wide text-ink-400">
        Laatste {cellen.length} weken
      </span>

      <div className="flex flex-wrap items-center gap-1">
        {cellen.map((cel) => (
          <span
            key={cel.key}
            title={cel.titel}
            aria-label={cel.titel}
            className={cn(
              "inline-flex min-w-[2.5rem] items-center justify-center rounded-sm border px-1.5 py-1 text-[11px] font-bold tabular-nums",
              STIJL[cel.status],
            )}
          >
            {cel.isoWeek}
          </span>
        ))}
      </div>

      <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-400">
        {LEGENDA.map((l) => (
          <span key={l.status} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2.5 w-2.5 rounded-[2px] border", STIJL[l.status])} />
            {l.label}
          </span>
        ))}
      </span>
    </div>
  );
}
