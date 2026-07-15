"use client";

import { useActionState } from "react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { emptyFormState, type FormState } from "@/lib/form";
import { CRM_SCOPES } from "@/lib/domain";
import type { EffectiveCrmSettings } from "@/lib/crm";

const ACCENTS = [
  { value: "brand", label: "Groen (merk)" },
  { value: "violet", label: "Violet" },
  { value: "green", label: "Smaragd" },
  { value: "amber", label: "Amber" },
  { value: "red", label: "Rood" },
  { value: "slate", label: "Grijs" },
];

type StageOpt = { key: string; name: string };

export function SettingsForm({
  action,
  settings,
  stages,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  settings: EffectiveCrmSettings;
  stages: StageOpt[];
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};
  const showsAll = settings.visibleStages === null;

  return (
    <form action={formAction}>
      <Card>
        <CardContent className="space-y-5">
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Standaard weergave" htmlFor="defaultScope" hint="Waar de CRM op opent" error={e.defaultScope}>
              <Select id="defaultScope" name="defaultScope" defaultValue={settings.defaultScope}>
                {CRM_SCOPES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Vastgelopen na (dagen)"
              htmlFor="staleAfterDays"
              hint="Zonder activiteit telt een deal als vastgelopen"
              error={e.staleAfterDays}
            >
              <Input id="staleAfterDays" name="staleAfterDays" type="number" min={1} max={365} defaultValue={settings.staleAfterDays} />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Doel: deals / maand" htmlFor="targetDealsPerMonth" error={e.targetDealsPerMonth}>
              <Input id="targetDealsPerMonth" name="targetDealsPerMonth" type="number" min={0} defaultValue={settings.targetDealsPerMonth} />
            </Field>
            <Field label="Doel: plaatsingen / maand" htmlFor="targetPlacementsPerMonth" error={e.targetPlacementsPerMonth}>
              <Input id="targetPlacementsPerMonth" name="targetPlacementsPerMonth" type="number" min={0} defaultValue={settings.targetPlacementsPerMonth} />
            </Field>
            <Field label="Doel: omzet / maand (€)" htmlFor="targetRevenuePerMonth" error={e.targetRevenuePerMonth}>
              <Input id="targetRevenuePerMonth" name="targetRevenuePerMonth" type="number" min={0} step="500" defaultValue={settings.targetRevenuePerMonth} />
            </Field>
          </div>

          <Field label="Accentkleur" htmlFor="accent" error={e.accent}>
            <Select id="accent" name="accent" defaultValue={settings.accent}>
              {ACCENTS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </Select>
          </Field>

          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Zichtbare fases op mijn bord</p>
            <p className="mb-3 text-xs text-slate-500">
              Kies welke pipeline-fases je op je bord ziet. Vink alles aan (of niets) om alle fases te tonen.
            </p>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {stages.map((s) => (
                <label key={s.key} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    name="visibleStages"
                    value={s.key}
                    defaultChecked={showsAll || (settings.visibleStages?.includes(s.key) ?? false)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end">
          <SubmitButton>Voorkeuren opslaan</SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}
