"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Client } from "@prisma/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/form";

export function ClientForm({
  action,
  client,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  client?: Client;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction}>
      {client && <input type="hidden" name="id" value={client.id} />}
      <Card>
        <CardContent className="space-y-5">
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          <Field label="Bedrijfsnaam" htmlFor="companyName" required error={e.companyName}>
            <Input
              id="companyName"
              name="companyName"
              defaultValue={client?.companyName ?? ""}
              placeholder="Bijv. Tata Steel B.V."
              required
            />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Contactpersoon" htmlFor="contactName" error={e.contactName}>
              <Input id="contactName" name="contactName" defaultValue={client?.contactName ?? ""} />
            </Field>
            <Field label="Telefoon" htmlFor="phone" error={e.phone}>
              <Input id="phone" name="phone" defaultValue={client?.phone ?? ""} />
            </Field>
            <Field label="E-mail" htmlFor="email" error={e.email}>
              <Input id="email" name="email" type="email" defaultValue={client?.email ?? ""} />
            </Field>
            <Field label="Factuur-e-mail" htmlFor="invoiceEmail" hint="Waar facturen heen gaan" error={e.invoiceEmail}>
              <Input id="invoiceEmail" name="invoiceEmail" type="email" defaultValue={client?.invoiceEmail ?? ""} />
            </Field>
          </div>

          <Field label="Adres" htmlFor="address" error={e.address}>
            <Input id="address" name="address" placeholder="Straat en huisnummer" defaultValue={client?.address ?? ""} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Postcode" htmlFor="postalCode" error={e.postalCode}>
              <Input id="postalCode" name="postalCode" defaultValue={client?.postalCode ?? ""} />
            </Field>
            <Field label="Plaats" htmlFor="city" error={e.city}>
              <Input id="city" name="city" defaultValue={client?.city ?? ""} />
            </Field>
            <Field label="Land" htmlFor="country" error={e.country}>
              <Input id="country" name="country" defaultValue={client?.country ?? "Nederland"} />
            </Field>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="BTW-nummer" htmlFor="vatNumber" error={e.vatNumber}>
              <Input id="vatNumber" name="vatNumber" placeholder="NL000000000B00" defaultValue={client?.vatNumber ?? ""} />
            </Field>
            <Field label="KvK-nummer" htmlFor="kvkNumber" error={e.kvkNumber}>
              <Input id="kvkNumber" name="kvkNumber" defaultValue={client?.kvkNumber ?? ""} />
            </Field>
            <Field label="Betaaltermijn (dagen)" htmlFor="paymentTermDays" error={e.paymentTermDays}>
              <Input
                id="paymentTermDays"
                name="paymentTermDays"
                type="number"
                min={0}
                defaultValue={client?.paymentTermDays ?? 30}
              />
            </Field>
          </div>

          <Field label="Notities" htmlFor="notes" error={e.notes}>
            <Textarea id="notes" name="notes" defaultValue={client?.notes ?? ""} />
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
