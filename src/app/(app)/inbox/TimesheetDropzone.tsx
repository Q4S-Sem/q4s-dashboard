"use client";

import { useState } from "react";
import { UploadCloud } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { Dropzone } from "@/components/ui/dropzone";
import { uploadInboxTimesheet } from "./actions";

const ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,.gif,.xlsx,.xls,.csv,.zip,application/pdf,image/*,application/zip,application/x-zip-compressed";

/** Sleep-hier upload voor timesheets — sluit aan op de bestaande server-actie
 *  uploadInboxTimesheet (verborgen file-input name="file"). */
export function TimesheetDropzone() {
  const [count, setCount] = useState(0);

  return (
    <form action={uploadInboxTimesheet} className="space-y-3">
      <Dropzone
        name="file"
        accept={ACCEPT}
        multiple
        hint="PDF, afbeelding, Excel of ZIP · meerdere tegelijk mag"
        onFilesChange={(f) => setCount(f.length)}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          Alles wordt automatisch uitgelezen en per week gesorteerd. Of laat admin@q4s.nl doorsturen
          naar <code>/api/inbox/email</code>.
        </p>
        <SubmitButton disabled={count === 0} pendingLabel="Uploaden…">
          <UploadCloud className="h-4 w-4" /> Upload &amp; uitlezen
        </SubmitButton>
      </div>
    </form>
  );
}
