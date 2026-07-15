"use client";

import { useActionState } from "react";
import { Plus } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { emptyFormState, type FormState } from "@/lib/form";
import { BADGE_COLORS } from "@/lib/domain";

/** Voeg een nieuwe pipeline-fase toe (komt vóór de win/verlies-kolommen). */
export function AddStageForm({
  action,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <Field label="Nieuwe fase" htmlFor="name" error={e.name} className="min-w-48 flex-1">
        <Input id="name" name="name" placeholder="Bijv. Onderhandeling" required />
      </Field>
      <Field label="Kleur" htmlFor="color" className="w-36">
        <Select id="color" name="color" defaultValue="slate">
          {BADGE_COLORS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Kans %" htmlFor="probability" className="w-24" error={e.probability}>
        <Input id="probability" name="probability" type="number" min={0} max={100} defaultValue={0} />
      </Field>
      <div className="mb-0">
        <SubmitButton>
          <Plus className="h-4 w-4" /> Toevoegen
        </SubmitButton>
      </div>
    </form>
  );
}
