"use client";

import { useEffect, useState } from "react";
import { Eye, X, ExternalLink } from "lucide-react";
import { cn, formatHours } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type PeekDay = { label: string; hours: number; weekend: boolean };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-ink-50 px-2 py-2">
      <div className="text-sm font-bold tabular-nums text-ink-900">{value}</div>
      <div className="text-[11px] uppercase tracking-wide text-ink-400">{label}</div>
    </div>
  );
}

/** A "Bekijken" button that shows the timesheet's key info in a quick modal —
 *  uren per dag + km + overuren — without leaving the wizard. */
export function TimesheetPeek({
  weekLabel,
  clientName,
  placementTitle,
  hours,
  kilometers,
  overtimeHours,
  days,
  urenstaatHref,
}: {
  weekLabel: string;
  clientName: string;
  placementTitle: string;
  hours: number;
  kilometers: number;
  overtimeHours: number;
  days: PeekDay[];
  urenstaatHref: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonVariants({ variant: "outline", size: "sm" })}
        title="Snel bekijken — uren per dag + kilometers"
      >
        <Eye className="h-4 w-4" /> Bekijken
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="absolute inset-0 bg-ink-900/40"
            onClick={() => setOpen(false)}
          />
          <div className="relative w-full max-w-md rounded-2xl border border-ink-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="text-base font-bold text-ink-900">{weekLabel}</h3>
                <p className="truncate text-xs text-ink-500">
                  {clientName} · {placementTitle}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Sluiten"
                className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <Stat label="Uren" value={`${formatHours(hours)} u`} />
              <Stat label="Kilometers" value={`${formatHours(kilometers)} km`} />
              <Stat label="Overuren" value={`${formatHours(overtimeHours)} u`} />
            </div>

            <p className="mb-1.5 mt-4 text-xs font-medium uppercase tracking-wide text-ink-400">
              Uren per dag
            </p>
            <div className="overflow-hidden rounded-lg border border-ink-100">
              {days.length === 0 ? (
                <p className="px-3 py-3 text-sm text-ink-400">
                  Geen uren geregistreerd.
                </p>
              ) : (
                days.map((d, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-between px-3 py-1.5 text-sm",
                      d.weekend && "bg-amber-50",
                      i > 0 && "border-t border-ink-50",
                    )}
                  >
                    <span className="capitalize text-ink-600">
                      {d.label}
                      {d.weekend && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                          weekend
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        d.hours > 0 ? "text-ink-800" : "text-ink-300",
                      )}
                    >
                      {formatHours(d.hours)} u
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="mt-4 flex justify-end">
              <a
                href={urenstaatHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
              >
                Volledige urenstaat <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
