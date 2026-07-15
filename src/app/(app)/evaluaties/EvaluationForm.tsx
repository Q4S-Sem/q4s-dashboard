"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { UserRound, Building2, ClipboardList } from "lucide-react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { PersonCombobox } from "@/components/ui/person-combobox";
import { TextAutocomplete } from "@/components/ui/text-autocomplete";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { emptyFormState, type FormState } from "@/lib/form";
import { SCORE_CHECKED } from "@/lib/evaluaties";
import { EVALUATION_STATUSES, EVAL_SCORES, QUARTERS } from "@/lib/domain";
import { EVAL_FORM_LIST, getFormDef, type HeaderKey } from "@/lib/evaluation-forms";

export type EvaluationFormData = {
  id?: string;
  consultantId: string;
  type: string;
  status: string;
  year: number;
  quarter: number;
  evaluationDate: string; // yyyy-mm-dd | ""
  clientName: string;
  clientAddress: string;
  department: string;
  reference: string;
  functionTitle: string;
  workLocation: string;
  periodText: string;
  evaluatorName: string;
  scores: Record<string, number>;
  answers: Record<string, string>;
};

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 border-b border-slate-100 pb-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        {icon}
      </span>
      <h2 className="text-sm font-semibold text-slate-800">{children}</h2>
    </div>
  );
}

