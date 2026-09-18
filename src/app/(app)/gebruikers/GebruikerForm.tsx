"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { AppUser } from "@prisma/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/form";
import { APP_USER_ROLES } from "@/lib/domain";
import type { NavTreeHub } from "@/components/nav";
import { AccessPicker } from "./AccessPicker";

export function GebruikerForm({
  action,
  user,
  isSelf,
  submitLabel,
  cancelHref,
  navTree,
  initialHubs,
  initialPages,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  user?: AppUser;
  /** Bewerk je je eigen account? Dan verdwijnt het directe wachtwoordveld:
   *  je eigen wachtwoord loopt via de bevestiging per e-mail eronder. */
  isSelf?: boolean;
  submitLabel: string;
  cancelHref: string;
  navTree: NavTreeHub[];
  initialHubs: string[];
  initialPages: string[];
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};
  const [role, setRole] = useState(user?.role ?? "GEBRUIKER");

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
            <Field label="Telefoon" htmlFor="phone" error={e.phone} hint="Komt op de e-mailhandtekening.">
              <Input
                id="phone"
                name="phone"
                defaultValue={user?.phone ?? ""}
                placeholder="+31 (0)6 12 34 56 78"
              />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Rol" htmlFor="role" error={e.role}>
              <Select id="role" name="role" defaultValue={user?.role ?? "GEBRUIKER"} onValueChange={setRole}>
                {APP_USER_ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </Field>
            {!isSelf && (
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
            )}
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

          {/* Toegang: alleen relevant voor een GEBRUIKER; een Beheerder ziet alles.
              De verborgen inputs blijven altijd in de DOM zodat het formulier ze
              meestuurt — bij ADMIN als lege selectie. */}
          {role === "ADMIN" ? (
            <>
              <input type="hidden" name="allowedHubs" value="[]" />
              <input type="hidden" name="allowedPages" value="[]" />
              <p className="rounded-lg bg-violet-50 px-4 py-3 text-sm text-violet-800">
                Een <strong>Beheerder</strong> heeft toegang tot alle werkplekken en pagina&apos;s.
              </p>
            </>
          ) : (
            <div>
              <p className="mb-1.5 block text-[13px] font-medium text-ink-600">Toegang tot werkplekken &amp; pagina&apos;s</p>
              <p className="mb-3 text-xs text-ink-400">
                Vink aan welke werkplekken deze gebruiker mag zien. Klap een werkplek open om de zichtbare pagina&apos;s te beperken.
              </p>
              <AccessPicker tree={navTree} initialHubs={initialHubs} initialPages={initialPages} />
            </div>
          )}
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
