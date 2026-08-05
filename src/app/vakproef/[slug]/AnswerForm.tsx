"use client";

import { useActionState } from "react";
import { Send } from "lucide-react";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { DISCIPLINES } from "@/lib/domain";
import { emptyFormState } from "@/lib/form";
import { submitAttempt } from "./actions";

export function AnswerForm({
  slug,
  options,
  defaultDiscipline,
}: {
  slug: string;
  options: string[];
  defaultDiscipline?: string | null;
}) {
  const [state, formAction] = useActionState(submitAttempt, emptyFormState);
  const e = state.fieldErrors ?? {};

  return (
    <form
      action={formAction}
      className="mt-6 space-y-5 rounded-xl border border-ink-200 bg-ink-50 p-6"
    >
      <input type="hidden" name="slug" value={slug} />
      <div className="hidden" aria-hidden="true">
        <label>
          Laat dit veld leeg
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-ink-700">
          Jouw antwoord
        </legend>
        {options.map((o, i) => (
          <label
            key={i}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-ink-200 bg-white px-3 py-2.5 text-sm text-ink-800 hover:border-brand-300"
          >
            <input
              type="radio"
              name="chosenIndex"
              value={i}
              required
              className="h-4 w-4 text-brand-600 focus:ring-brand-500"
            />
            {o}
          </label>
        ))}
        {e.chosenIndex && (
          <p className="text-xs text-red-600">{e.chosenIndex}</p>
        )}
      </fieldset>

      <div className="border-t border-ink-200 pt-4">
        <p className="mb-3 text-sm text-ink-600">
          Laat je gegevens achter om je resultaat te zien — en gelijk in de Q4S
          Talentpool te komen.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Voornaam" htmlFor="firstName" required error={e.firstName}>
            <Input id="firstName" name="firstName" required />
          </Field>
          <Field label="Achternaam" htmlFor="lastName" error={e.lastName}>
            <Input id="lastName" name="lastName" />
          </Field>
          <Field label="E-mail" htmlFor="email" error={e.email}>
            <Input id="email" name="email" type="email" />
          </Field>
          <Field label="Discipline" htmlFor="discipline" error={e.discipline}>
            <Select id="discipline" name="discipline" defaultValue={defaultDiscipline ?? ""}>
              <option value="">Kies je vakgebied (optioneel)</option>
              {DISCIPLINES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <SubmitButton pendingLabel="Versturen…">
        <Send className="h-4 w-4" /> Verstuur antwoord
      </SubmitButton>
    </form>
  );
}
