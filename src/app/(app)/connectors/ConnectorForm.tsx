"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { VmsConnector } from "@prisma/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/form";
import { VMS_STATUSES } from "@/lib/domain";

const PRIORITIES = [1, 2, 3, 4, 5];

export function ConnectorForm({
  action,
  connector,
  hasApiKey = false,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** Zonder apiKey — de key mag de server nooit verlaten (client-props worden geserialiseerd). */
  connector?: Omit<VmsConnector, "apiKey">;
  hasApiKey?: boolean;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction}>
      {connector && <input type="hidden" name="id" value={connector.id} />}
      <Card>
        <CardContent className="space-y-5">
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <Field label="Naam" htmlFor="name" required error={e.name}>
            <Input
              id="name"
              name="name"
              defaultValue={connector?.name ?? ""}
              placeholder="Bijv. SAP Fieldglass"
              required
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Sleutel"
              htmlFor="key"
              required
              hint="Korte, unieke code (bijv. fieldglass)"
              error={e.key}
            >
              <Input
                id="key"
                name="key"
                defaultValue={connector?.key ?? ""}
                placeholder="fieldglass"
                required
              />
            </Field>
            <Field label="Website" htmlFor="website" error={e.website}>
              <Input
                id="website"
                name="website"
                type="url"
                placeholder="https://…"
                defaultValue={connector?.website ?? ""}
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Status" htmlFor="status" error={e.status}>
              <Select
                id="status"
                name="status"
                defaultValue={connector?.status ?? "MANUAL"}
              >
                {VMS_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Prioriteit"
              htmlFor="priority"
              hint="1 = laag, 5 = hoog"
              error={e.priority}
            >
              <Select
                id="priority"
                name="priority"
                defaultValue={String(connector?.priority ?? 3)}
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Notities" htmlFor="notes" error={e.notes}>
            <Textarea id="notes" name="notes" defaultValue={connector?.notes ?? ""} />
          </Field>

          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              API-koppeling (MSP)
            </p>
            <p className="mb-4 text-xs text-slate-500">
              De echte key komt later van het platform. Tot die tijd werkt de intake al via de
              webhook en de testlevering op de MSP-intake-pagina.
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="API-basis-URL" htmlFor="apiBaseUrl" error={e.apiBaseUrl}>
                <Input
                  id="apiBaseUrl"
                  name="apiBaseUrl"
                  type="url"
                  placeholder="https://api.magnitglobal.com/…"
                  defaultValue={connector?.apiBaseUrl ?? ""}
                />
              </Field>
              <Field
                label="API-key"
                htmlFor="apiKey"
                hint={hasApiKey ? "Er is een key ingesteld — leeg laten = behouden" : "Nog geen key ingesteld"}
                error={e.apiKey}
              >
                <Input
                  id="apiKey"
                  name="apiKey"
                  type="password"
                  autoComplete="off"
                  placeholder={hasApiKey ? "••••••••" : "Plak hier de key zodra je hem hebt"}
                />
              </Field>
            </div>
            {hasApiKey && (
              <label className="mt-3 inline-flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="apiKeyClear" className="h-4 w-4 rounded border-slate-300" />
                API-key wissen
              </label>
            )}
          </div>

          <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Automatische pijplijn
            </p>
            <p className="mb-4 text-xs text-slate-500">
              Wat er automatisch gebeurt met elke vacature die via deze connector binnenkomt.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {(
                [
                  ["autoFilter", "AI-relevantiefilter (Q4S-niche)"],
                  ["autoImprove", "Uitschrijven in website-format"],
                  ["autoPublishSite", "Direct live op de website"],
                  ["autoDraftPost", "LinkedIn-concept klaarzetten (Socials)"],
                  ["autoMatch", "Kandidaten matchen (met %)"],
                  ["notifyRecruiter", "Melding voor de recruiter"],
                ] as const
              ).map(([name, label]) => (
                <label
                  key={name}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                >
                  <input
                    type="checkbox"
                    name={name}
                    defaultChecked={connector?.[name] ?? true}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  {label}
                </label>
              ))}
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
