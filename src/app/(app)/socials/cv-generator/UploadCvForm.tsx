"use client";

import { useActionState, useCallback, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { FileText } from "lucide-react";
import { emptyFormState, type FormState } from "@/lib/form";
import { CvBuildingAnimation } from "@/components/cv/CvBuildingAnimation";

const ACCEPT =
  ".pdf,.docx,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*";

/** Toont de animatie zodra het formulier is verstuurd. */
function BezigMelding() {
  const { pending } = useFormStatus();
  if (!pending) return null;
  return <CvBuildingAnimation className="mt-2" />;
}

export function UploadCvForm({
  action,
  candidateId,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  candidateId?: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  /** Zet het bestand op de hidden input en submit direct het formulier. */
  const handleFile = useCallback((file: File) => {
    setFileName(file.name);
    const dt = new DataTransfer();
    dt.items.add(file);
    if (fileRef.current) {
      fileRef.current.files = dt.files;
    }
    // Auto-submit: requestSubmit() triggert de form action + validatie
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const onFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <form ref={formRef} action={formAction}>
      {candidateId && <input type="hidden" name="candidateId" value={candidateId} />}

      {state.error && (
        <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>
      )}

      <div>
        <label className="mb-1.5 block text-sm font-medium text-ink-700">Oud CV</label>
        <div
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors ${
            dragOver
              ? "border-brand-500 bg-brand-50"
              : "border-ink-200 bg-ink-50/50 hover:border-ink-300 hover:bg-ink-50"
          }`}
        >
          <input
            ref={fileRef}
            id="cv-source"
            name="file"
            type="file"
            required
            accept={ACCEPT}
            onChange={onFileChange}
            className="hidden"
          />
          <FileText className="h-8 w-8 text-ink-300" />
          {fileName ? (
            <p className="text-sm font-medium text-ink-800">{fileName}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-ink-700">
                Sleep een CV hierheen of klik om te selecteren
              </p>
              <p className="text-xs text-ink-400">
                PDF, Word (.docx) of een foto/scan · max 15 MB
              </p>
            </>
          )}
        </div>
        <p className="mt-1.5 text-xs text-ink-400">
          🔒 CV&apos;s worden standaard geanonimiseerd: achternaam wordt een initiaal en Q4S staat als enige contact op het CV.
        </p>
        <p className="mt-1 text-xs text-ink-400">
          👁 CV&apos;s worden standaard geanonimiseerd: achternaam wordt een initiaal en Q4S staat als enige contact op het CV. Per CV uit te zetten in het volgende scherm.
        </p>
      </div>

      <BezigMelding />
    </form>
  );
}
