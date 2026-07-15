"use client";

import * as React from "react";
import { UploadCloud, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} kB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Gestylede bestand-kiezer: klik of sleep een bestand hierheen. Vervangt de kale
 * native `<input type=file>` maar houdt exact één echte file-input met `name`,
 * zodat het form ongewijzigd (Server Action / FormData) blijft werken. De
 * geselecteerde bestandsnaam + grootte worden getoond met een wis-knop.
 */
export function FileInput({
  id,
  name,
  required,
  accept,
  hint = "PDF, Word, Excel of afbeelding",
  className,
}: {
  id?: string;
  name: string;
  required?: boolean;
  accept?: string;
  hint?: string;
  className?: string;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [file, setFile] = React.useState<{ name: string; size: number } | null>(null);
  const [drag, setDrag] = React.useState(false);

  function read(files: FileList | null) {
    const f = files && files[0];
    setFile(f ? { name: f.name, size: f.size } : null);
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDrag(false);
    const dropped = e.dataTransfer.files;
    if (dropped && dropped.length && ref.current) {
      ref.current.files = dropped; // laat het echte input-veld het bestand dragen
      read(dropped);
    }
  }

  function clear(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (ref.current) ref.current.value = "";
    setFile(null);
  }

  function open() {
    ref.current?.click();
  }

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label="Bestand kiezen"
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      }}
      onDragOver={(e) => {
        e.preventDefault();
        if (!drag) setDrag(true);
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
      className={cn(
        "relative flex cursor-pointer items-center gap-3 rounded-xl border border-dashed px-3.5 py-3 text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40",
        drag
          ? "border-brand-500 bg-brand-50"
          : "border-slate-300 bg-white hover:border-brand-400 hover:bg-brand-50/40",
        className,
      )}
    >
      <input
        ref={ref}
        id={id}
        name={name}
        type="file"
        required={required}
        accept={accept}
        onChange={(e) => read(e.target.files)}
        className="sr-only"
      />
      {file ? (
        <>
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <FileText className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-slate-800">{file.name}</span>
            <span className="text-xs text-slate-400">
              {formatSize(file.size)} · klik om te wijzigen
            </span>
          </span>
          <button
            type="button"
            onClick={clear}
            aria-label="Bestand verwijderen"
            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </>
      ) : (
        <>
          <span
            className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
              drag ? "bg-brand-100 text-brand-600" : "bg-slate-100 text-slate-500",
            )}
          >
            <UploadCloud className="h-5 w-5" />
          </span>
          <span className="min-w-0">
            <span className="block font-medium text-slate-700">
              Kies een bestand <span className="font-normal text-slate-400">of sleep het hierheen</span>
            </span>
            <span className="text-xs text-slate-400">{hint}</span>
          </span>
        </>
      )}
    </div>
  );
}
