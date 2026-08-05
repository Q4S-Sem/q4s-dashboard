"use client";

import { Upload } from "lucide-react";

/** A styled "upload" button: picks a file and immediately submits its form. */
export function CertFileButton({
  certId,
  action,
  label = "Bestand",
}: {
  certId: string;
  action: (formData: FormData) => Promise<void>;
  label?: string;
}) {
  return (
    <form action={action}>
      <input type="hidden" name="id" value={certId} />
      <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-ink-300 bg-white px-3 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-50">
        <Upload className="h-4 w-4" /> {label}
        <input
          type="file"
          name="file"
          accept=".pdf,image/*"
          className="hidden"
          onChange={(e) => e.currentTarget.form?.requestSubmit()}
        />
      </label>
    </form>
  );
}
