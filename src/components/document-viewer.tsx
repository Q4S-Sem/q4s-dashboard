"use client";

import { Download, ExternalLink, FileSpreadsheet } from "lucide-react";
import { documentSoort } from "@/lib/document-viewer";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Het geüploade document naast de uitgelezen velden — zodat de mens met één
// blik kan zien of de AI het goed gelezen heeft, zonder een tweede tabblad.
//
// Puur weergave: dit component haalt niets op en bewaart niets. Het krijgt een
// `src` (een van de auth-gated streaming-routes) en laat zien wat er bij dit
// bestandstype past; welke weergave dat is bepaalt `documentSoort`
// (src/lib/document-viewer.ts), niet dit bestand.
//
// Excel/CSV kunnen we niet tonen — dat is geen fout maar een nette terugval met
// dezelfde open-/downloadknoppen, zodat de controle altijd door kan.
// ---------------------------------------------------------------------------

/** Hoogte van het kijkvenster als de plek het niet zelf bepaalt. */
const STANDAARD_HOOGTE = "h-[380px] sm:h-[460px] lg:h-[520px]";

export function DocumentViewer({
  src,
  mimeType,
  originalName,
  titel = "Document",
  hoogte = STANDAARD_HOOGTE,
  className,
}: {
  /** De streaming-route die dit bestand serveert. */
  src: string;
  mimeType: string | null | undefined;
  originalName: string;
  /** Kopje boven het kader (bv. "Timesheet" of "Zijn factuur"). */
  titel?: string;
  /**
   * Hoogte-klassen van het kijkvenster zelf (niet van het kader eromheen), zodat
   * een breed scherm het document ook hóger mag tonen. Alle drie de weergaven
   * (pdf, afbeelding, terugval) delen dezelfde hoogte — anders springt het kader
   * per bestandstype.
   */
  hoogte?: string;
  className?: string;
}) {
  const soort = documentSoort(mimeType, originalName);

  return (
    <div className={cn("overflow-hidden rounded-md border border-ink-100 bg-white", className)}>
      {/* Werkbalk: wat je bekijkt + waar je het opent */}
      <div className="flex items-center gap-2 border-b border-ink-100 bg-ink-50/60 px-3 py-2">
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-bold uppercase tracking-wide text-ink-400">
            {titel}
          </span>
          <span className="block truncate text-[13px] text-ink-600" title={originalName}>
            {originalName}
          </span>
        </span>
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-semibold text-ink-500 hover:bg-white hover:text-ink-900"
        >
          <ExternalLink className="h-3.5 w-3.5" /> Open in nieuw tabblad
        </a>
        <a
          href={src}
          download={originalName}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-1 text-xs font-semibold text-ink-500 hover:bg-white hover:text-ink-900"
        >
          <Download className="h-3.5 w-3.5" /> Downloaden
        </a>
      </div>

      {soort === "pdf" ? (
        <iframe
          src={src}
          title={originalName}
          className={cn("block w-full border-0 bg-ink-50", hoogte)}
        />
      ) : soort === "afbeelding" ? (
        <div className={cn("flex items-center justify-center bg-ink-50 p-2", hoogte)}>
          {/* eslint-disable-next-line @next/next/no-img-element -- streaming-route, geen next/image-optimalisatie */}
          <img
            src={src}
            alt={`Voorbeeld van ${originalName}`}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      ) : (
        <div
          className={cn(
            "flex flex-col items-center justify-center gap-3 bg-ink-50/40 px-6 text-center",
            hoogte,
          )}
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-md border border-ink-200 bg-white text-emerald-600">
            <FileSpreadsheet className="h-6 w-6" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-ink-900">
              Voorbeeld niet beschikbaar voor dit bestandstype
            </span>
            <span className="mt-1 block truncate text-[13px] text-ink-500">{originalName}</span>
          </span>
          <span className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={src}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Openen
            </a>
            <a
              href={src}
              download={originalName}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-500 underline underline-offset-2 hover:text-ink-900"
            >
              <Download className="h-3.5 w-3.5" /> Downloaden
            </a>
          </span>
        </div>
      )}
    </div>
  );
}
