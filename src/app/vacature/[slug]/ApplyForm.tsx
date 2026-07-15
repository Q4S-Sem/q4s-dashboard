"use client";

import { useActionState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { DISCIPLINES } from "@/lib/domain";
import { emptyFormState } from "@/lib/form";
import { applyToVacancy } from "./actions";

export function ApplyForm({
  vacancyId,
  slug,
  ok,
}: {
  vacancyId: string;
  slug: string;
  ok?: boolean;
}) {
  const [state, formAction] = useActionState(applyToVacancy, emptyFormState);
  const e = state.fieldErrors ?? {};

  // A successful submit redirects with ?ok=1; show the confirmation instead of
  // the form in that case.
  if (ok) {
    return (
      <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          <div>
            <h2 className="text-base font-semibold text-green-900">
              Bedankt voor je sollicitatie!
            </h2>
            <p className="mt-1 text-sm text-green-800">
              We hebben je gegevens ontvangen en nemen zo snel mogelijk contact
              met je op.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="mt-8 space-y-5 rounded-xl border border-slate-200 bg-slate-50 p-6"
    >
      <input type="hidden" name="vacancyId" value={vacancyId} />
      <input type="hidden" name="slug" value={slug} />

      <div>
        <h2 className="text-base font-semibold text-slate-900">
          Solliciteer op deze functie
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Laat je gegevens achter, dan nemen we snel contact met je op.
        </p>
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Voornaam" htmlFor="firstName" required error={e.firstName}>
          <Input id="firstName" name="firstName" required />
        </Field>
        <Field label="Achternaam" htmlFor="lastName" required error={e.lastName}>
          <Input id="lastName" name="lastName" required />
        </Field>
        <Field label="E-mail" htmlFor="email" error={e.email}>
          <Input id="email" name="email" type="email" />
        </Field>
        <Field label="Telefoon" htmlFor="phone" error={e.phone}>
          <Input id="phone" name="phone" />
        </Field>
      </div>

      <Field label="Discipline" htmlFor="discipline" error={e.discipline}>
        <Select id="discipline" name="discipline" defaultValue="">
          <option value="">Kies een discipline (optioneel)</option>
          {DISCIPLINES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field
        label="Motivatie"
        htmlFor="motivation"
        hint="Vertel kort waarom deze functie bij je past."
        error={e.motivation}
      >
        <Textarea id="motivation" name="motivation" rows={5} />
      </Field>

      <Field
        label="CV"
        htmlFor="cv"
        hint="Optioneel — PDF of Word."
        error={e.cv}
      >
        <input
          id="cv"
          name="cv"
          type="file"
          aria-label="CV kiezen"
          title="CV kiezen"
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
        />
      </Field>

      <SubmitButton pendingLabel="Versturen…">
        <Send className="h-4 w-4" /> Verstuur sollicitatie
      </SubmitButton>
    </form>
  );
}
