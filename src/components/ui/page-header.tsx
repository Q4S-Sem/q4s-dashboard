import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Paginakop in q4s.nl-stijl: een klein oranje bovenlabel, een zware kop met
 * strakke letterafstand en een oranje streepje eronder.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: {
  title: string;
  description?: string;
  /** Klein oranje label boven de kop, bv. de hub- of sectienaam. */
  eyebrow?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && <p className="q4s-eyebrow mb-2.5">{eyebrow}</p>}
        <h1 className="q4s-display text-[26px] sm:text-3xl">{title}</h1>
        <span className="q4s-rule mt-3" />
        {description && (
          <p className="mt-3 max-w-2xl text-sm text-ink-500">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {actions}
        </div>
      )}
    </div>
  );
}
