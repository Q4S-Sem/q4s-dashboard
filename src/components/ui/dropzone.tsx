"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, X } from "lucide-react";
import { cn } from "@/lib/utils";

// Subtiele schuine streepjes op de grijze box (lichte hatch).
const STRIPES =
  "repeating-linear-gradient(45deg, rgba(148,163,184,0.14) 0, rgba(148,163,184,0.14) 1px, transparent 1px, transparent 9px)";

/**
 * Herbruikbare sleep-hier upload: de grijze gestreepte box + gekozen-bestanden.
 * Slepen én klikken vullen dezelfde verborgen file-input (name), dus de FormData
 * blijft identiek — wrap 'm gewoon in je eigen <form action={...}> met een eigen
 * submit-knop. onFilesChange laat de ouder bijv. de knop dis/enablen.
 */
export function Dropzone({
  name = "file",
  accept,
  multiple = false,
  label = "Sleep je bestanden hierheen of klik om te selecteren",
  hint,
  className,
  onFilesChange,
}: {
  name?: string;
  accept?: string;
  multiple?: boolean;
  label?: string;
  hint?: string;
  className?: string;
  onFilesChange?: (files: File[]) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);

  function update(list: File[]) {
    setFiles(list);
    onFilesChange?.(list);
  }

  function applyFiles(list: FileList | File[]) {
    const dt = new DataTransfer();
    const arr = Array.from(list);
    const picked = multiple ? arr : arr.slice(0, 1);
    for (const f of picked) dt.items.add(f);
    if (inputRef.current) inputRef.current.files = dt.files;
    update(Array.from(dt.files));
  }

  /**
   * Sleep-bron uitpakken. Naast echte bestanden (OS/verkenner/tweede scherm en de
   * meeste mailbijlagen) ook een gesleepte AFBEELDING/LINK uit een webpagina of
   * webmail-preview: die komt binnen als een URL (uri-list/text), die we ophalen
   * en tot een File maken. Zo lukt "direct vanuit de mail erin slepen" ook.
   */
  async function handleDataTransfer(dtIn: DataTransfer) {
    if (dtIn.files && dtIn.files.length) {
      applyFiles(dtIn.files);
      return;
    }
    const uri =
      dtIn.getData("text/uri-list") ||
      dtIn.getData("text/plain") ||
      "";
    const url = uri.split(/\s+/).find((l) => /^https?:\/\//i.test(l))?.trim();
    if (!url) return;
    try {
      const res = await fetch(url);
      if (!res.ok) return;
      const blob = await res.blob();
      const name =
        decodeURIComponent(new URL(url).pathname.split("/").pop() || "") || "bijlage";
      const file = new File([blob], name, { type: blob.type || "application/octet-stream" });
      applyFiles([file]);
    } catch {
      // Cross-origin/afgeschermde bron: stil negeren, gebruiker kan nog klikken/kiezen.
    }
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    update([]);
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div
        role="button"
        tabIndex={0}
        aria-label={label}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            inputRef.current?.click();
          }
        }}
        onPaste={(e) => {
          if (e.clipboardData?.files.length || e.clipboardData?.getData("text")) {
            e.preventDefault();
            void handleDataTransfer(e.clipboardData);
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          void handleDataTransfer(e.dataTransfer);
        }}
        style={dragOver ? undefined : { backgroundImage: STRIPES }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors focus:outline-none focus:ring-2 focus:ring-brand-400",
          dragOver
            ? "border-brand-400 bg-brand-50"
            : "border-ink-300 bg-ink-100 hover:border-ink-400 hover:bg-ink-50",
        )}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-ink-500 shadow-sm">
          <UploadCloud className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-ink-700">{label}</p>
        {hint && <p className="text-xs text-ink-400">{hint}</p>}

        <input
          ref={inputRef}
          name={name}
          type="file"
          multiple={multiple}
          accept={accept}
          className="hidden"
          onChange={(e) => update(e.target.files ? Array.from(e.target.files) : [])}
        />
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-ink-500">
            {files.length} bestand{files.length === 1 ? "" : "en"} gekozen:
          </span>
          {files.slice(0, 6).map((f, i) => (
            <span
              key={i}
              className="inline-flex max-w-[16rem] items-center gap-1 truncate rounded-sm bg-ink-100 px-2.5 py-1 text-xs text-ink-600"
              title={f.name}
            >
              <FileText className="h-3 w-3 shrink-0 text-ink-400" />
              <span className="truncate">{f.name}</span>
            </span>
          ))}
          {files.length > 6 && (
            <span className="text-xs text-ink-400">+{files.length - 6} meer</span>
          )}
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs text-ink-400 hover:text-ink-700"
          >
            <X className="h-3 w-3" /> wissen
          </button>
        </div>
      )}
    </div>
  );
}
