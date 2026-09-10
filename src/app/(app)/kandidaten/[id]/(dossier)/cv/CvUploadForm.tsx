"use client";

import { useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dropzone } from "@/components/ui/dropzone";

/**
 * CV-upload op het kandidaatdossier in dezelfde sleep-hierheen-stijl als de rest
 * van de app (de gedeelde Dropzone). Zodra je een bestand sleept of kiest, wordt
 * het METEEN geüpload — geen aparte knop meer. De bestaande `uploadCv`
 * server-actie blijft ongewijzigd; we versturen het formulier zelf.
 */
export function CvUploadForm({
  action,
  candidateId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  candidateId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [uploading, setUploading] = useState(false);

  return (
    <form ref={formRef} action={action} className="space-y-3">
      <input type="hidden" name="candidateId" value={candidateId} />
      <Dropzone
        name="file"
        accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,application/pdf"
        label="Sleep een CV hierheen of klik om te selecteren"
        hint="PDF, Word (.docx) of een duidelijke foto/scan — de werkervaring wordt automatisch uitgelezen"
        onFilesChange={(files) => {
          // Meteen uploaden zodra er een bestand binnenkomt (geen knop nodig).
          if (files.length > 0 && !uploading) {
            setUploading(true);
            formRef.current?.requestSubmit();
          }
        }}
      />
      {uploading && (
        <p className="flex items-center gap-2 text-sm font-medium text-ink-600">
          <Loader2 className="h-4 w-4 animate-spin" /> CV wordt geüpload en uitgelezen…
        </p>
      )}
    </form>
  );
}
