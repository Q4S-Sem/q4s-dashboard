import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { WeekPicker } from "@/components/week-picker";
import { cn, formatDate } from "@/lib/utils";
import { parseWeek, shiftWeek, weekHref } from "@/lib/week-nav";

// ---------------------------------------------------------------------------
// DE WEEK-BALK — één en dezelfde week-navigator op élke facturatiepagina.
//
// "‹ Vorige week" · de klikbare week-box ("Week 37 · 7 sep – 13 sep 2026") ·
// "Volgende week ›", met daaronder één regel die vertelt welke week je ziet.
// Eén rij, gecentreerd, en op smalle schermen breekt hij netjes af.
//
// Vroeger had elke pagina hier zijn eigen kopie van (uren, inbox, inbox/status,
// verzenden, ontvangen-facturen), met net andere breedtes en ondertitels. Dit is
// die ene balk: hij ziet er overal hetzelfde uit en rekent overal hetzelfde
// (src/lib/week-nav.ts).
//
// De balk NAVIGEERT alleen — hij zet `?week=` in de URL. Wat er met die week
// gebeurt bepaalt de pagina zelf; de balk filtert niets en verandert niets.
// ---------------------------------------------------------------------------

export function WeekBalk({
  basePath,
  week,
  currentWeek,
  extraParams,
  allWeeks = false,
}: {
  /** Pad van de pagina zelf, bv. "/uren" of "/verzenden". */
  basePath: string;
  /** De getoonde week als "YYYY-MM-DD" (maandag). Leeg = alle weken. */
  week: string;
  /** Maandag van de huidige week als "YYYY-MM-DD" — voor "· huidige week". */
  currentWeek: string;
  /** Filters die behouden moeten blijven bij het bladeren, bv. `{ tab, q }`. */
  extraParams?: Record<string, string | null | undefined>;
  /**
   * Toon een "Alle weken"-knop. Voor de schermen waar je niets mag missen (de
   * verzendmap, de ontvangen facturen, de wachtkamer, de betalingen): daar is
   * "alles" de veilige stand en filtert de balk pas als je een week kiest.
   */
  allWeeks?: boolean;
}) {
  // Zonder gekozen week bladert de balk verder vanaf de huidige week.
  const anchor = week || currentWeek;
  const isAlleWeken = allWeeks && !week;
  const isHuidigeWeek = !isAlleWeken && anchor === currentWeek;
  const anchorDate = parseWeek(anchor);

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Link
          href={weekHref(basePath, shiftWeek(anchor, -1), extraParams)}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ChevronLeft className="h-4 w-4" /> Vorige week
        </Link>

        <WeekPicker value={anchor} basePath={basePath} params={extraParams} className="w-72 max-w-full" />

        <Link
          href={weekHref(basePath, shiftWeek(anchor, 1), extraParams)}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Volgende week <ChevronRight className="h-4 w-4" />
        </Link>

        {allWeeks && (
          <Link
            href={weekHref(basePath, null, extraParams)}
            aria-current={isAlleWeken ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center rounded-sm border px-3 text-sm font-semibold transition-all active:translate-y-px",
              isAlleWeken
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-ink-200 bg-white text-ink-800 hover:border-ink-900 hover:bg-ink-50",
            )}
          >
            Alle weken
          </Link>
        )}
      </div>

      <p className="text-center text-xs text-ink-400">
        {isAlleWeken
          ? "alle weken · kies een week om te filteren"
          : `week van ${formatDate(anchorDate)}${isHuidigeWeek ? " · huidige week" : ""}`}
      </p>
    </div>
  );
}
