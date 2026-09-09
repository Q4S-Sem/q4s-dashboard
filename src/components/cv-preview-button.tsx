"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Eye, ExternalLink, X, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Oog-knop die het ZOJUIST GEKOZEN CV-bestand (nog niet geüpload) toont in een
 * volledig-schermvoorbeeld, zodat je zelf iets uit het CV kunt overnemen dat de
 * AI niet heeft meegepakt. Werkt op de client via een object-URL — geen server
 * nodig, want het bestand zit al in de browser.
 *
 * PDF's en afbeeldingen worden inline gerenderd (iframe). Word (.docx) kan een
 * browser niet inline tonen; dan bieden we "openen in nieuw tabblad" + download,
 * zodat je 'm alsnog kunt bekijken.
 *
 * Portal op document.body (zoals InvoicePreviewButton) zodat het venster nooit
 * inzakt in een tabelcel/stacking-context.
 */
export function CvPreviewButton({
  file,
  label,
  className,
}: {
  file: File | null;
  /** Optioneel label naast het oogje; standaard alleen het icoon. */
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  // Object-URL alleen aanmaken zolang nodig; netjes weer vrijgeven.
  const url = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

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

  if (!file || !url) return null;

  const name = file.name.toLowerCase();
  const type = (file.type || "").toLowerCase();
  const isPdf = type.includes("pdf") || name.endsWith(".pdf");
  const isImage = /^image\//.test(type) || /\.(png|jpe?g|gif|webp)$/.test(name);
  const canInline = isPdf || isImage;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline",
          className,
        )}
        title="Bekijk het CV — kopieer zelf wat de AI miste"
        aria-label="CV bekijken"
      >
        <Eye className="h-4 w-4" />
        {label ? <span>{label}</span> : null}
      </button>

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-8">
            <div
              className="fixed inset-0 bg-ink-900/60 backdrop-blur-sm"
              aria-hidden
              onClick={() => setOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`CV: ${file.name}`}
              className="relative z-10 flex h-full max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-ink-200 bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between gap-3 border-b border-ink-100 bg-ink-50/60 px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-4 w-4 shrink-0 text-brand-600" />
                  <span className="truncate text-sm font-semibold text-ink-800" title={file.name}>
                    {file.name}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-md border border-ink-200 bg-white px-2.5 py-1.5 text-xs font-medium text-ink-700 hover:bg-ink-50"
                  >
                    <ExternalLink className="h-3.5 w-3.5" /> Nieuw tabblad
                  </a>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Sluiten"
                    className="rounded-md p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="min-h-0 flex-1 bg-ink-50">
                {canInline ? (
                  isImage ? (
                    <div className="flex h-full items-center justify-center overflow-auto p-4">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={url} alt={file.name} className="max-h-full max-w-full object-contain" />
                    </div>
                  ) : (
                    <iframe src={url} title={file.name} className="h-full w-full border-0" />
                  )
                ) : (
                  <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
                    <FileText className="h-10 w-10 text-ink-300" />
                    <p className="max-w-sm text-sm text-ink-600">
                      Een Word-bestand (.docx) kan niet in de browser worden getoond. Open het in een
                      nieuw tabblad of download het om zelf gegevens over te nemen.
                    </p>
                    <a
                      href={url}
                      download={file.name}
                      className="inline-flex items-center gap-1.5 rounded-md bg-brand-600 px-3 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                    >
                      <ExternalLink className="h-4 w-4" /> CV openen / downloaden
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
