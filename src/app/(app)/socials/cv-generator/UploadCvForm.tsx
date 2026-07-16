"use client";

import { useActionState } from "react";
import { Sparkles } from "lucide-react";
import { Field } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { emptyFormState, type FormState } from "@/lib/form";

/**
 * Start van de generator: een oud CV erin. De extractie duurt enkele seconden
 * (AI), dus SubmitButton toont zolang zijn pending-label.
 */
export function UploadCvForm({
  action,
  candidateId,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  candidateId?: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);

  return (
    <form action={formAction} className="space-y-4">
      {candidateId && <input type="hidden" name="candidateId" value={candidateId} />}

      {state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>
      )}

      <div className="grid items-end gap-3 sm:grid-cols-12">
        <Field
          label="Oud CV"
          htmlFor="cv-source"
          className="sm:col-span-9"
          hint="PDF, Word (.docx) of een foto/scan. Max. 15 MB."
        >
          <input
            id="cv-source"
            name="file"
            type="file"
            required
            accept=".pdf,.docx,.png,.jpg,.jpeg,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/*"
            aria-label="CV kiezen"
            title="CV kiezen"
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
          />
        </Field>
        <div className="sm:col-span-3">
          <SubmitButton className="w-full" pendingLabel="AI leest CV…">
            <Sparkles className="h-4 w-4" /> Uitlezen
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
