"use client";

import { useActionState, useRef } from "react";
import { Loader2 } from "lucide-react";
import { Dropzone } from "@/components/ui/dropzone";
import { uploadVoorPersoon, type UploadState } from "../../actions";

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
      {pending ? (
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
