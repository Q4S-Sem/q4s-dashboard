"use client";

import { useActionState, useState } from "react";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { emptyFormState } from "@/lib/form";
import { AUTOMATION_TRIGGERS } from "@/lib/automation-defs";
import { CRM_NOTE_MANUAL_TYPES } from "@/lib/domain";
import { createRule } from "./actions";

export function RuleForm() {
  const [state, formAction] = useActionState(createRule, emptyFormState);
  const e = state.fieldErrors ?? {};
  const [trigger, setTrigger] = useState<string>(AUTOMATION_TRIGGERS[0].value);
  const meta = AUTOMATION_TRIGGERS.find((t) => t.value === trigger) ?? AUTOMATION_TRIGGERS[0];

  return (
    <form action={formAction}>
      <Card>
        <CardContent className="space-y-4">
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}
          <Field label="Naam" htmlFor="name" error={e.name}>
            <Input id="name" name="name" placeholder="Bijv. Certificaat verloopt binnenkort" required />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Trigger — als…" htmlFor="trigger" hint={meta.desc} error={e.trigger}>
              <Select id="trigger" name="trigger" defaultValue={trigger} onValueChange={setTrigger}>
                {AUTOMATION_TRIGGERS.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Drempel (dagen)" htmlFor="thresholdDays" hint={meta.thresholdWord} error={e.thresholdDays}>
              <Input id="thresholdDays" name="thresholdDays" type="number" min={0} defaultValue={30} />
            </Field>
          </div>

          <Field
            label="Actie — maak een taak met deze tekst"
            htmlFor="template"
            hint={`Variabelen: ${meta.vars}`}
            error={e.template}
          >
            <Textarea
              id="template"
              name="template"
              rows={2}
              placeholder="Bijv. Certificaat {name} verloopt op {date} — vernieuwing opvragen."
              required
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Taaktype" htmlFor="taskType">
              <Select id="taskType" name="taskType" defaultValue="TASK">
                {CRM_NOTE_MANUAL_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Taak vervalt over (dagen vanaf nu)" htmlFor="dueOffsetDays" error={e.dueOffsetDays}>
              <Input id="dueOffsetDays" name="dueOffsetDays" type="number" min={0} defaultValue={0} />
            </Field>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <SubmitButton>Regel opslaan</SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}
