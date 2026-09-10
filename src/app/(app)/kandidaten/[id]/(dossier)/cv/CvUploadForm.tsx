"use client";

import { useState } from "react";
import { Upload } from "lucide-react";
import { Dropzone } from "@/components/ui/dropzone";
import { SubmitButton } from "@/components/ui/submit-button";

/**
 * CV-upload op het kandidaatdossier in dezelfde sleep-hierheen-stijl als de rest
 * van de app (de gedeelde Dropzone). Slepen of klikken vult dezelfde verborgen
 * file-input; de bestaande `uploadCv` server-actie blijft ongewijzigd. De
 * upload-knop is pas actief zodra er een bestand gekozen is.
 */
export function CvUploadForm({
  action,
  candidateId,
}: {
  action: (formData: FormData) => void | Promise<void>;
  candidateId: string;
}) {
  const [hasFile, setHasFile] = useState(false);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="candidateId" value={candidateId} />
      <Dropzone
        name="file"
        accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,application/pdf"
        label="Sleep een CV hierheen of klik om te selecteren"
        hint="PDF, Word (.docx) of een duidelijke foto/scan — de werkervaring wordt automatisch uitgelezen"
        onFilesChange={(files) => setHasFile(files.length > 0)}
      />
      <div className="flex justify-end">
        <SubmitButton disabled={!hasFile} pendingLabel="Uploaden…">
          <Upload className="h-4 w-4" /> Upload CV
        </SubmitButton>
      </div>
    </form>
  );
}
