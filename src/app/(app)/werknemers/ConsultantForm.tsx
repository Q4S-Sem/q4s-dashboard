"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Consultant } from "@prisma/client";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/form";
import { DISCIPLINES, EMPLOYMENT_TYPES, CONTRACT_TYPES } from "@/lib/domain";

/** Local-timezone-safe YYYY-MM-DD for date inputs. */
function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  const dt = new Date(d);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const day = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function ConsultantForm({
  action,
  consultant,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  consultant?: Consultant;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};
  const c = consultant;

  return (
    <form action={formAction} className="space-y-6">
      {c && <input type="hidden" name="id" value={c.id} />}

      {state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {/* Persoonsgegevens */}
      <Card>
        <CardHeader>
          <CardTitle>Persoonsgegevens</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Voornaam" htmlFor="firstName" required error={e.firstName}>
              <Input id="firstName" name="firstName" defaultValue={c?.firstName ?? ""} required />
            </Field>
            <Field label="Achternaam" htmlFor="lastName" required error={e.lastName}>
              <Input id="lastName" name="lastName" defaultValue={c?.lastName ?? ""} required />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Geboortedatum" htmlFor="dateOfBirth" error={e.dateOfBirth}>
              <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={toDateInput(c?.dateOfBirth)} />
            </Field>
            <Field label="Nationaliteit" htmlFor="nationality" error={e.nationality}>
              <Input id="nationality" name="nationality" defaultValue={c?.nationality ?? ""} />
            </Field>
            <Field label="BSN / sofinummer" htmlFor="bsn" error={e.bsn}>
              <Input id="bsn" name="bsn" defaultValue={c?.bsn ?? ""} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Contact */}
      <Card>
        <CardHeader>
          <CardTitle>Contact &amp; adres</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="E-mail" htmlFor="email" error={e.email}>
              <Input id="email" name="email" type="email" defaultValue={c?.email ?? ""} />
            </Field>
            <Field label="Telefoon" htmlFor="phone" error={e.phone}>
              <Input id="phone" name="phone" defaultValue={c?.phone ?? ""} />
            </Field>
          </div>
          <Field label="Adres" htmlFor="address" error={e.address}>
            <Input id="address" name="address" placeholder="Straat en huisnummer" defaultValue={c?.address ?? ""} />
          </Field>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Postcode" htmlFor="postalCode" error={e.postalCode}>
              <Input id="postalCode" name="postalCode" defaultValue={c?.postalCode ?? ""} />
            </Field>
            <Field label="Plaats" htmlFor="city" error={e.city}>
              <Input id="city" name="city" defaultValue={c?.city ?? ""} />
            </Field>
            <Field label="Land" htmlFor="country" error={e.country}>
              <Input id="country" name="country" defaultValue={c?.country ?? "Nederland"} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Dienstverband & contract */}
      <Card>
        <CardHeader>
          <CardTitle>Dienstverband &amp; contract</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Discipline" htmlFor="discipline" required error={e.discipline}>
              <Select id="discipline" name="discipline" defaultValue={c?.discipline ?? ""} required>
                <option value="" disabled>
                  Kies een discipline
                </option>
                {DISCIPLINES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Dienstverband" htmlFor="employmentType" error={e.employmentType}>
              <Select id="employmentType" name="employmentType" defaultValue={c?.employmentType ?? "ZZP"}>
                {EMPLOYMENT_TYPES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Inkooptarief (€/uur)" htmlFor="defaultCostRate" hint="Wat Q4S betaalt" error={e.defaultCostRate}>
              <Input id="defaultCostRate" name="defaultCostRate" type="number" step="0.01" min={0} defaultValue={c?.defaultCostRate ?? 0} />
            </Field>
            <Field label="In dienst / start" htmlFor="startDate" error={e.startDate}>
              <Input id="startDate" name="startDate" type="date" defaultValue={toDateInput(c?.startDate)} />
            </Field>
            <Field label="Status" htmlFor="active" error={e.active}>
              <label className="inline-flex h-10 items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  name="active"
                  defaultChecked={c?.active ?? true}
                  className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/30"
                />
                Actief
              </label>
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Contractvorm" htmlFor="contractType" error={e.contractType}>
              <Select id="contractType" name="contractType" defaultValue={c?.contractType ?? ""}>
                <option value="">— kies —</option>
                {CONTRACT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Contract begindatum" htmlFor="contractStart" error={e.contractStart}>
              <Input id="contractStart" name="contractStart" type="date" defaultValue={toDateInput(c?.contractStart)} />
            </Field>
            <Field label="Contract einddatum" htmlFor="contractEnd" hint="Leeg = onbepaalde tijd" error={e.contractEnd}>
              <Input id="contractEnd" name="contractEnd" type="date" defaultValue={toDateInput(c?.contractEnd)} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* ZZP / bedrijf */}
      <Card>
        <CardHeader>
          <CardTitle>ZZP / bedrijfsgegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Bedrijfsnaam" htmlFor="companyName" error={e.companyName}>
              <Input id="companyName" name="companyName" defaultValue={c?.companyName ?? ""} />
            </Field>
            <Field label="KvK-nummer" htmlFor="kvkNumber" error={e.kvkNumber}>
              <Input id="kvkNumber" name="kvkNumber" defaultValue={c?.kvkNumber ?? ""} />
            </Field>
            <Field label="BTW-nummer" htmlFor="vatNumber" error={e.vatNumber}>
              <Input id="vatNumber" name="vatNumber" defaultValue={c?.vatNumber ?? ""} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Bank & noodcontact */}
      <Card>
        <CardHeader>
          <CardTitle>Bank &amp; noodcontact</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="IBAN" htmlFor="iban" error={e.iban}>
              <Input id="iban" name="iban" placeholder="NL00 BANK 0000 0000 00" defaultValue={c?.iban ?? ""} />
            </Field>
            <Field label="Noodcontact (naam)" htmlFor="emergencyName" error={e.emergencyName}>
              <Input id="emergencyName" name="emergencyName" defaultValue={c?.emergencyName ?? ""} />
            </Field>
            <Field label="Noodcontact (telefoon)" htmlFor="emergencyPhone" error={e.emergencyPhone}>
              <Input id="emergencyPhone" name="emergencyPhone" defaultValue={c?.emergencyPhone ?? ""} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Notities */}
      <Card>
        <CardHeader>
          <CardTitle>Notities</CardTitle>
        </CardHeader>
        <CardContent>
          <Field htmlFor="notes" error={e.notes}>
            <Textarea id="notes" name="notes" defaultValue={c?.notes ?? ""} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
          Annuleren
        </Link>
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
