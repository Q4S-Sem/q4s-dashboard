"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Phone, X, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Telefoon-icoonknop die bij klik een pop-up (modal) toont met het telefoonnummer.
 * De pop-up biedt "Bellen" (tel:-link) en "Kopiëren". Dashboard-breed herbruikbaar.
 *
 * Geen nummer bekend → een uitgegrijsde, niet-klikbare knop (geen pop-up).
 */
export function PhoneButton({
  phone,
  name,
  className,
}: {
  phone: string | null | undefined;
  /** Optionele naam die in de pop-up boven het nummer komt. */
  name?: string;
  /** Extra classes voor de icoonknop (grootte/vorm blijft gelijk). */
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  if (!phone) {
    return (
      <span
        className={cn(
          "inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-ink-300",
          className,
        )}
        title="Geen telefoonnummer bekend"
        aria-hidden
      >
        <Phone className="h-4 w-4" />
      </span>
    );
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(phone as string);
      setCopied(true);
    } catch {
      /* clipboard geweigerd — negeer stil */
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(true);
        }}
        title="Telefoonnummer tonen"
        aria-label="Telefoonnummer tonen"
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition-colors hover:bg-emerald-200",
          className,
        )}
      >
        <Phone className="h-4 w-4" />
      </button>

      {mounted &&
        open &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div
              className="animate-overlay-in fixed inset-0 bg-ink-900/50 backdrop-blur-sm"
              aria-hidden
              onClick={() => setOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              className="animate-dialog-in relative z-10 w-full max-w-xs overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-[0_24px_60px_-15px_rgb(0_0_0/0.35)]"
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Sluiten"
                className="absolute right-3 top-3 rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex flex-col items-center px-6 pb-5 pt-7 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                  <Phone className="h-5 w-5" />
                </span>
                {name && <p className="mt-3 text-sm font-medium text-ink-700">{name}</p>}
                <a
                  href={`tel:${phone}`}
                  className="mt-1 text-xl font-semibold tabular-nums text-ink-900 hover:text-emerald-700"
                >
                  {phone}
                </a>
              </div>

              <div className="flex gap-2 border-t border-ink-100 bg-ink-50/60 px-4 py-3">
                <a
                  href={`tel:${phone}`}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-700"
                >
                  <Phone className="h-4 w-4" /> Bellen
                </a>
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-ink-200 bg-white px-3 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50"
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" /> Gekopieerd
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4" /> Kopiëren
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
