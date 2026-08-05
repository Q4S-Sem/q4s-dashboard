"use client";

import { useActionState, useEffect } from "react";
import Link from "next/link";
import type { Employee } from "@prisma/client";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/form";
import { EMPLOYEE_DEPARTMENTS, EMPLOYEE_EMPLOYMENT_TYPES, CONTRACT_TYPES } from "@/lib/domain";

function di(d: Date | null | undefined): string {
  if (!d) return "";
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

export function MedewerkerForm({
  action,
  employee,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  employee?: Employee;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};

  // Kom je binnen via .../bewerken#email (bv. vanaf de Timesheet-status), spring
  // dan naar het e-mailveld, focus het en markeer het even, zodat je meteen ziet
  // waar je moet invullen.
  useEffect(() => {
    if (typeof window === "undefined" || window.location.hash !== "#email") return;
    const el = document.getElementById("email");
    if (!(el instanceof HTMLInputElement)) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    el.focus({ preventScroll: true });
    el.classList.add("ring-2", "ring-brand-500", "ring-offset-2");
    const t = setTimeout(
      () => el.classList.remove("ring-2", "ring-brand-500", "ring-offset-2"),
      2500,
    );
    return () => clearTimeout(t);
  }, []);

  return (
    <form action={formAction} className="space-y-6">
      {employee && <input type="hidden" name="id" value={employee.id} />}

      {/* Persoon & functie */}
      <Card>
        <CardContent className="space-y-5">
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Voornaam" htmlFor="firstName" required error={e.firstName}>
              <Input id="firstName" name="firstName" defaultValue={employee?.firstName ?? ""} required />
            </Field>
            <Field label="Achternaam" htmlFor="lastName" required error={e.lastName}>
              <Input id="lastName" name="lastName" defaultValue={employee?.lastName ?? ""} required />
            </Field>
            <Field label="E-mail" htmlFor="email" error={e.email}>
              <Input id="email" name="email" type="email" defaultValue={employee?.email ?? ""} />
            </Field>
            <Field label="Telefoon" htmlFor="phone" error={e.phone}>
              <Input id="phone" name="phone" defaultValue={employee?.phone ?? ""} />
            </Field>
            <Field label="Functie" htmlFor="jobTitle" error={e.jobTitle}>
              <Input id="jobTitle" name="jobTitle" placeholder="Bijv. Recruiter" defaultValue={employee?.jobTitle ?? ""} />
            </Field>
            <Field label="Afdeling" htmlFor="department" error={e.department}>
              <Select id="department" name="department" defaultValue={employee?.department ?? "OVERIG"}>
                {EMPLOYEE_DEPARTMENTS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Dienstverband & salaris */}
      <Card>
        <CardContent className="space-y-5">
          <h2 className="text-sm font-semibold text-ink-900">Dienstverband &amp; salaris</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Dienstverband" htmlFor="employmentType" error={e.employmentType}>
              <Select id="employmentType" name="employmentType" defaultValue={employee?.employmentType ?? "LOONDIENST"}>
                {EMPLOYEE_EMPLOYMENT_TYPES.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Contractvorm" htmlFor="contractType" error={e.contractType}>
              <Select id="contractType" name="contractType" defaultValue={employee?.contractType ?? ""}>
                <option value="">—</option>
                {CONTRACT_TYPES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </Field>
            <Field label="Uren per week" htmlFor="hoursPerWeek" error={e.hoursPerWeek}>
              <Input id="hoursPerWeek" name="hoursPerWeek" type="number" min={0} step="0.5" defaultValue={employee?.hoursPerWeek ?? 40} />
            </Field>
            <Field label="In dienst sinds" htmlFor="startDate" error={e.startDate}>
              <Input id="startDate" name="startDate" type="date" defaultValue={di(employee?.startDate)} />
            </Field>
            <Field label="Uit dienst (optioneel)" htmlFor="endDate" error={e.endDate}>
              <Input id="endDate" name="endDate" type="date" defaultValue={di(employee?.endDate)} />
            </Field>
            <Field label="Maandsalaris (€)" htmlFor="monthlySalary" error={e.monthlySalary}>
              <Input id="monthlySalary" name="monthlySalary" type="number" min={0} step="0.01" defaultValue={employee?.monthlySalary ?? 0} />
            </Field>
            <Field label="Vakantiedagen per jaar" htmlFor="vacationDaysPerYear" hint="Fulltime-recht" error={e.vacationDaysPerYear}>
              <Input id="vacationDaysPerYear" name="vacationDaysPerYear" type="number" min={0} step="0.5" defaultValue={employee?.vacationDaysPerYear ?? 25} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Pensioenregeling */}
      <Card>
        <CardContent className="space-y-5">
          <h2 className="text-sm font-semibold text-ink-900">Pensioenregeling</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              label="Regeling / uitvoerder"
              htmlFor="pensionScheme"
              hint="Bijv. StiPP, PMT, PME — of 'geen'"
              error={e.pensionScheme}
            >
              <Input
                id="pensionScheme"
                name="pensionScheme"
                placeholder="Bijv. StiPP Plusregeling"
                defaultValue={employee?.pensionScheme ?? ""}
              />
            </Field>
            <Field label="Deelnemersnummer" htmlFor="pensionNumber" error={e.pensionNumber}>
              <Input id="pensionNumber" name="pensionNumber" defaultValue={employee?.pensionNumber ?? ""} />
            </Field>
            <Field label="Deelname sinds" htmlFor="pensionStart" error={e.pensionStart}>
              <Input id="pensionStart" name="pensionStart" type="date" defaultValue={di(employee?.pensionStart)} />
            </Field>
            <Field label="Werknemersbijdrage (%)" htmlFor="pensionEmployeePct" error={e.pensionEmployeePct}>
              <Input
                id="pensionEmployeePct"
                name="pensionEmployeePct"
                type="number"
                min={0}
                step="0.1"
                defaultValue={employee?.pensionEmployeePct ?? ""}
              />
            </Field>
            <Field label="Werkgeversbijdrage (%)" htmlFor="pensionEmployerPct" error={e.pensionEmployerPct}>
              <Input
                id="pensionEmployerPct"
                name="pensionEmployerPct"
                type="number"
                min={0}
                step="0.1"
                defaultValue={employee?.pensionEmployerPct ?? ""}
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Persoonlijk dossier */}
      <Card>
        <CardContent className="space-y-5">
          <h2 className="text-sm font-semibold text-ink-900">Persoonlijk dossier</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Geboortedatum" htmlFor="dateOfBirth" error={e.dateOfBirth}>
              <Input id="dateOfBirth" name="dateOfBirth" type="date" defaultValue={di(employee?.dateOfBirth)} />
            </Field>
            <Field label="BSN" htmlFor="bsn" error={e.bsn}>
              <Input id="bsn" name="bsn" defaultValue={employee?.bsn ?? ""} />
            </Field>
            <Field label="IBAN" htmlFor="iban" error={e.iban}>
              <Input id="iban" name="iban" placeholder="NL00 BANK 0000 0000 00" defaultValue={employee?.iban ?? ""} />
            </Field>
            <Field label="Adres" htmlFor="address" error={e.address}>
              <Input id="address" name="address" defaultValue={employee?.address ?? ""} />
            </Field>
            <Field label="Postcode" htmlFor="postalCode" error={e.postalCode}>
              <Input id="postalCode" name="postalCode" defaultValue={employee?.postalCode ?? ""} />
            </Field>
            <Field label="Plaats" htmlFor="city" error={e.city}>
              <Input id="city" name="city" defaultValue={employee?.city ?? ""} />
            </Field>
            <Field label="Noodcontact — naam" htmlFor="emergencyName" error={e.emergencyName}>
              <Input id="emergencyName" name="emergencyName" defaultValue={employee?.emergencyName ?? ""} />
            </Field>
            <Field label="Noodcontact — telefoon" htmlFor="emergencyPhone" error={e.emergencyPhone}>
              <Input id="emergencyPhone" name="emergencyPhone" defaultValue={employee?.emergencyPhone ?? ""} />
            </Field>
          </div>

          <Field label="Notities" htmlFor="notes" error={e.notes}>
            <Textarea id="notes" name="notes" defaultValue={employee?.notes ?? ""} />
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
