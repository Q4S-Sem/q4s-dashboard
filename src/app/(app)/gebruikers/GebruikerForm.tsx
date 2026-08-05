"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { AppUser } from "@prisma/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/form";
import { APP_USER_ROLES } from "@/lib/domain";

export function GebruikerForm({
  action,
  user,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  user?: AppUser;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction}>
      {user && <input type="hidden" name="id" value={user.id} />}
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
              defaultValue={user?.name ?? ""}
              placeholder="Bijv. Sem de Snoo"
              required
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="E-mail (inlognaam)" htmlFor="email" required error={e.email}>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue={user?.email ?? ""}
                placeholder="naam@q4s.nl"
                required
              />
            </Field>
            <Field label="Functie" htmlFor="jobTitle" error={e.jobTitle}>
              <Input
                id="jobTitle"
                name="jobTitle"
                defaultValue={user?.jobTitle ?? ""}
                placeholder="Bijv. Recruiter"
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Rol" htmlFor="role" error={e.role}>
              <Select id="role" name="role" defaultValue={user?.role ?? "GEBRUIKER"}>
                {APP_USER_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Wachtwoord"
              htmlFor="password"
              hint={
                user
                  ? "Laat leeg om het huidige wachtwoord te behouden."
                  : "Stel een inlogwachtwoord in."
              }
              error={e.password}
            >
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                placeholder={user?.passwordHash ? "••••••••" : "Nieuw wachtwoord"}
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-sm text-ink-700">
            <input
              type="checkbox"
              name="active"
              defaultChecked={user ? user.active : true}
              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500"
            />
            Actief — deze medewerker mag inloggen
          </label>
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
