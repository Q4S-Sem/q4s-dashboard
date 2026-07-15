"use client";

import { useActionState } from "react";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { emptyFormState, type FormState } from "@/lib/form";

type BillingConsultant = {
  id: string;
  companyName: string | null;
  kvkNumber: string | null;
  vatNumber: string | null;
  iban: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  email: string | null;
  phone: string | null;
};

export function BillingForm({
  action,
  placementId,
  consultant,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  placementId: string;
  consultant: BillingConsultant;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="placementId" value={placementId} />
      <input type="hidden" name="consultantId" value={consultant.id} />

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Bedrijfsnaam" htmlFor="companyName" error={e.companyName}>
          <Input id="companyName" name="companyName" defaultValue={consultant.companyName ?? ""} />
        </Field>
        <Field label="IBAN" htmlFor="iban" error={e.iban}>
          <Input id="iban" name="iban" defaultValue={consultant.iban ?? ""} placeholder="NL00 BANK 0000 0000 00" />
        </Field>
        <Field label="KvK-nummer" htmlFor="kvkNumber" error={e.kvkNumber}>
          <Input id="kvkNumber" name="kvkNumber" defaultValue={consultant.kvkNumber ?? ""} />
        </Field>
        <Field label="BTW-nummer" htmlFor="vatNumber" error={e.vatNumber}>
          <Input id="vatNumber" name="vatNumber" defaultValue={consultant.vatNumber ?? ""} />
        </Field>
        <Field label="E-mail" htmlFor="email" error={e.email}>
          <Input id="email" name="email" type="email" defaultValue={consultant.email ?? ""} />
        </Field>
        <Field label="Telefoon" htmlFor="phone" error={e.phone}>
          <Input id="phone" name="phone" defaultValue={consultant.phone ?? ""} />
        </Field>
        <Field label="Adres" htmlFor="address" error={e.address}>
          <Input id="address" name="address" defaultValue={consultant.address ?? ""} />
        </Field>
        <div className="grid grid-cols-[1fr_2fr] gap-3">
          <Field label="Postcode" htmlFor="postalCode" error={e.postalCode}>
            <Input id="postalCode" name="postalCode" defaultValue={consultant.postalCode ?? ""} />
          </Field>
          <Field label="Plaats" htmlFor="city" error={e.city}>
            <Input id="city" name="city" defaultValue={consultant.city ?? ""} />
          </Field>
        </div>
      </div>

      <div className="flex justify-end">
        <SubmitButton pendingLabel="Opslaan…">Factuurgegevens opslaan</SubmitButton>
      </div>
    </form>
  );
}
