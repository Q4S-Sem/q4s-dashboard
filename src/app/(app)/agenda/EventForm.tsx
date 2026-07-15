"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { CalendarEvent } from "@prisma/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/form";
import { EVENT_TYPES, EVENT_STATUSES } from "@/lib/domain";

type Opt = { id: string; label: string };

/** Format a Date (or ISO string) as a value for <input type="datetime-local">. */
function toLocalInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(
    dt.getHours(),
  )}:${pad(dt.getMinutes())}`;
}

export function EventForm({
  action,
  event,
  clients,
  targets,
  candidates,
  vacancies,
  submitLabel,
  cancelHref,
  defaultStart,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  event?: CalendarEvent;
  clients: Opt[];
  targets: Opt[];
  candidates: Opt[];
  vacancies: Opt[];
  submitLabel: string;
  cancelHref: string;
  /** Prefill for the "nieuw" form, e.g. from a clicked day (datetime-local string). */
  defaultStart?: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};
  const [allDay, setAllDay] = useState(event?.allDay ?? false);

  return (
    <form action={formAction}>
      {event && <input type="hidden" name="id" value={event.id} />}
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
              defaultValue={event?.title ?? ""}
              placeholder="Bijv. Kennismaking Tata Steel"
              required
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Type" htmlFor="type" error={e.type}>
              <Select id="type" name="type" defaultValue={event?.type ?? "MEETING"}>
                {EVENT_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status" htmlFor="status" error={e.status}>
              <Select id="status" name="status" defaultValue={event?.status ?? "PLANNED"}>
                {EVENT_STATUSES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              type="checkbox"
              name="allDay"
              checked={allDay}
              onChange={(ev) => setAllDay(ev.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
            />
            Hele dag
          </label>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Begin" htmlFor="start" required error={e.start}>
              <Input
                id="start"
                name="start"
                type="datetime-local"
                defaultValue={toLocalInput(event?.start) || defaultStart || ""}
                required
              />
            </Field>
            <Field label="Einde" htmlFor="end" hint="Optioneel" error={e.end}>
              <Input
                id="end"
                name="end"
                type="datetime-local"
                defaultValue={toLocalInput(event?.end)}
              />
            </Field>
          </div>

          <Field label="Locatie" htmlFor="location" error={e.location}>
            <Input
              id="location"
              name="location"
              defaultValue={event?.location ?? ""}
              placeholder="Bijv. Kantoor Rotterdam / Teams / op locatie"
            />
          </Field>

          {/* Koppelen aan — waar de recruiter overzicht op houdt: eerst kandidaat &
              vacature, dan de opdrachtgever/klant. */}
          <div className="space-y-5 border-t border-slate-100 pt-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Koppelen aan
            </p>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Kandidaat" htmlFor="candidateId" error={e.candidateId}>
                <Select id="candidateId" name="candidateId" defaultValue={event?.candidateId ?? ""}>
                  <option value="">— geen —</option>
                  {candidates.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Vacature" htmlFor="vacancyId" error={e.vacancyId}>
                <Select id="vacancyId" name="vacancyId" defaultValue={event?.vacancyId ?? ""}>
                  <option value="">— geen —</option>
                  {vacancies.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Opdrachtgever" htmlFor="targetClientId" error={e.targetClientId}>
                <Select id="targetClientId" name="targetClientId" defaultValue={event?.targetClientId ?? ""}>
                  <option value="">— geen —</option>
                  {targets.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Klant" htmlFor="clientId" error={e.clientId}>
                <Select id="clientId" name="clientId" defaultValue={event?.clientId ?? ""}>
                  <option value="">— geen —</option>
                  {clients.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
          </div>

          <Field
            label="Notities / gespreksverslag"
            htmlFor="notes"
            hint="Vrije aantekeningen bij dit gesprek of deze afspraak."
            error={e.notes}
          >
            <Textarea
              id="notes"
              name="notes"
              rows={5}
              defaultValue={event?.notes ?? ""}
              placeholder="Wat is er besproken, afgesproken of moet er nog gebeuren?"
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
