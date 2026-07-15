"use client";

import { useActionState } from "react";
import { CheckCircle2, Send } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { DISCIPLINES } from "@/lib/domain";
import { emptyFormState } from "@/lib/form";
import { captureTalentLead } from "./actions";

export function TalentForm({
  ok,
  bron,
  cvSkipped,
}: {
  ok?: boolean;
  bron?: string;
  cvSkipped?: boolean;
}) {
  const [state, formAction] = useActionState(captureTalentLead, emptyFormState);
  const e = state.fieldErrors ?? {};

  if (ok) {
    return (
      <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-6">
        <div className="flex items-start gap-3">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          <div>
            <h2 className="text-base font-semibold text-green-900">
              Welkom in de Q4S Talentpool!
            </h2>
            <p className="mt-1 text-sm text-green-800">
              Je staat genoteerd. Zodra er een opdracht voorbijkomt die bij jouw
              vak past, nemen we als eerste contact met je op.
            </p>
            {cvSkipped && (
              <p className="mt-2 text-sm text-amber-700">
                Let op: je CV was te groot (max 15 MB) en is niet meegestuurd.
                Mail je CV gerust naar info@q4s.nl.
              </p>
            )}
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
      {/* Honeypot — hidden from real users; bots fill it and get silently dropped. */}
      <div className="hidden" aria-hidden="true">
        <label>
          Laat dit veld leeg
          <input type="text" name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>
      {bron && <input type="hidden" name="bron" value={bron} />}

      <div>
        <h2 className="text-base font-semibold text-slate-900">
          Meld je aan voor de Talentpool
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Eén keer je gegevens achterlaten — wij matchen je daarna aan álle
          passende opdrachten.
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

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Discipline" htmlFor="discipline" error={e.discipline}>
          <Select id="discipline" name="discipline" defaultValue="">
            <option value="">Kies je vakgebied (optioneel)</option>
            {DISCIPLINES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Regio" htmlFor="location" hint="Waar werk je het liefst?" error={e.location}>
          <Input id="location" name="location" placeholder="Bijv. Rotterdam / Noordzee" />
        </Field>
      </div>

      <Field
        label="Jouw vak / functie"
        htmlFor="headline"
        hint="Bijv. NDT Inspecteur Level 2 (UT/RT) of 6G-lasser TIG/MIG."
        error={e.headline}
      >
        <Input id="headline" name="headline" placeholder="Jouw functie of specialisme" />
      </Field>

      <Field
        label="Kort over jezelf"
        htmlFor="motivation"
        hint="Optioneel — certificaten, ervaring of beschikbaarheid."
        error={e.motivation}
      >
        <Textarea id="motivation" name="motivation" rows={4} />
      </Field>

      <Field label="CV" htmlFor="cv" hint="Optioneel — PDF of Word, max 15 MB." error={e.cv}>
        <input
          id="cv"
          name="cv"
          type="file"
          aria-label="CV kiezen"
          title="CV kiezen"
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-slate-800"
        />
      </Field>

      <SubmitButton pendingLabel="Aanmelden…">
        <Send className="h-4 w-4" /> Word lid van de Talentpool
      </SubmitButton>
    </form>
  );
}
