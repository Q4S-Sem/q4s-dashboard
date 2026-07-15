"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Challenge } from "@prisma/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/form";
import { DISCIPLINES, CHALLENGE_STATUSES } from "@/lib/domain";
import { parseOptions } from "@/lib/vakproef";

export function ChallengeForm({
  action,
  challenge,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  challenge?: Challenge;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};
  const opts = challenge ? parseOptions(challenge.optionsJson) : [];
  const correctSlot = challenge ? challenge.correctIndex + 1 : 1;

  return (
    <form action={formAction}>
      {challenge && <input type="hidden" name="id" value={challenge.id} />}
      <Card>
        <CardContent className="space-y-5">
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <Field label="Titel" htmlFor="title" required error={e.title}>
            <Input
              id="title"
              name="title"
              defaultValue={challenge?.title ?? ""}
              placeholder="Bijv. Herken de lasfout"
              required
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Discipline" htmlFor="discipline" error={e.discipline}>
              <Select id="discipline" name="discipline" defaultValue={challenge?.discipline ?? ""}>
                <option value="">— algemeen —</option>
                {DISCIPLINES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status" htmlFor="status" error={e.status}>
              <Select id="status" name="status" defaultValue={challenge?.status ?? "DRAFT"}>
                {CHALLENGE_STATUSES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field
            label="Vraag / casus"
            htmlFor="question"
            required
            hint="De vakinhoudelijke vraag die alleen een echte specialist goed beantwoordt."
            error={e.question}
          >
            <Textarea
              id="question"
              name="question"
              rows={4}
              defaultValue={challenge?.question ?? ""}
              required
            />
          </Field>

          <div className="space-y-2">
            <p className="text-sm font-medium text-slate-700">
              Antwoordopties{" "}
              <span className="font-normal text-slate-400">(min. 2; laat leeg om over te slaan)</span>
            </p>
            {[1, 2, 3, 4].map((n) => (
              <Input
                key={n}
                name={`option${n}`}
                defaultValue={opts[n - 1] ?? ""}
                placeholder={`Optie ${n}`}
                aria-label={`Antwoordoptie ${n}`}
              />
            ))}
          </div>

          <Field
            label="Juiste antwoord"
            htmlFor="correctSlot"
            hint="Welke optie (1–4) is correct?"
            error={e.correctSlot}
          >
            <Select id="correctSlot" name="correctSlot" defaultValue={String(correctSlot)}>
              <option value="1">Optie 1</option>
              <option value="2">Optie 2</option>
              <option value="3">Optie 3</option>
              <option value="4">Optie 4</option>
            </Select>
          </Field>

          <Field
            label="Toelichting"
            htmlFor="explanation"
            hint="Optioneel — wordt na het antwoord getoond."
            error={e.explanation}
          >
            <Textarea
              id="explanation"
              name="explanation"
              rows={3}
              defaultValue={challenge?.explanation ?? ""}
            />
          </Field>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
            Annuleren
          </Link>
          <SubmitButton>{submitLabel}</SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}
