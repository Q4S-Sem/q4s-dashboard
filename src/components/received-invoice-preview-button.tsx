"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, ExternalLink, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

/**
 * Oog-knop die de GEUPLOADE factuur van de ZZP'er (hun eigen PDF/afbeelding)
 * in een volledig-schermvoorbeeld toont — dezelfde bron als de detailpagina
 * (`/api/ontvangen-factuur/<id>`). Zo kun je "bekijken" zonder eerst door te
 * klikken naar de detailpagina.
 *
 * Het venster gaat via een PORTAL op document.body zodat het nooit achter een
 * kaart/tabelcel valt (stacking-context) en de factuur altijd het hele scherm vult.
 */
export function ReceivedInvoicePreviewButton({
  id,
  name,
  hasFile = true,
  className,
}: {
  id: string;
  /** Naam van de medewerker/factuur voor de titel + aria-label. */
  name: string;
  hasFile?: boolean;
  /** Override voor de knopstijl (standaard: nette icoon-box zoals in de lijst). */
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const src = `/api/ontvangen-factuur/${id}`;
  const disabled = !hasFile;

  return (
    <>
      <button
        type="button"
        onClick={() => !disabled && setOpen(true)}
        disabled={disabled}
        title={disabled ? "Geen bestand bijgevoegd" : "Bekijk de factuur"}
        aria-label={`Factuur van ${name} bekijken`}
        className={
          className ??
          cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-xl border border-transparent transition-colors",
            "text-ink-500 hover:border-ink-200 hover:bg-ink-100",
            disabled && "cursor-not-allowed opacity-40 hover:border-transparent hover:bg-transparent",
          )
        }
      >
        <Eye className="h-4 w-4" />
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex flex-col bg-black/70 p-3 sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-label={`Factuur van ${name}`}
            onClick={() => setOpen(false)}
          >
            <div
              className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-ink-200 bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
                <h2 className="truncate text-sm font-semibold text-ink-900">
                  Factuur — {name}
                </h2>
                <div className="flex items-center gap-2">
                  <a
                    href={src}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <ExternalLink className="h-4 w-4" /> Nieuw tabblad
                  </a>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className={buttonVariants({ variant: "ghost", size: "icon" })}
                    aria-label="Sluiten"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <iframe
                title={`Factuur van ${name}`}
                src={src}
                className="min-h-0 w-full flex-1 border-0 bg-ink-100"
              />
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
