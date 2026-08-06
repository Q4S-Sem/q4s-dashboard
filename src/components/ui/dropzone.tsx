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
    for (const f of Array.from(list)) dt.items.add(f);
    if (inputRef.current) inputRef.current.files = dt.files;
    update(Array.from(dt.files));
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
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (e.dataTransfer.files.length) applyFiles(e.dataTransfer.files);
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