function ScoreRow({ name, label, value }: { name: string; label: string; value: number | null }) {
  return (
    <div className="grid grid-cols-1 gap-2 px-3 py-3 transition-colors hover:bg-slate-50/60 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <div className="grid grid-cols-4 gap-1.5 sm:flex sm:gap-1.5">
        {EVAL_SCORES.map((s) => (
          <label key={s.value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={s.value}
              defaultChecked={String(value ?? "") === s.value}
              className="peer sr-only"
            />
            <span
              className={cn(
                "block rounded-lg border border-slate-200 px-2 py-2 text-center text-xs font-medium text-slate-500 transition-colors hover:bg-white sm:w-[72px] sm:px-3 sm:py-1.5",
                SCORE_CHECKED[s.value],
              )}
            >
              {s.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  );
}

function BoolRow({ name, label, value }: { name: string; label: string; value: string }) {
  return (
    <Field label={label}>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        {[
          {
            v: "ja",
            label: "Ja",
            on: "peer-checked:border-emerald-600 peer-checked:bg-emerald-600 peer-checked:text-white",
          },
          {
            v: "nee",
            label: "Nee",
            on: "peer-checked:border-red-500 peer-checked:bg-red-500 peer-checked:text-white",
          },
        ].map((o) => (
          <label key={o.v} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={o.v}
              defaultChecked={value === o.v}
              className="peer sr-only"
            />
            <span
              className={cn(
                "block rounded-lg border border-slate-200 px-8 py-2 text-center text-sm font-medium text-slate-500 transition-colors hover:bg-slate-50",
                o.on,
              )}
            >
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </Field>
  );
}

export function EvaluationForm({
  action,
  consultants,
  suggestions,
  evaluation,
  defaults,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  consultants: { id: string; name: string }[];
  suggestions: Record<string, string[]>;
  evaluation?: EvaluationFormData;
  defaults: { year: number; quarter: number; type?: string };
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = evaluation;
  const fe = state.fieldErrors ?? {};
  const [type, setType] = useState(e?.type ?? defaults.type ?? "VCU");
  const def = getFormDef(type);
  const scores = e?.scores ?? {};
  const answers = e?.answers ?? {};
  const headerVal = (k: HeaderKey) => (e ? e[k] : "");

  return (
    <form action={formAction} className="space-y-8">
      {e?.id && <input type="hidden" name="id" value={e.id} />}
      {state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>
      )}

      {/* Medewerker, type (template), periode */}
      <section className="space-y-4">
        <SectionTitle icon={<UserRound className="h-4 w-4" />}>
          Medewerker & formulier
        </SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Medewerker"
            required
            error={fe.consultantId}
            hint="Typ een naam — bestaat die nog niet, kies dan ‘toevoegen als nieuwe persoon’."
          >
            <PersonCombobox
              name="consultantId"
              createName="newConsultantName"
              people={consultants}
              defaultId={e?.consultantId}
              defaultName={
                e ? consultants.find((c) => c.id === e.consultantId)?.name ?? "" : ""
              }
              required
              placeholder="Typ of kies een medewerker…"
            />
          </Field>
          <Field label="Soort formulier" required>
            <Select name="type" defaultValue={type} onValueChange={setType}>
              {EVAL_FORM_LIST.map((f) => (
                <option key={f.type} value={f.type}>
                  {f.shortLabel}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Status">
            <Select name="status" defaultValue={e?.status ?? "CONCEPT"}>
              {EVALUATION_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Jaar">
            <Input type="number" name="year" min={2000} max={2100} defaultValue={e?.year ?? defaults.year} />
          </Field>
          <Field label="Kwartaal">
            <Select name="quarter" defaultValue={String(e?.quarter ?? defaults.quarter)}>
              {QUARTERS.map((q) => (
                <option key={q.value} value={q.value}>
                  {q.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Datum">
            <Input type="date" name="evaluationDate" defaultValue={e?.evaluationDate} />
          </Field>
        </div>
      </section>

      {/* Everything below depends on the chosen template — re-mount on switch. */}
      <div key={type} className="space-y-8">
        {/* Inlener / uitzending header */}
        <section className="space-y-4">
          <SectionTitle icon={<Building2 className="h-4 w-4" />}>
            {def.subtitle}
          </SectionTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            {def.headerFields.map((h) => (
              <Field key={h.key} label={h.label}>
                <TextAutocomplete
                  name={h.key}
                  defaultValue={headerVal(h.key)}
                  suggestions={suggestions[h.key] ?? []}
                />
              </Field>
            ))}
          </div>
        </section>

        {/* Score sections */}
        {def.scoreSections.map((sec) => (
          <section key={sec.title} className="space-y-3">
            <SectionTitle icon={<ClipboardList className="h-4 w-4" />}>{sec.title}</SectionTitle>
            <div className="flex items-center justify-end gap-2 text-[11px] font-medium text-slate-400">
              <span>Slecht</span>
              <span className="h-2 w-20 rounded-full bg-gradient-to-r from-red-500 via-orange-400 via-lime-400 to-emerald-500" />
              <span>Goed</span>
            </div>
            <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200">
              {sec.criteria.map((c) => (
                <ScoreRow
                  key={c.key}
                  name={`s_${c.key}`}
                  label={c.label}
                  value={typeof scores[c.key] === "number" ? scores[c.key] : null}
                />
              ))}
            </div>
            <Field label="Toelichting">
              <Textarea name={`a_${sec.noteKey}`} rows={2} defaultValue={answers[sec.noteKey] ?? ""} />
            </Field>
          </section>
        ))}

        {/* Closing block: free text + yes/no */}
        {(def.textFields.length > 0 || def.boolQuestions.length > 0) && (
          <section className="space-y-4">
            <SectionTitle icon={<ClipboardList className="h-4 w-4" />}>
              {def.closingTitle ?? "Afronding"}
            </SectionTitle>
            {def.textFields.map((t) => (
              <Field key={t.key} label={t.label}>
                <Textarea name={`a_${t.key}`} rows={2} defaultValue={answers[t.key] ?? ""} />
              </Field>
            ))}
            {def.boolQuestions.map((b) => (
              <BoolRow key={b.key} name={`a_${b.key}`} label={b.label} value={answers[b.key] ?? ""} />
            ))}
            <Field label="Toelichting">
              <Textarea
                name={`a_${def.closingNoteKey}`}
                rows={2}
                defaultValue={answers[def.closingNoteKey] ?? ""}
              />
            </Field>
          </section>
        )}

        {/* Ondertekening */}
        <Field label={`${def.evaluatorLabel} (ingevuld door)`} className="sm:max-w-md">
          <Input name="evaluatorName" defaultValue={e?.evaluatorName} />
        </Field>
      </div>

      <div className="flex flex-col-reverse gap-2 border-t border-slate-100 pt-5 sm:flex-row sm:justify-end">
        <Link
          href={cancelHref}
          className={buttonVariants({ variant: "outline", className: "w-full sm:w-auto" })}
        >
          Annuleren
        </Link>
        <SubmitButton className="w-full sm:w-auto">Evaluatie opslaan</SubmitButton>
      </div>
    </form>
  );
}
