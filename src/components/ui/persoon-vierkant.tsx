import { cn } from "@/lib/utils";
import { initialen } from "@/lib/weekverwerking";

// ---------------------------------------------------------------------------
// Het initialen-vierkantje van een freelancer/medewerker. ÉÉN component, zodat
// "Week verwerken" en "Urenregistratie" er gegarandeerd identiek uitzien.
// Rustig grijs vlak met donkere initialen — past bij de zwart-witte huisstijl en
// blijft ook in een dichte lijst overzichtelijk.
// ---------------------------------------------------------------------------

const SIZE = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-[13px]",
} as const;

export function PersoonVierkant({
  naam,
  size = "md",
  className,
}: {
  naam: string;
  size?: keyof typeof SIZE;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-sm bg-ink-100 font-bold text-ink-700",
        SIZE[size],
        className,
      )}
    >
      {initialen(naam)}
    </span>
  );
}

/** Boven dit aantal mensen schakelen de personen-lijsten naar een compacte
 *  weergave (één rij per persoon), zodat een grote ploeg overzichtelijk blijft. */
export const COMPACT_PERSONEN_DREMPEL = 50;
