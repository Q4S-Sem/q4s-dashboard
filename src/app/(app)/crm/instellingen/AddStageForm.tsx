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
    <form
      action={formAction}
      className="grid grid-cols-[1.25rem_minmax(0,1fr)_9rem_7rem_auto] items-end gap-2 border border-transparent px-2"
    >
      <span aria-hidden />
      <Field label="Nieuwe fase" htmlFor="name" error={e.name}>
        <Input id="name" name="name" placeholder="Bijv. Onderhandeling" required />
      </Field>
      <Field label="Kleur" htmlFor="color">
        <Select id="color" name="color" defaultValue="slate">
          {BADGE_COLORS.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Kans %" htmlFor="probability" error={e.probability}>
        <Input id="probability" name="probability" type="number" min={0} max={100} defaultValue={0} />
      </Field>
      <div>
        <SubmitButton>
          <Plus className="h-4 w-4" /> Toevoegen
        </SubmitButton>
      </div>
    </form>
  );
}
