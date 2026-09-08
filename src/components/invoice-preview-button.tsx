"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, ExternalLink, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { invoicePdfHref, invoicePdfPreviewHref } from "@/lib/factuur-bulk";

/**
 * Oog-knop die de echte verkoopfactuur-PDF in een volledig-schermvoorbeeld toont
 * (dezelfde renderer als de detailpagina en de verzending). Gedeeld door de
 * facturenlijst en de verzendmap, zodat "bekijken" overal identiek werkt.
 *
 * Het venster wordt via een PORTAL op document.body gezet: zo valt het nooit
 * samen met een tabelcel of andere stacking-context (waar `position: fixed` +
 * flex-hoogte inzakt) en vult de PDF altijd het hele scherm.
 */
export function InvoicePreviewButton({
  id,
  number,
  label,
}: {
  id: string;
  number: string;
  /** Optioneel label naast het oogje; standaard alleen het icoon (zoals /facturen). */
  label?: string;
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

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonVariants(
          label
            ? { variant: "outline", size: "sm" }
            : { variant: "ghost", size: "icon" },
        )}
        title="Bekijk de definitieve factuur-PDF"
        aria-label={`Factuur ${number} bekijken`}
      >
        <Eye className="h-4 w-4" />
        {label ? <span className="ml-1.5">{label}</span> : null}
      </button>

      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-[100] flex flex-col bg-black/70 p-3 sm:p-6"
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
          </div>,
          document.body,
        )}
    </>
  );
}
