"use client";

import { useState } from "react";
import { Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { KANDIDAAT_STAPPEN } from "@/lib/kandidaat-flow";

/**
 * Stappenbalk van het kandidaatdossier. Opent op de stap waar hij staat, maar je
 * kunt zelf doorklikken (stap 2-4) — bijv. na "CV inladen" meteen naar Profiel
 * en Pipeline, zonder eerst een beoordeling te hoeven kiezen.
 */
export function StappenBalk({
  stap,
  panelen,
  kop,
}: {
  /** Waar de kandidaat nu staat (1-5, 5 = alles gedaan). */
  stap: number;
  /** De acties per stap: index 0 = Beoordelen, 1 = Profiel, 2 = Pipeline. */
  panelen: [React.ReactNode, React.ReactNode, React.ReactNode];
  /** Vaste regel tussen balk en acties (het spoor). */
  kop: React.ReactNode;
}) {
  const [open, setOpen] = useState(Math.min(Math.max(stap, 2), 4));

  return (
    <div className="overflow-hidden rounded-md border border-ink-200 bg-white">
      <ol className="grid grid-cols-2 border-b border-ink-100 sm:grid-cols-4">
        {KANDIDAAT_STAPPEN.map((label, i) => {
          const nr = i + 1;
          const klaar = nr < stap;
          const nu = nr === open;
          const klikbaar = nr >= 2;
          const inhoud = (
            <>
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  klaar && !nu ? "bg-emerald-600 text-white" : nu ? "bg-white text-ink-900" : "bg-ink-100",
                )}
              >
                {klaar && !nu ? <Check className="h-3 w-3" /> : nr}
              </span>
              {label}
            </>
          );
          const cls = cn(
            "flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm",
            nu ? "bg-ink-900 font-semibold text-white" : klaar ? "text-ink-700" : "text-ink-400",
            klikbaar && !nu && "cursor-pointer transition-colors hover:bg-ink-50 hover:text-ink-900",
          );
          return (
            <li key={label}>
              {klikbaar ? (
                <button type="button" onClick={() => setOpen(nr)} aria-current={nu ? "step" : undefined} className={cls}>
                  {inhoud}
                </button>
              ) : (
                <div className={cls}>{inhoud}</div>
              )}
            </li>
          );
        })}
      </ol>

      {kop}

      <div className="flex flex-wrap items-center gap-2.5 px-4 py-3 text-sm">
        {panelen[open - 2]}
        {open < 4 && (
          <button
            type="button"
            onClick={() => setOpen(open + 1)}
            className={buttonVariants({ variant: "ghost", size: "sm", className: "ml-auto" })}
          >
            Verder naar {KANDIDAAT_STAPPEN[open]} <ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
