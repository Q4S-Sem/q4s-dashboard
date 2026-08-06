import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Paginakop: titel, korte uitleg en rechts de acties. Bewust rustig — de
 * nadruk ligt op leesbaarheid, niet op een grafisch gebaar.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  leading,
  actions,
  className,
}: {
  title: string;
  description?: string;
  /** Klein label boven de kop, bv. de hub- of sectienaam. */
  eyebrow?: string;
  /** Element vóór de titel, bv. een profielfoto. */
  leading?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-4">
        {leading}
        <div className="min-w-0">
          {eyebrow && <p className="q4s-eyebrow mb-1">{eyebrow}</p>}
          <h1 className="q4s-display text-[26px]">{title}</h1>
          {description && (
            <p className="mt-1.5 max-w-2xl text-[15px] leading-relaxed text-ink-500">
              {description}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
