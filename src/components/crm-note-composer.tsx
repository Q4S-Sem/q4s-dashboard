"use client";

import { useActionState } from "react";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { emptyFormState, type FormState } from "@/lib/form";
import { CRM_NOTE_MANUAL_TYPES, CRM_SENTIMENTS } from "@/lib/domain";

/**
 * De notitieblok-invoer (chat): leg vast wat je deed of besprak. Alles wordt
 * bewaard en voedt de inzichten. Optioneel: relatiegevoel + een opvolgdatum.
 * Generiek — werkt voor deals én contacten via de doorgegeven server-actie.
 * Reset zichzelf na opslaan door van de ouder een key mee te geven (aantal notities).
 */
export function CrmNoteComposer({
  action,
  parentIdName,
  parentId,
  placeholder = "Wat is er gebeurd of besproken?",
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  parentIdName: string;
  parentId: string;
  placeholder?: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name={parentIdName} value={parentId} />

      <Field htmlFor="body" error={e.body}>
        <Textarea id="body" name="body" rows={3} placeholder={placeholder} required />
      </Field>

      <div className="flex flex-wrap items-end gap-3">
        <Field label="Type" htmlFor="type" className="w-40">
          <Select id="type" name="type" defaultValue="NOTE">
            {CRM_NOTE_MANUAL_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Gevoel" htmlFor="sentiment" className="w-36">
          <Select id="sentiment" name="sentiment" defaultValue="">
            <option value="">—</option>
            {CRM_SENTIMENTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Opvolgen op" htmlFor="followUpAt" className="w-44">
          <Input id="followUpAt" name="followUpAt" type="date" />
        </Field>
        <label className="mb-2 inline-flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" name="pinned" className="h-4 w-4 rounded border-slate-300" />
          Vastpinnen
        </label>
        <div className="mb-0 ml-auto">
          <SubmitButton>Vastleggen</SubmitButton>
        </div>
      </div>
    </form>
  );
}
