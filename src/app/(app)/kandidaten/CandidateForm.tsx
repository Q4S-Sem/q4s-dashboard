"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { Candidate } from "@prisma/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import {
  DISCIPLINES,
  CANDIDATE_RATINGS,
  CANDIDATE_AVAILABILITY,
  CANDIDATE_INTERVIEW_STATUSES,
} from "@/lib/domain";
import { emptyFormState, type FormState } from "@/lib/form";

/** Format a Date to yyyy-mm-dd for a date-input default value. */
function di(d: Date | null | undefined): string {
  if (!d) return "";
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export function CandidateForm({
  action,
  candidate,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  candidate?: Candidate;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};
  const [availability, setAvailability] = useState(
    candidate?.availability ?? "ONBEKEND",
  );
  const [interviewStatus, setInterviewStatus] = useState(
    candidate?.interviewStatus ?? "NONE",
  );

  return (
    <form action={formAction}>
      {candidate && <input type="hidden" name="id" value={candidate.id} />}
      <Card>
        <CardContent className="space-y-5">
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          {/* Compacte velden — vullen de volle breedte in 2/3 kolommen */}
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <Field label="Voornaam" htmlFor="firstName" required error={e.firstName}>
              <Input
                id="firstName"
                name="firstName"
                defaultValue={candidate?.firstName ?? ""}
                required
              />
            </Field>
            <Field label="Achternaam" htmlFor="lastName" required error={e.lastName}>
              <Input
                id="lastName"
                name="lastName"
                defaultValue={candidate?.lastName ?? ""}
                required
              />
            </Field>
            <Field label="E-mail" htmlFor="email" error={e.email}>
              <Input id="email" name="email" type="email" defaultValue={candidate?.email ?? ""} />
            </Field>
            <Field label="Telefoon" htmlFor="phone" error={e.phone}>
              <Input id="phone" name="phone" defaultValue={candidate?.phone ?? ""} />
            </Field>
            <Field label="Discipline" htmlFor="discipline" error={e.discipline}>
              <Select id="discipline" name="discipline" defaultValue={candidate?.discipline ?? ""}>
                <option value="">— kies —</option>
                {DISCIPLINES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Locatie" htmlFor="location" error={e.location}>
              <Input
                id="location"
                name="location"
                placeholder="Bijv. Rotterdam"
                defaultValue={candidate?.location ?? ""}
              />
            </Field>
            <Field
              label="Beoordeling"
              htmlFor="rating"
              hint="Rangschik hoe inzetbaar deze kandidaat is voor klanten."
              error={e.rating}
            >
              <Select id="rating" name="rating" defaultValue={candidate?.rating ?? "ONBEKEND"}>
                {CANDIDATE_RATINGS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Beschikbaarheid"
              htmlFor="availability"
              hint="Kan deze kandidaat op dit moment ingezet worden?"
              error={e.availability}
            >
              <Select
                id="availability"
                name="availability"
                defaultValue={candidate?.availability ?? "ONBEKEND"}
                onValueChange={setAvailability}
              >
                {CANDIDATE_AVAILABILITY.map((a) => (
                  <option key={a.value} value={a.value}>
                    {a.label}
                  </option>
                ))}
              </Select>
            </Field>
            {availability === "BINNENKORT" && (
              <Field
                label="Beschikbaar vanaf"
                htmlFor="availableFrom"
                hint="Vanaf welke datum is deze kandidaat inzetbaar?"
                error={e.availableFrom}
              >
                <Input
                  id="availableFrom"
                  name="availableFrom"
                  type="date"
                  defaultValue={di(candidate?.availableFrom)}
                />
              </Field>
            )}
            <Field
              label="Interview met Q4S"
              htmlFor="interviewStatus"
              hint="Is deze kandidaat al bij ons op gesprek geweest?"
              error={e.interviewStatus}
            >
              <Select
                id="interviewStatus"
                name="interviewStatus"
                defaultValue={candidate?.interviewStatus ?? "NONE"}
                onValueChange={setInterviewStatus}
              >
                {CANDIDATE_INTERVIEW_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </Field>
            {interviewStatus !== "NONE" && (
              <Field label="Interviewdatum" htmlFor="interviewDate" error={e.interviewDate}>
                <Input
                  id="interviewDate"
                  name="interviewDate"
                  type="date"
                  defaultValue={di(candidate?.interviewDate)}
                />
              </Field>
            )}
          </div>

          {/* Beschrijvende velden */}
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Headline" htmlFor="headline" hint="Korte functieomschrijving" error={e.headline}>
              <Input
                id="headline"
                name="headline"
                placeholder="Bijv. NDT UT/RT Level 2 inspecteur"
                defaultValue={candidate?.headline ?? ""}
              />
            </Field>
            <Field label="LinkedIn-URL" htmlFor="linkedinUrl" error={e.linkedinUrl}>
              <Input
                id="linkedinUrl"
                name="linkedinUrl"
                type="url"
                placeholder="https://www.linkedin.com/in/…"
                defaultValue={candidate?.linkedinUrl ?? ""}
              />
            </Field>
          </div>

          <Field label="Notities" htmlFor="notes" error={e.notes}>
            <Textarea id="notes" name="notes" defaultValue={candidate?.notes ?? ""} />
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
