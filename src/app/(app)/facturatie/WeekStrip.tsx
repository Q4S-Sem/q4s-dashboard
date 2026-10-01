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
  basePath = "/facturatie",
  alleWeken = false,
}: {
  /** Gekozen week als "2026-W40", of leeg = alle weken (alleen met alleWeken). */
  huidig: string | null;
  /** Vandaag als "YYYY-MM-DD". */
  vandaag: string;
  extra?: Record<string, string | undefined>;
  basePath?: string;
  /** Toon een "Alle weken"-knop (lijsten die standaard niet op week filteren). */
  alleWeken?: boolean;
}) {
  const nu = weekSlotVanDatum(vandaag);
  const gekozen = weekSlotVanKey(huidig);
  // Geen week gekozen = "alle weken": de strip staat dan rond vandaag, zonder actieve week.
  const midden = gekozen ?? nu;
  if (!midden || !nu) return null;

  const href = (slot: WeekSlot | null) => {
    const q = new URLSearchParams(slot ? { week: slot.monday } : {});
    for (const [k, v] of Object.entries(extra ?? {})) if (v) q.set(k, v);
    const qs = q.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  // Gekozen week + 3 ervoor + 1 erna.
  const weken: WeekSlot[] = [midden];
  for (let i = 0; i < 3; i++) weken.unshift(vorigeWeek(weken[0])!);
  weken.push(volgendeWeek(midden)!);

  const pijl = "flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-ink-100 hover:text-ink-900";
  return (
    <div className="flex items-center gap-1 rounded-lg border border-ink-200 bg-white p-1">
      <Link href={href(vorigeWeek(midden))} scroll={false} className={pijl} aria-label="Vorige week">
        <ChevronLeft className="h-4 w-4" />
      </Link>
      {weken.map((w) => {
        const actief = w.key === gekozen?.key;
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
      <Link href={href(volgendeWeek(midden))} scroll={false} className={pijl} aria-label="Volgende week">
        <ChevronRight className="h-4 w-4" />
      </Link>
      {gekozen && gekozen.key !== nu.key && (
        <Link
          href={href(nu)}
          scroll={false}
          className="ml-1 h-8 rounded-md border border-ink-200 px-2.5 text-[13px] font-medium leading-8 text-ink-700 hover:bg-ink-50"
        >
          Deze week
        </Link>
      )}
      {alleWeken && (
        <Link
          href={href(null)}
          scroll={false}
          aria-current={!gekozen ? "page" : undefined}
          className={cn(
            "ml-1 h-8 rounded-md px-2.5 text-[13px] font-medium leading-8",
            !gekozen ? "bg-ink-900 text-white" : "border border-ink-200 text-ink-700 hover:bg-ink-50",
          )}
        >
          Alle weken
        </Link>
      )}
    </div>
  );
}
