"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Deal } from "@prisma/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/form";
import { DISCIPLINES, DEAL_SOURCES } from "@/lib/domain";

type IdName = { id: string; label: string };

function toDateValue(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toISOString().slice(0, 10);
}

export function DealForm({
  action,
  deal,
  submitLabel,
  cancelHref,
  currentRecruiterId,
  stages,
  recruiters,
  targets,
  clients,
  vacancies,
  contacts,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  deal?: Deal;
  submitLabel: string;
  cancelHref: string;
  currentRecruiterId: string | null;
  stages: IdName[];
  recruiters: IdName[];
  targets: IdName[];
  clients: IdName[];
  vacancies: IdName[];
  contacts: IdName[];
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction}>
      {deal && <input type="hidden" name="id" value={deal.id} />}
      <Card>
        <CardContent className="space-y-5">
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Titel" htmlFor="title" required error={e.title}>
              <Input
                id="title"
                name="title"
                defaultValue={deal?.title ?? ""}
                placeholder="Bijv. 2× NDT Inspector — TenneT"
                required
              />
            </Field>
            <Field label="Bedrijf / opdrachtgever" htmlFor="company" required error={e.company}>
              <Input
                id="company"
                name="company"
                defaultValue={deal?.company ?? ""}
                placeholder="Bijv. TenneT"
                required
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Discipline" htmlFor="discipline" error={e.discipline}>
              <Select id="discipline" name="discipline" defaultValue={deal?.discipline ?? ""}>
                <option value="">—</option>
                {DISCIPLINES.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fase" htmlFor="stageId" required error={e.stageId}>
              <Select id="stageId" name="stageId" defaultValue={deal?.stageId ?? stages[0]?.id}>
                {stages.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Eigenaar (recruiter)" htmlFor="ownerId" error={e.ownerId}>
              <Select
                id="ownerId"
                name="ownerId"
                defaultValue={deal?.ownerId ?? currentRecruiterId ?? ""}
              >
                <option value="">— geen —</option>
                {recruiters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-4">
            <Field label="Waarde (€)" htmlFor="value" hint="Verwachte marge/fee" error={e.value}>
              <Input id="value" name="value" type="number" min={0} step="100" defaultValue={deal?.value ?? 0} />
            </Field>
            <Field label="Posities" htmlFor="positions" error={e.positions}>
              <Input id="positions" name="positions" type="number" min={1} defaultValue={deal?.positions ?? 1} />
            </Field>
            <Field label="Fit / warmte" htmlFor="fitScore" hint="Ideale klant?" error={e.fitScore}>
              <Select id="fitScore" name="fitScore" defaultValue={String(deal?.fitScore ?? 0)}>
                <option value="0">Onbeoordeeld</option>
                <option value="1">★ (1)</option>
                <option value="2">★★ (2)</option>
                <option value="3">★★★ (3)</option>
                <option value="4">★★★★ (4)</option>
                <option value="5">★★★★★ (5)</option>
              </Select>
            </Field>
            <Field label="Bron" htmlFor="source" error={e.source}>
              <Select id="source" name="source" defaultValue={deal?.source ?? "MANUAL"}>
                {DEAL_SOURCES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Verwachte sluitdatum" htmlFor="expectedCloseDate" error={e.expectedCloseDate}>
              <Input
                id="expectedCloseDate"
                name="expectedCloseDate"
                type="date"
                defaultValue={toDateValue(deal?.expectedCloseDate)}
              />
            </Field>
            <Field label="Volgende opvolging" htmlFor="nextFollowUpAt" hint="Plan je eerstvolgende actie" error={e.nextFollowUpAt}>
              <Input
                id="nextFollowUpAt"
                name="nextFollowUpAt"
                type="date"
                defaultValue={toDateValue(deal?.nextFollowUpAt)}
              />
            </Field>
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Koppelingen (optioneel)
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Opdrachtgever" htmlFor="targetClientId" error={e.targetClientId}>
                <Select id="targetClientId" name="targetClientId" defaultValue={deal?.targetClientId ?? ""}>
                  <option value="">— geen —</option>
                  {targets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Klant (gefactureerd)" htmlFor="clientId" error={e.clientId}>
                <Select id="clientId" name="clientId" defaultValue={deal?.clientId ?? ""}>
                  <option value="">— geen —</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Vacature" htmlFor="vacancyId" error={e.vacancyId}>
                <Select id="vacancyId" name="vacancyId" defaultValue={deal?.vacancyId ?? ""}>
                  <option value="">— geen —</option>
                  {vacancies.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Contactpersoon" htmlFor="primaryContactId" error={e.primaryContactId}>
                <Select id="primaryContactId" name="primaryContactId" defaultValue={deal?.primaryContactId ?? ""}>
                  <option value="">— geen —</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>
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
