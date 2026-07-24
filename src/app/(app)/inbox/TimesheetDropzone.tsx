"use client";

import { useRef, useState } from "react";
import { UploadCloud, FileText, X } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { uploadInboxTimesheet } from "./actions";

const ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,.gif,.xlsx,.xls,.csv,.zip,application/pdf,image/*,application/zip,application/x-zip-compressed";

// Subtiele schuine streepjes op de grijze box (lichte hatch).
const STRIPES =
  "repeating-linear-gradient(45deg, rgba(148,163,184,0.14) 0, rgba(148,163,184,0.14) 1px, transparent 1px, transparent 9px)";

/** Sleep-hier upload voor timesheets — sluit aan op de bestaande server-actie
 *  uploadInboxTimesheet (verborgen file-input name="file"). Slepen én klikken
 *  vullen dezelfde input, dus de FormData blijft identiek. */
export function TimesheetDropzone() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [dragOver, setDragOver] = useState(false);

  function applyFiles(list: FileList | File[]) {
    const dt = new DataTransfer();
    for (const f of Array.from(list)) dt.items.add(f);
    if (inputRef.current) inputRef.current.files = dt.files;
    setFiles(Array.from(dt.files));
  }

  function clear() {
    if (inputRef.current) inputRef.current.value = "";
    setFiles([]);
  }

  return (
    <form action={uploadInboxTimesheet} className="space-y-3">
      <div
        role="button"
        tabIndex={0}
        aria-label="Sleep bestanden hierheen of klik om te selecteren"
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
            : "border-slate-300 bg-slate-100 hover:border-slate-400 hover:bg-slate-50",
        )}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
          <UploadCloud className="h-5 w-5" />
        </span>
        <p className="text-sm font-medium text-slate-700">
          Sleep je bestanden hierheen of klik om te selecteren
        </p>
        <p className="text-xs text-slate-400">
          PDF, afbeelding, Excel of ZIP · meerdere tegelijk mag
        </p>

        <input
          ref={inputRef}
          name="file"
          type="file"
          multiple
          accept={ACCEPT}
          className="hidden"
          onChange={(e) => setFiles(e.target.files ? Array.from(e.target.files) : [])}
        />
      </div>

      {files.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-slate-500">
            {files.length} bestand{files.length === 1 ? "" : "en"} gekozen:
          </span>
          {files.slice(0, 6).map((f, i) => (
            <span
              key={i}
              className="inline-flex max-w-[16rem] items-center gap-1 truncate rounded-full bg-slate-100 px-2.5 py-1 text-xs text-slate-600"
              title={f.name}
            >
              <FileText className="h-3 w-3 shrink-0 text-slate-400" />
              <span className="truncate">{f.name}</span>
            </span>
          ))}
          {files.length > 6 && (
            <span className="text-xs text-slate-400">+{files.length - 6} meer</span>
          )}
          <button
            type="button"
            onClick={clear}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-slate-400 hover:text-slate-700"
          >
            <X className="h-3 w-3" /> wissen
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Alles wordt automatisch uitgelezen en per week gesorteerd. Of laat admin@q4s.nl doorsturen
          naar <code>/api/inbox/email</code>.
        </p>
        <SubmitButton disabled={files.length === 0} pendingLabel="Uploaden…">
          <UploadCloud className="h-4 w-4" /> Upload &amp; uitlezen
        </SubmitButton>
      </div>
    </form>
  );
}
