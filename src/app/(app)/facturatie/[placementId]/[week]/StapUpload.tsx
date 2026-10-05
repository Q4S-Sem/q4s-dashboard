"use client";

import { useActionState, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Dropzone } from "@/components/ui/dropzone";
import { uploadVoorPersoon, type UploadState } from "../../actions";

/** Groen vak met een vink die erin "popt": dit onderdeel is binnen en uitgelezen. */
export function KlaarVak({ tekst }: { tekst: string }) {
  return (
    <div role="status" className="animate-card-in mt-3 flex h-24 flex-col items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 text-[13px] font-medium text-emerald-800">
      <span className="animate-dialog-in flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-white shadow-sm">
        {/* De vink tekent zichzelf in (spark-draw uit globals.css, pathLength=100). */}
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M5 12.5l4.5 4.5L19 7.5" pathLength={100} className="animate-spark-draw" />
        </svg>
      </span>
      {tekst}
    </div>
  );
}

/**
 * Sleepvak binnen een stap van het dossier: bestand erin = meteen uitlezen en
 * controleren (geen aparte knop). Hoort altijd bij deze persoon.
 */
export function StapUpload({
  soort,
  week,
  consultantId,
  placementId,
}: {
  soort: "file" | "factuur";
  week: string;
  consultantId: string;
  placementId: string;
}) {
  const form = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadVoorPersoon, {});
  return (
    <form ref={form} action={action} className="mt-3 space-y-1.5">
      <input type="hidden" name="week" value={week} />
      <input type="hidden" name="consultantId" value={consultantId} />
      <input type="hidden" name="placementId" value={placementId} />
      {!pending && state.melding && !state.fouten?.length ? (
        // Gelukt: vink tot de pagina ververst en de stap zelf groen wordt.
        <KlaarVak tekst="Uitgelezen en verwerkt" />
      ) : pending ? (
        <div className="flex h-24 items-center justify-center gap-2 rounded-lg border border-dashed border-ink-300 bg-ink-50 text-[13px] text-ink-600">
          <Loader2 className="h-4 w-4 animate-spin" /> Uitlezen en controleren…
        </div>
      ) : (
        <Dropzone
          name={soort}
          compact
          accept={soort === "file" ? ".pdf,.png,.jpg,.jpeg,.webp,.gif,.xlsx,.xls,.csv" : ".pdf,.png,.jpg,.jpeg,.webp,.gif"}
          label={soort === "file" ? "Sleep de urenstaat hier" : "Sleep de factuur hier"}
          hint="of klik om te kiezen"
          onFilesChange={(f) => f.length > 0 && form.current?.requestSubmit()}
        />
      )}
      {!pending && (state.error || state.fouten?.length) && (
        <p className="text-xs text-red-600">{state.error ?? state.fouten?.join(" ")}</p>
      )}
    </form>
  );
}
