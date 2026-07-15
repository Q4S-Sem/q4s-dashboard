"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { CrmContact } from "@prisma/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/form";

type IdName = { id: string; label: string };

export function ContactForm({
  action,
  contact,
  submitLabel,
  cancelHref,
  currentRecruiterId,
  recruiters,
  targets,
  clients,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  contact?: CrmContact;
  submitLabel: string;
  cancelHref: string;
  currentRecruiterId: string | null;
  recruiters: IdName[];
  targets: IdName[];
  clients: IdName[];
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction}>
      {contact && <input type="hidden" name="id" value={contact.id} />}
      <Card>
        <CardContent className="space-y-5">
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Voornaam" htmlFor="firstName" required error={e.firstName}>
              <Input id="firstName" name="firstName" defaultValue={contact?.firstName ?? ""} required />
            </Field>
            <Field label="Achternaam" htmlFor="lastName" error={e.lastName}>
              <Input id="lastName" name="lastName" defaultValue={contact?.lastName ?? ""} />
            </Field>
            <Field label="Functie" htmlFor="jobTitle" error={e.jobTitle}>
              <Input id="jobTitle" name="jobTitle" placeholder="Bijv. Inkoper / Hiring Manager" defaultValue={contact?.jobTitle ?? ""} />
            </Field>
            <Field label="Bedrijf" htmlFor="company" error={e.company}>
              <Input id="company" name="company" defaultValue={contact?.company ?? ""} />
            </Field>
            <Field label="E-mail" htmlFor="email" error={e.email}>
              <Input id="email" name="email" type="email" defaultValue={contact?.email ?? ""} />
            </Field>
            <Field label="Telefoon" htmlFor="phone" error={e.phone}>
              <Input id="phone" name="phone" defaultValue={contact?.phone ?? ""} />
            </Field>
          </div>

          <Field label="LinkedIn-URL" htmlFor="linkedinUrl" error={e.linkedinUrl}>
            <Input id="linkedinUrl" name="linkedinUrl" placeholder="https://linkedin.com/in/…" defaultValue={contact?.linkedinUrl ?? ""} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Eigenaar (recruiter)" htmlFor="ownerId" error={e.ownerId}>
              <Select id="ownerId" name="ownerId" defaultValue={contact?.ownerId ?? currentRecruiterId ?? ""}>
                <option value="">— geen —</option>
                {recruiters.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Opdrachtgever" htmlFor="targetClientId" error={e.targetClientId}>
              <Select id="targetClientId" name="targetClientId" defaultValue={contact?.targetClientId ?? ""}>
                <option value="">— geen —</option>
                {targets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Klant" htmlFor="clientId" error={e.clientId}>
              <Select id="clientId" name="clientId" defaultValue={contact?.clientId ?? ""}>
                <option value="">— geen —</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Notities" htmlFor="notes" hint="Vaste achtergrondinfo. Losse contactmomenten leg je vast in het notitieblok." error={e.notes}>
            <Textarea id="notes" name="notes" defaultValue={contact?.notes ?? ""} />
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
