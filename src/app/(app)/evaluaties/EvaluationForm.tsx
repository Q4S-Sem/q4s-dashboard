"use client";

import { useActionState, useRef, useState } from "react";
import Link from "next/link";
import { UserRound, Building2, ClipboardList, Sparkles, Eraser, Check } from "lucide-react";
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
    <div className="flex items-center gap-2.5 border-b border-ink-100 pb-3">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
        {icon}
      </span>
      <h2 className="text-sm font-semibold text-ink-800">{children}</h2>
    </div>
  );
}

function ScoreRow({
  name,
  label,
  value,
  onPick,
}: {
  name: string;
  label: string;
  value: number | null;
  onPick: (v: number) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 px-3 py-3 transition-colors hover:bg-ink-50/60 sm:grid-cols-[1fr_auto] sm:items-center sm:gap-4">
      <span className="text-sm font-medium text-ink-700">{label}</span>
      <div className="grid grid-cols-4 gap-1.5 sm:flex sm:gap-1.5">
        {EVAL_SCORES.map((s) => (
          <label key={s.value} className="cursor-pointer">
            <input
              type="radio"
              name={name}
              value={s.value}
              checked={String(value ?? "") === s.value}
              onChange={() => onPick(Number(s.value))}
              className="peer sr-only"
            />
            <span
              className={cn(
                "block rounded-lg border border-ink-200 px-2 py-2 text-center text-xs font-medium text-ink-500 transition-colors hover:bg-white sm:w-[72px] sm:px-3 sm:py-1.5",
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
                "block rounded-lg border border-ink-200 px-8 py-2 text-center text-sm font-medium text-ink-500 transition-colors hover:bg-ink-50",
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

/** Wat we automatisch kunnen overnemen uit de lopende plaatsing van een persoon. */
export type EvalPrefill = Partial<Record<HeaderKey, string>>;

export function EvaluationForm({
  action,
  consultants,
  suggestions,
  prefills,
  evaluation,
  defaults,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  consultants: { id: string; name: string }[];
  suggestions: Record<string, string[]>;
  /** Per medewerker de gegevens van hun actieve plaatsing (klant, functie, locatie). */
  prefills?: Record<string, EvalPrefill>;
  evaluation?: EvaluationFormData;
  defaults: { year: number; quarter: number; type?: string };
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = evaluation;
  const fe = state.fieldErrors ?? {};
  const [type, setType] = useState(e?.type ?? defaults.type ?? "VCU");
  const def = getFormDef(type);
  const answers = e?.answers ?? {};
  const formRef = useRef<HTMLFormElement>(null);

  // Scores in state, zodat de voortgang en het gemiddelde live meelopen.
  const [scoreMap, setScoreMap] = useState<Record<string, number>>(e?.scores ?? {});
  const setScore = (key: string, v: number) => setScoreMap((m) => ({ ...m, [key]: v }));

  // Automatisch overgenomen kopgegevens (alleen als die velden nog leeg zijn).
  const [prefill, setPrefill] = useState<EvalPrefill | null>(null);
  const [prefillFrom, setPrefillFrom] = useState<string>("");
  const headerVal = (k: HeaderKey) => (e ? e[k] : (prefill?.[k] ?? ""));

  /** Neem klant/functie/locatie over uit de actieve plaatsing van deze persoon. */
  function applyPrefill(personId: string | null) {
    if (e || !personId) return; // bij bewerken nooit overschrijven
    const p = prefills?.[personId];
    if (!p) return;
    // Alleen invullen als de gebruiker nog niets in die velden heeft gezet.
    const form = formRef.current;
    if (form) {
      const filled = (Object.keys(p) as HeaderKey[]).some((k) => {
        const el = form.elements.namedItem(k);
        return el instanceof HTMLInputElement && el.value.trim() !== "";
      });
      if (filled) return;
    }
    setPrefill(p);
    setPrefillFrom(personId);
  }

  const allCriteria = def.scoreSections.flatMap((s) => s.criteria.map((c) => c.key));
  const doneCount = allCriteria.filter((k) => scoreMap[k] >= 1).length;
  const avg =
    doneCount > 0
      ? Math.round(
          (allCriteria.reduce((sum, k) => sum + (scoreMap[k] ?? 0), 0) / doneCount) * 10,
        ) / 10
      : null;
  const complete = doneCount === allCriteria.length && allCriteria.length > 0;

  return (
    <form ref={formRef} action={formAction} className="space-y-8">
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
              onSelect={(p) => applyPrefill(p?.id ?? null)}
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
          {prefill && (
            <p className="flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
              <Sparkles className="h-3.5 w-3.5 shrink-0" />
              Klant, functie en werklocatie zijn overgenomen uit de lopende plaatsing — pas ze
              gerust aan.
            </p>
          )}
          {/* key: bij een nieuwe medewerker opnieuw opbouwen met de overgenomen waarden */}
          <div key={prefillFrom} className="grid gap-4 sm:grid-cols-2">
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
        {def.scoreSections.map((sec) => {
          const keys = sec.criteria.map((c) => c.key);
          const done = keys.filter((k) => scoreMap[k] >= 1).length;
          return (
            <section key={sec.title} className="space-y-3">
              <SectionTitle icon={<ClipboardList className="h-4 w-4" />}>{sec.title}</SectionTitle>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 font-medium",
                      done === keys.length
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-ink-100 text-ink-500",
                    )}
                  >
                    {done} / {keys.length} beoordeeld
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setScoreMap((m) => {
                        const next = { ...m };
                        for (const k of keys) next[k] = 4;
                        return next;
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-full border border-ink-200 px-2 py-0.5 font-medium text-ink-500 transition-colors hover:border-emerald-300 hover:text-emerald-700"
                  >
                    <Check className="h-3 w-3" /> Alles goed
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setScoreMap((m) => {
                        const next = { ...m };
                        for (const k of keys) delete next[k];
                        return next;
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-full border border-ink-200 px-2 py-0.5 font-medium text-ink-500 transition-colors hover:border-ink-400 hover:text-ink-700"
                  >
                    <Eraser className="h-3 w-3" /> Wissen
                  </button>
                </div>
                <div className="flex items-center gap-2 text-[11px] font-medium text-ink-400">
                  <span>Slecht</span>
                  <span className="h-2 w-20 rounded-full bg-gradient-to-r from-red-500 via-orange-400 via-lime-400 to-emerald-500" />
                  <span>Goed</span>
                </div>
              </div>
              <div className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200">
                {sec.criteria.map((c) => (
                  <ScoreRow
                    key={c.key}
                    name={`s_${c.key}`}
                    label={c.label}
                    value={typeof scoreMap[c.key] === "number" ? scoreMap[c.key] : null}
                    onPick={(v) => setScore(c.key, v)}
                  />
                ))}
              </div>
              <Field label="Toelichting">
                <Textarea name={`a_${sec.noteKey}`} rows={2} defaultValue={answers[sec.noteKey] ?? ""} />
              </Field>
            </section>
          );
        })}

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

      {/* Vaste balk onderaan: voortgang + opslaan altijd in beeld */}
      <div className="sticky bottom-0 -mx-5 flex flex-col-reverse gap-3 border-t border-ink-200 bg-white/95 px-5 py-3 backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 text-sm">
          <span
            className={cn(
              "rounded-full px-2.5 py-1 text-xs font-medium",
              complete ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
            )}
          >
            {doneCount} van {allCriteria.length} beoordeeld
          </span>
          {avg !== null && (
            <span className="text-xs text-ink-500">
              gemiddeld{" "}
              <span className="font-semibold text-ink-900">
                {avg.toFixed(1).replace(".", ",")}
              </span>{" "}
              / 4
            </span>
          )}
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row">
          <Link
            href={cancelHref}
            className={buttonVariants({ variant: "outline", className: "w-full sm:w-auto" })}
          >
            Annuleren
          </Link>
          <SubmitButton className="w-full sm:w-auto">Evaluatie opslaan</SubmitButton>
        </div>
      </div>
    </form>
  );
}
