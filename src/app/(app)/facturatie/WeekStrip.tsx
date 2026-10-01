import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { vorigeWeek, volgendeWeek, weekSlotVanKey } from "@/lib/wizard-weeknav";
import { weekSlotVanDatum, type WeekSlot } from "@/lib/week-koppeling";

/**
 * Compacte weekkiezer: ‹ [wk 37][wk 38][wk 39][wk 40][wk 41] › + "Deze week".
 * Eén klik = andere week. Filter/zoekterm blijven staan.
 */
export function WeekStrip({
  huidig,
  vandaag,
  extra,
}: {
  /** Gekozen week als "2026-W40". */
  huidig: string;
  /** Vandaag als "YYYY-MM-DD". */
  vandaag: string;
  extra?: Record<string, string | undefined>;
}) {
  const gekozen = weekSlotVanKey(huidig);
  const nu = weekSlotVanDatum(vandaag);
  if (!gekozen || !nu) return null;

  const href = (slot: WeekSlot | null) => {
    const q = new URLSearchParams({ week: slot?.monday ?? gekozen.monday });
    for (const [k, v] of Object.entries(extra ?? {})) if (v) q.set(k, v);
    return `/facturatie?${q.toString()}`;
  };

  // Gekozen week + 3 ervoor + 1 erna.
  const weken: WeekSlot[] = [gekozen];
  for (let i = 0; i < 3; i++) weken.unshift(vorigeWeek(weken[0])!);
  weken.push(volgendeWeek(gekozen)!);

  const pijl = "flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-ink-100 hover:text-ink-900";
  return (
    <div className="flex items-center gap-1 rounded-lg border border-ink-200 bg-white p-1">
      <Link href={href(vorigeWeek(gekozen))} scroll={false} className={pijl} aria-label="Vorige week">
        <ChevronLeft className="h-4 w-4" />
      </Link>
      {weken.map((w) => {
        const actief = w.key === gekozen.key;
        const isNu = w.key === nu.key;
        return (
          <Link
            key={w.key}
            href={href(w)}
            scroll={false}
            aria-current={actief ? "page" : undefined}
            title={`Week ${w.isoWeek}`}
            className={cn(
              "relative h-8 min-w-[3.25rem] rounded-md px-2 text-center text-[13px] font-medium leading-8 tabular-nums transition-colors",
              actief ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100",
            )}
          >
            wk {w.isoWeek}
            {isNu && (
              <span className={cn("absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full", actief ? "bg-white" : "bg-ink-900")} />
            )}
          </Link>
        );
      })}
      <Link href={href(volgendeWeek(gekozen))} scroll={false} className={pijl} aria-label="Volgende week">
        <ChevronRight className="h-4 w-4" />
      </Link>
      {gekozen.key !== nu.key && (
        <Link
          href={href(nu)}
          scroll={false}
          className="ml-1 h-8 rounded-md border border-ink-200 px-2.5 text-[13px] font-medium leading-8 text-ink-700 hover:bg-ink-50"
        >
          Deze week
        </Link>
      )}
    </div>
  );
}
