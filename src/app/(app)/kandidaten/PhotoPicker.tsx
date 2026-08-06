"use client";

import { useRef, useState } from "react";
import { Camera, X } from "lucide-react";
import { Avatar, type AvatarSize } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

/**
 * De profielfoto zelf is de knop: klik erop en je kiest meteen een bestand, dat
 * daarna vanzelf wordt geüpload. Geen aparte "Bestand kiezen"- en
 * "Uploaden"-knoppen meer — die maakten van één handeling er drie.
 *
 * Staat er al een foto, dan verschijnt bij hover een klein kruisje om hem weg
 * te halen.
 */
export function PhotoPicker({
  candidateId,
  name,
  src,
  size = "lg",
  uploadAction,
  deleteAction,
}: {
  candidateId: string;
  name: string;
  src: string | null;
  size?: AvatarSize;
  uploadAction: (formData: FormData) => void | Promise<void>;
  deleteAction: (formData: FormData) => void | Promise<void>;
}) {
  const uploadRef = useRef<HTMLFormElement>(null);
  const deleteRef = useRef<HTMLFormElement>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="group relative shrink-0">
      <form ref={uploadRef} action={uploadAction} className="contents">
        <input type="hidden" name="candidateId" value={candidateId} />
        <label
          title={src ? `Foto van ${name} vervangen` : `Profielfoto toevoegen voor ${name}`}
          className={cn(
            "relative block cursor-pointer rounded-full transition-opacity",
            busy && "opacity-50",
          )}
        >
          <input
            type="file"
            name="file"
            accept="image/jpeg,image/png,image/webp"
            className="sr-only"
            disabled={busy}
            onChange={(e) => {
              if (!e.currentTarget.files?.length) return;
              setBusy(true);
              uploadRef.current?.requestSubmit();
            }}
          />
          <Avatar name={name} src={src} size={size} className="ring-2 ring-ink-100" />
          {/* Camera-laagje bij hover — maakt zichtbaar dat de foto klikbaar is. */}
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center rounded-full bg-ink-900/55 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Camera className="h-5 w-5 text-white" />
          </span>
          <span className="sr-only">
            {src ? "Profielfoto vervangen" : "Profielfoto toevoegen"}
          </span>
        </label>
      </form>

      {src && (
        <form ref={deleteRef} action={deleteAction}>
          <input type="hidden" name="id" value={candidateId} />
          <button
            type="submit"
            title="Profielfoto verwijderen"
            onClick={() => setBusy(true)}
            className="absolute -right-1 -top-1 hidden h-6 w-6 items-center justify-center rounded-full bg-ink-900 text-white ring-2 ring-white transition-colors hover:bg-red-600 group-hover:flex"
          >
            <X className="h-3.5 w-3.5" />
            <span className="sr-only">Profielfoto verwijderen</span>
          </button>
        </form>
      )}
    </div>
  );
}
