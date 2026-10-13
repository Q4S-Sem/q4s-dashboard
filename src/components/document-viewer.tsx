"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, FileSpreadsheet, RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import { documentSoort } from "@/lib/document-viewer";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

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
  // Draaien (scans komen soms liggend binnen) en inzoomen — puur weergave.
  const [draai, setDraai] = useState(0);
  const [zoom, setZoom] = useState(1);
  const vak = useRef<HTMLDivElement>(null);
  const [maat, setMaat] = useState({ b: 0, h: 0 });
  useEffect(() => {
    const el = vak.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setMaat({ b: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const liggend = draai % 180 !== 0;
  // Gedraaid 90°/270°: breedte en hoogte wisselen, anders past hij niet in het vak.
  const inhoud = { b: (liggend ? maat.h : maat.b) * zoom, h: (liggend ? maat.b : maat.h) * zoom };
  const kanBedienen = soort === "pdf" || soort === "afbeelding";
  const knop = "flex h-8 w-8 items-center justify-center rounded-md text-ink-500 hover:bg-white hover:text-ink-900 disabled:opacity-40";

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
        {kanBedienen && (
          <span className="flex shrink-0 items-center rounded-md border border-ink-200 bg-ink-50 p-0.5">
            <button type="button" className={knop} onClick={() => setZoom((z) => Math.max(1, +(z - 0.25).toFixed(2)))} disabled={zoom <= 1} title="Uitzoomen" aria-label="Uitzoomen">
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="w-10 text-center text-xs tabular-nums text-ink-500">{Math.round(zoom * 100)}%</span>
            <button type="button" className={knop} onClick={() => setZoom((z) => Math.min(3, z + 0.25))} disabled={zoom >= 3} title="Inzoomen" aria-label="Inzoomen">
              <ZoomIn className="h-4 w-4" />
            </button>
            <button type="button" className={knop} onClick={() => setDraai((d) => (d + 90) % 360)} title="Draaien (90°)" aria-label="Document 90 graden draaien">
              <RotateCw className="h-4 w-4" />
            </button>
          </span>
        )}
        <a
          href={src}
          target="_blank"
          rel="noopener noreferrer"
          title="Open in nieuw tabblad"
          className={buttonVariants({ variant: "ghost", size: "sm", className: "shrink-0" })}
        >
          <ExternalLink className="h-3.5 w-3.5" /> Openen
        </a>
        <a
          href={src}
          download={originalName}
          className={buttonVariants({ variant: "ghost", size: "sm", className: "shrink-0" })}
        >
          <Download className="h-3.5 w-3.5" /> Downloaden
        </a>
      </div>

      {kanBedienen ? (
        <div ref={vak} className={cn("relative overflow-auto bg-ink-50", hoogte)}>
          {maat.b > 0 && (
            <div style={{ width: liggend ? inhoud.h : inhoud.b, height: liggend ? inhoud.b : inhoud.h, position: "relative" }}>
              <div
                style={{
                  width: inhoud.b,
                  height: inhoud.h,
                  position: "absolute",
                  left: "50%",
                  top: "50%",
                  transform: `translate(-50%, -50%) rotate(${draai}deg)`,
                }}
              >
                {soort === "pdf" ? (
                  <iframe src={src} title={originalName} className="block h-full w-full border-0 bg-ink-50" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element -- streaming-route, geen next/image-optimalisatie
                  <img src={src} alt={`Voorbeeld van ${originalName}`} className="h-full w-full object-contain p-2" />
                )}
              </div>
            </div>
          )}
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
