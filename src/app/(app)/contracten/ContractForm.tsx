"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { Contract } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/form";
import { CONTRACT_STATUSES } from "@/lib/domain";

type ConsultantOption = { id: string; name: string; company: string; kvk: string; vat: string; address: string };
type PlacementOption = { id: string; consultantId: string; label: string; thirdParty: string };

/** Voor-invulwaarden bij een nieuw contract (bijv. aangemaakt vanuit een plaatsing). */
type ContractDefaults = {
  consultantId?: string;
  placementId?: string | null;
  contractorName?: string;
  contractorAddress?: string;
  contractorKvk?: string;
  contractorVat?: string;
};

function toDateInput(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export function ContractForm({
  action,
  contract,
  defaults,
  consultants,
  placements,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  contract?: Contract | null;
  defaults?: ContractDefaults;
  consultants: ConsultantOption[];
  placements: PlacementOption[];
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};
  const c = contract;
  const d = defaults;

  return (
    <form action={formAction} className="space-y-6">
      {c && <input type="hidden" name="id" value={c.id} />}

      {state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p>
      )}

      {/* Koppeling */}
      <Card>
        <CardHeader>
          <CardTitle>Koppeling</CardTitle>
          <span className="text-sm text-ink-400">
            Aan wie hangt dit contract? Bij een plaatsing verschijnt het straks ook in dat dossier.
          </span>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Opdrachtnemer (freelancer)" htmlFor="consultantId" required error={e.consultantId}>
              <Select id="consultantId" name="consultantId" defaultValue={c?.consultantId ?? d?.consultantId ?? ""}>
                <option value="" disabled>Kies een opdrachtnemer…</option>
                {consultants.map((o) => (
                  <option key={o.id} value={o.id}>{o.name}{o.company ? ` — ${o.company}` : ""}</option>
                ))}
              </Select>
            </Field>
            <Field label="Plaatsing (optioneel)" htmlFor="placementId" error={e.placementId} hint="Koppel aan een plaatsing bij een klant.">
              <Select id="placementId" name="placementId" defaultValue={c?.placementId ?? d?.placementId ?? ""}>
                <option value="">— Geen plaatsing —</option>
                {placements.map((p) => (
                  <option key={p.id} value={p.id}>{p.label}</option>
                ))}
              </Select>
            </Field>
            <Field label="Contractnummer / referentie" htmlFor="number" error={e.number} hint="Bijv. Q4S-OVO-2025-001">
              <Input id="number" name="number" defaultValue={c?.number ?? ""} />
            </Field>
            <Field label="Status" htmlFor="status" error={e.status}>
              <Select id="status" name="status" defaultValue={c?.status ?? "DRAFT"}>
                {CONTRACT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </Select>
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Opdrachtnemer */}
      <Card>
        <CardHeader>
          <CardTitle>Opdrachtnemer (partij 2)</CardTitle>
          <span className="text-sm text-ink-400">Zoals het op het contract komt te staan.</span>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Naam (handelend onder)" htmlFor="contractorName" required error={e.contractorName}>
              <Input id="contractorName" name="contractorName" defaultValue={c?.contractorName ?? d?.contractorName ?? ""} required />
            </Field>
            <Field label="Gevestigd te" htmlFor="contractorAddress" error={e.contractorAddress}>
              <Input id="contractorAddress" name="contractorAddress" defaultValue={c?.contractorAddress ?? d?.contractorAddress ?? ""} />
            </Field>
            <Field label="KvK-nummer" htmlFor="contractorKvk" error={e.contractorKvk}>
              <Input id="contractorKvk" name="contractorKvk" defaultValue={c?.contractorKvk ?? d?.contractorKvk ?? ""} />
            </Field>
            <Field label="BTW-nummer" htmlFor="contractorVat" error={e.contractorVat}>
              <Input id="contractorVat" name="contractorVat" defaultValue={c?.contractorVat ?? d?.contractorVat ?? ""} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Opdracht */}
      <Card>
        <CardHeader>
          <CardTitle>De opdracht</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Vakgebied Opdrachtgever" htmlFor="fieldOfWork" error={e.fieldOfWork} hint="Overweging a">
              <Input id="fieldOfWork" name="fieldOfWork" defaultValue={c?.fieldOfWork ?? "Quality & Inspection Services"} />
            </Field>
            <Field label="Behoefte / dienst" htmlFor="serviceNeed" error={e.serviceNeed} hint="Overweging b">
              <Input id="serviceNeed" name="serviceNeed" defaultValue={c?.serviceNeed ?? "Quality Management & Inspection Services"} />
            </Field>
          </div>
          <Field label="Derde / eindklant / project" htmlFor="thirdParty" error={e.thirdParty} hint="Overweging c — bij of ten behoeve van welke derde">
            <Input id="thirdParty" name="thirdParty" defaultValue={c?.thirdParty ?? ""} />
          </Field>
          <Field label="Werkzaamheden (artikel 1.1)" htmlFor="workDescription" error={e.workDescription}>
            <Textarea id="workDescription" name="workDescription" rows={3} defaultValue={c?.workDescription ?? ""} />
          </Field>
        </CardContent>
      </Card>

      {/* Duur */}
      <Card>
        <CardHeader><CardTitle>Duur &amp; opzegging (artikel 3 &amp; 5)</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Aanvang" htmlFor="startDate" error={e.startDate}>
              <Input id="startDate" name="startDate" type="date" defaultValue={toDateInput(c?.startDate ?? null)} />
            </Field>
            <Field label="Tot" htmlFor="endDate" error={e.endDate}>
              <Input id="endDate" name="endDate" type="date" defaultValue={toDateInput(c?.endDate ?? null)} />
            </Field>
            <Field label="Of: projectduur" htmlFor="projectDuration" error={e.projectDuration} hint="Bijv. 4 maanden met verlenging">
              <Input id="projectDuration" name="projectDuration" defaultValue={c?.projectDuration ?? ""} />
            </Field>
            <Field label="Opzegtermijn" htmlFor="noticePeriod" error={e.noticePeriod}>
              <Input id="noticePeriod" name="noticePeriod" defaultValue={c?.noticePeriod ?? "twee (2) weken"} />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Vergoeding */}
      <Card>
        <CardHeader>
          <CardTitle>Vergoeding (artikel 6)</CardTitle>
          <span className="text-sm text-ink-400">Vul de tarieven in zoals ze op het contract moeten staan (vrije tekst, bijv. &ldquo;€ 78,-&rdquo;).</span>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-5">
            <Field label="Uurtarief — dag" htmlFor="rateDay" error={e.rateDay}>
              <Input id="rateDay" name="rateDay" defaultValue={c?.rateDay ?? ""} placeholder="€ 78,-" />
            </Field>
            <Field label="Shift" htmlFor="rateShift" error={e.rateShift}>
              <Input id="rateShift" name="rateShift" defaultValue={c?.rateShift ?? ""} placeholder="€ 80,-" />
            </Field>
            <Field label="Zaterdag" htmlFor="rateSaturday" error={e.rateSaturday}>
              <Input id="rateSaturday" name="rateSaturday" defaultValue={c?.rateSaturday ?? ""} placeholder="€ 80,-" />
            </Field>
            <Field label="Zon/feestdag" htmlFor="rateSunday" error={e.rateSunday}>
              <Input id="rateSunday" name="rateSunday" defaultValue={c?.rateSunday ?? ""} placeholder="€ 80,-" />
            </Field>
            <Field label="Offshore (NL)" htmlFor="rateOffshore" error={e.rateOffshore}>
              <Input id="rateOffshore" name="rateOffshore" defaultValue={c?.rateOffshore ?? ""} placeholder="+ 0 %" />
            </Field>
            <Field label="Overuren" htmlFor="rateOvertime" error={e.rateOvertime}>
              <Input id="rateOvertime" name="rateOvertime" defaultValue={c?.rateOvertime ?? ""} placeholder="€ 80,-" />
            </Field>
            <Field label="Voor overuren gelden uren" htmlFor="overtimeApplies" error={e.overtimeApplies}>
              <Input id="overtimeApplies" name="overtimeApplies" defaultValue={c?.overtimeApplies ?? ""} placeholder="zie uurtarief" />
            </Field>
            <Field label="Dagtarief" htmlFor="rateDayFixed" error={e.rateDayFixed}>
              <Input id="rateDayFixed" name="rateDayFixed" defaultValue={c?.rateDayFixed ?? ""} placeholder="€ 0,-" />
            </Field>
            <Field label="Dagtarief o.b.v. werkdag van" htmlFor="dayBasedOnHours" error={e.dayBasedOnHours}>
              <Input id="dayBasedOnHours" name="dayBasedOnHours" defaultValue={c?.dayBasedOnHours ?? ""} placeholder="8 uur" />
            </Field>
            <Field label="Kilometervergoeding" htmlFor="kmRate" error={e.kmRate}>
              <Input id="kmRate" name="kmRate" defaultValue={c?.kmRate ?? ""} placeholder="€ 0,-" />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field label="Factuur-e-mail" htmlFor="invoiceEmail" error={e.invoiceEmail}>
              <Input id="invoiceEmail" name="invoiceEmail" defaultValue={c?.invoiceEmail ?? "admin@q4s.nl"} />
            </Field>
            <Field label="Betalingstermijn (dagen)" htmlFor="paymentTermDays" error={e.paymentTermDays}>
              <Input id="paymentTermDays" name="paymentTermDays" type="number" min={0} defaultValue={c?.paymentTermDays ?? 30} />
            </Field>
            <label className="flex items-center gap-2.5 pt-6 text-sm text-ink-800">
              <input type="checkbox" name="vatReverseCharge" defaultChecked={c ? c.vatReverseCharge : true}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30" />
              BTW verlegd (reverse charge)
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Verzekering + aanvullende artikelen */}
      <Card>
        <CardHeader><CardTitle>Verzekering &amp; aanvullende artikelen</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <Field label="WA-verzekering dekking (artikel 8)" htmlFor="insuranceCover" error={e.insuranceCover} className="max-w-xs">
            <Input id="insuranceCover" name="insuranceCover" defaultValue={c?.insuranceCover ?? "€ 2.500.000,-"} />
          </Field>
          <div className="space-y-2.5">
            <p className="text-sm font-medium text-ink-700">Aanvullende artikelen (raken de modelovereenkomst niet):</p>
            <label className="flex items-center gap-2.5 text-sm text-ink-800">
              <input type="checkbox" name="includeConfidentiality" defaultChecked={c ? c.includeConfidentiality : true}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30" />
              Artikel 12 — Geheimhouding
            </label>
            <label className="flex items-center gap-2.5 text-sm text-ink-800">
              <input type="checkbox" name="includeGdpr" defaultChecked={c ? c.includeGdpr : true}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30" />
              Artikel 13 — Verwerking persoonsgegevens (AVG)
            </label>
            <label className="flex items-center gap-2.5 text-sm text-ink-800">
              <input type="checkbox" name="includeIp" defaultChecked={c ? c.includeIp : true}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30" />
              Artikel 14 — Intellectueel eigendom
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Ondertekening */}
      <Card>
        <CardHeader><CardTitle>Ondertekening</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Ondertekenaar Opdrachtgever (Q4S)" htmlFor="signerClient" error={e.signerClient}>
              <Input id="signerClient" name="signerClient" defaultValue={c?.signerClient ?? "P. Boomsma"} />
            </Field>
            <Field label="Plaats (Q4S)" htmlFor="signPlaceClient" error={e.signPlaceClient}>
              <Input id="signPlaceClient" name="signPlaceClient" defaultValue={c?.signPlaceClient ?? "Barendrecht"} />
            </Field>
            <Field label="Ondertekenaar Opdrachtnemer" htmlFor="signerContractor" error={e.signerContractor}>
              <Input id="signerContractor" name="signerContractor" defaultValue={c?.signerContractor ?? ""} />
            </Field>
            <Field label="Plaats (Opdrachtnemer)" htmlFor="signPlaceContractor" error={e.signPlaceContractor}>
              <Input id="signPlaceContractor" name="signPlaceContractor" defaultValue={c?.signPlaceContractor ?? ""} />
            </Field>
            <Field label="Datum ondertekening" htmlFor="signDate" error={e.signDate}>
              <Input id="signDate" name="signDate" type="date" defaultValue={toDateInput(c?.signDate ?? null)} />
            </Field>
          </div>
          <Field label="Interne notities (niet op het contract)" htmlFor="notes" error={e.notes}>
            <Textarea id="notes" name="notes" rows={2} defaultValue={c?.notes ?? ""} />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>Annuleren</Link>
        <SubmitButton pendingLabel="Opslaan…">Opslaan</SubmitButton>
      </div>
    </form>
  );
}
