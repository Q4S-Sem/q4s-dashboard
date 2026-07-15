"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Opportunity } from "@prisma/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/form";
import {
  DISCIPLINES,
  OPPORTUNITY_POTENTIAL,
  OPPORTUNITY_STATUSES,
} from "@/lib/domain";

export function OpportunityForm({
  action,
  opportunity,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  opportunity?: Opportunity;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction}>
      {opportunity && <input type="hidden" name="id" value={opportunity.id} />}
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
              defaultValue={opportunity?.title ?? ""}
              placeholder="Bijv. NDT-dienstverlening voor offshore wind"
              required
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Sector / discipline" htmlFor="sector" error={e.sector}>
              <Select id="sector" name="sector" defaultValue={opportunity?.sector ?? ""}>
                <option value="">— Geen / overig —</option>
                {DISCIPLINES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Regio" htmlFor="region" error={e.region}>
              <Input
                id="region"
                name="region"
                defaultValue={opportunity?.region ?? "Nederland"}
                placeholder="Nederland"
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Potentieel" htmlFor="potential" error={e.potential}>
              <Select
                id="potential"
                name="potential"
                defaultValue={opportunity?.potential ?? "MIDDEL"}
              >
                {OPPORTUNITY_POTENTIAL.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status" htmlFor="status" error={e.status}>
              <Select
                id="status"
                name="status"
                defaultValue={opportunity?.status ?? "NEW"}
              >
                {OPPORTUNITY_STATUSES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Omschrijving" htmlFor="description" required error={e.description}>
            <Textarea
              id="description"
              name="description"
              defaultValue={opportunity?.description ?? ""}
              placeholder="Wat houdt deze kans in?"
              required
            />
          </Field>

          <Field label="Waarom kansrijk" htmlFor="rationale" error={e.rationale}>
            <Textarea
              id="rationale"
              name="rationale"
              defaultValue={opportunity?.rationale ?? ""}
              placeholder="Waarom past deze kans goed bij Q4S?"
            />
          </Field>

          <Field
            label="Doelbedrijven"
            htmlFor="targetCompanies"
            hint="Voorbeeldbedrijven, één per regel"
            error={e.targetCompanies}
          >
            <Textarea
              id="targetCompanies"
              name="targetCompanies"
              defaultValue={opportunity?.targetCompanies ?? ""}
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
