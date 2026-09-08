"use client";

import { useEffect, useState } from "react";
import { Eye, ExternalLink, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { invoicePdfHref, invoicePdfPreviewHref } from "@/lib/factuur-bulk";

/**
 * Oog-knop die de echte verkoopfactuur-PDF in een volledig-schermvoorbeeld toont
 * (dezelfde renderer als de detailpagina en de verzending). Gedeeld door de
 * facturenlijst en de verzendmap, zodat "bekijken" overal identiek werkt.
 */
export function InvoicePreviewButton({
  id,
  number,
  label = "Voorbeeld",
}: {
  id: string;
  number: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonVariants({ variant: "outline", size: "sm" })}
        title="Bekijk de definitieve factuur-PDF"
        aria-label={`Factuur ${number} bekijken`}
      >
        <Eye className="h-4 w-4" /> {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] flex flex-col bg-black/70 p-3 sm:p-6"
          role="dialog"
          aria-modal="true"
          aria-label={`Factuur ${number}`}
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden rounded-lg border border-ink-200 bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 border-b border-ink-100 px-4 py-3">
              <h2 className="text-sm font-semibold text-ink-900">Factuur {number}</h2>
              <div className="flex items-center gap-2">
                <a
                  href={invoicePdfHref(id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <ExternalLink className="h-4 w-4" /> Openen / printen
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
              title={`Factuur ${number}`}
              src={invoicePdfPreviewHref(id)}
              className="min-h-0 w-full flex-1 border-0 bg-ink-100"
            />
          </div>
        </div>
      )}
    </>
  );
}
