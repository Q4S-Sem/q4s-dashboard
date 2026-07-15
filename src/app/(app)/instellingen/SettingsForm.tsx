"use client";

import { useActionState } from "react";
import type { CompanySettings } from "@prisma/client";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { emptyFormState, type FormState } from "@/lib/form";

export function SettingsForm({
  action,
  settings,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  settings: CompanySettings;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-6">
      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Bedrijfsgegevens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field label="Bedrijfsnaam" htmlFor="companyName" error={e.companyName}>
            <Input id="companyName" name="companyName" defaultValue={settings.companyName ?? "Q4S"} />
          </Field>

          <Field label="Adres" htmlFor="address" error={e.address}>
            <Input id="address" name="address" placeholder="Straat en huisnummer" defaultValue={settings.address ?? ""} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Postcode" htmlFor="postalCode" error={e.postalCode}>
              <Input id="postalCode" name="postalCode" defaultValue={settings.postalCode ?? ""} />
            </Field>
            <Field label="Plaats" htmlFor="city" error={e.city}>
              <Input id="city" name="city" defaultValue={settings.city ?? ""} />
            </Field>
          </div>

          <Field label="Land" htmlFor="country" error={e.country}>
            <Input id="country" name="country" defaultValue={settings.country ?? ""} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="E-mail" htmlFor="email" error={e.email}>
              <Input id="email" name="email" type="email" defaultValue={settings.email ?? ""} />
            </Field>
            <Field label="Telefoon" htmlFor="phone" error={e.phone}>
              <Input id="phone" name="phone" defaultValue={settings.phone ?? ""} />
            </Field>
          </div>

          <Field label="Website" htmlFor="website" error={e.website}>
            <Input id="website" name="website" defaultValue={settings.website ?? ""} />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Fiscaal &amp; facturatie</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="BTW-nummer" htmlFor="vatNumber" error={e.vatNumber}>
              <Input id="vatNumber" name="vatNumber" placeholder="NL000000000B00" defaultValue={settings.vatNumber ?? ""} />
            </Field>
            <Field label="KvK-nummer" htmlFor="kvkNumber" error={e.kvkNumber}>
              <Input id="kvkNumber" name="kvkNumber" defaultValue={settings.kvkNumber ?? ""} />
            </Field>
          </div>

          <Field label="IBAN" htmlFor="iban" error={e.iban}>
            <Input id="iban" name="iban" defaultValue={settings.iban ?? ""} />
          </Field>

          <Field
            label="Factuurvoorvoegsel"
            htmlFor="invoicePrefix"
            hint="Voorvoegsel voor factuurnummers, bijv. Q4S-"
            error={e.invoicePrefix}
          >
            <Input id="invoicePrefix" name="invoicePrefix" placeholder="Q4S-" defaultValue={settings.invoicePrefix ?? ""} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Standaard BTW-tarief (%)"
              htmlFor="defaultVatRate"
              hint="Standaard BTW-percentage"
              error={e.defaultVatRate}
            >
              <Input
                id="defaultVatRate"
                name="defaultVatRate"
                type="number"
                min={0}
                max={100}
                step="0.01"
                defaultValue={settings.defaultVatRate ?? 21}
              />
            </Field>
            <Field
              label="Standaard betaaltermijn (dagen)"
              htmlFor="defaultPaymentTermDays"
              error={e.defaultPaymentTermDays}
            >
              <Input
                id="defaultPaymentTermDays"
                name="defaultPaymentTermDays"
                type="number"
                min={0}
                max={365}
                defaultValue={settings.defaultPaymentTermDays ?? 30}
              />
            </Field>
          </div>

          <Field
            label="Factuurvoettekst"
            htmlFor="invoiceFooter"
            hint="Tekst onderaan elke factuur"
            error={e.invoiceFooter}
          >
            <Textarea id="invoiceFooter" name="invoiceFooter" defaultValue={settings.invoiceFooter ?? ""} />
          </Field>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <SubmitButton>Instellingen opslaan</SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}
