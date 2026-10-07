"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { fromRateText, toRateText, type RateUnit } from "@/lib/contract-tarief";
import type { Contract } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, Input, Textarea, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { Button } from "@/components/ui/button";
import { Check, Save } from "lucide-react";
import { meldOpgeslagen, useOpslaanVerzoek } from "@/components/unsaved-guard";
import { ConfirmCancel } from "@/components/confirm-cancel";
import { emptyFormState, type FormState } from "@/lib/form";
import { CONTRACT_STATUSES } from "@/lib/domain";
import { buildContractDoc, zonderOudeStandaard } from "@/lib/contract-doc";
import type { CompanySettings } from "@/lib/settings";
import { ContractVel, type Taal } from "@/components/contract/ContractVel";
import { InvulTabs } from "@/components/contract/InvulTabs";

/** Voor-invulwaarden bij een nieuw contract (bijv. aangemaakt vanuit een plaatsing). */
type ContractDefaults = {
  contractorName?: string;
  contractorAddress?: string;
  contractorKvk?: string;
  contractorVat?: string;
  contractorIban?: string;
};

/** Wat nu in het formulier staat, als Contract — voor het live voorbeeld. */
function uitFormulier(f: HTMLFormElement): Contract {
  const fd = new FormData(f);
  const o: Record<string, unknown> = {};
  for (const [k, v] of fd) if (typeof v === "string") o[k] = v;
  for (const k of [
    "vatReverseCharge",
    "includeConfidentiality",
    "includeGdpr",
    "includeIp",
  ])
    o[k] = fd.has(k);
  for (const k of ["startDate", "endDate", "signDate"])
    o[k] = o[k] ? new Date(`${o[k]}T00:00`) : null;
  o.paymentTermDays = Number(o.paymentTermDays) || 30;
  return o as unknown as Contract;
}

/** Live voorbeeld naast het formulier (mapje "Voorbeeld"); taal/downloads in `acties`. */
type Voorbeeld = {
  settings: CompanySettings;
  logoSrc: string | null;
  handtekening: string | null;
  taal: Taal;
  acties?: React.ReactNode;
};

function toDateInput(d: Date | null): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

const TARIEF_KOLOMMEN = [
  "Dag uren",
  "Shift",
  "Zaterdag",
  "Zon/feestdag",
  "Offshore (NL)",
];
const TARIEF_RIJEN = [
  [
    "Uurtarief",
    ["rateDay", "rateShift", "rateSaturday", "rateSunday", "rateOffshore"],
  ],
  [
    "Overuren",
    [
      "rateOvertime",
      "overtimeShift",
      "overtimeSaturday",
      "overtimeSunday",
      "overtimeOffshore",
    ],
  ],
  [
    "Dagtarief",
    [
      "rateDayFixed",
      "dayFixedShift",
      "dayFixedSaturday",
      "dayFixedSunday",
      "dayFixedOffshore",
    ],
  ],
] as const;

export function ContractForm({
  action,
  contract,
  defaults,
  cancelHref,
  voorbeeld,
  taalKeuze,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  contract?: Contract | null;
  defaults?: ContractDefaults;
  cancelHref: string;
  voorbeeld?: Voorbeeld;
  /** NL/EN-schakelaar, helemaal rechts in de balk. */
  taalKeuze?: React.ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [waarden, setWaarden] = useState<Contract | null>(null);
  // ponytail: setTimeout(0) — de verborgen tariefvelden (RateInput) krijgen hun waarde pas na de React-render.
  // Automatisch bewaren: een halve seconde na elke wijziging naar de database.
  const [autoId, setAutoId] = useState(contract?.id ?? "");
  const [bewaardOm, setBewaardOm] = useState<string | null>(null);
  const autoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(contract?.id ?? "");
  const lopend = useRef<Promise<void>>(Promise.resolve());
  useOpslaanVerzoek(() => autoBewaar(0));
  function autoBewaar(wacht = 500) {
    if (autoTimer.current) clearTimeout(autoTimer.current);
    autoTimer.current = setTimeout(() => {
      // Op volgorde: nooit twee gelijktijdige opslagen (anders twee contracten).
      lopend.current = lopend.current.then(async () => {
        if (!formRef.current) return;
        const fd = new FormData(formRef.current);
        fd.set("_soort", "overeenkomst");
        if (idRef.current) fd.set("id", idRef.current);
        try {
          const res = await fetch("/api/contracten/concept", {
            method: "POST",
            body: fd,
          });
          const r = res.ok
            ? ((await res.json()) as { id: string } | null)
            : null;
          if (!r) return;
          idRef.current = r.id;
          setAutoId(r.id);
          setBewaardOm(
            new Date().toLocaleTimeString("nl-NL", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            }),
          );
          meldOpgeslagen();
        } catch {
          // offline — volgende wijziging probeert opnieuw
        }
      });
    }, wacht);
  }
  const lees = () =>
    setTimeout(
      () => formRef.current && setWaarden(uitFormulier(formRef.current)),
      0,
    );
  useEffect(() => void lees(), []);
  const [state, formAction] = useActionState(action, emptyFormState);
  // Oude concepten (localStorage, zie FormAutosave) bevatten nog de vroegere
  // standaardtekst bij vakgebied/behoefte; wis die vóór het terugzetten.
  useEffect(() => {
    try {
      for (const k of Object.keys(localStorage)) {
        if (
          /::(fieldOfWork|serviceNeed)#/.test(k) &&
          zonderOudeStandaard(localStorage.getItem(k)) === ""
        )
          localStorage.removeItem(k);
      }
    } catch {
      // geen opslag beschikbaar
    }
  }, []);
  const e = state.fieldErrors ?? {};
  const c = contract;
  const d = defaults;

  const form = (
    // noValidate: de server controleert; anders blokkeert de browser stil als het formulier-mapje verborgen is.
    <form
      id="contract-form"
      noValidate
      data-no-persist
      data-autosave
      ref={formRef}
      action={formAction}
      onChange={() => {
        lees();
        autoBewaar();
      }}
      onInput={() => {
        lees();
        autoBewaar();
      }}
      className="space-y-6"
    >
      {autoId && <input type="hidden" name="id" value={autoId} />}

      {state.error && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {/* Contract */}
      <Card>
        <CardHeader>
          <CardTitle>Contract</CardTitle>
          <span className="text-sm text-ink-400">
            De opdrachtnemer is altijd een nieuw persoon; alles staat op het
            contract zelf.
          </span>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-3">
            <Field
              label="Naam opdrachtnemer"
              htmlFor="contractorName"
              required
              error={e.contractorName}
              hint="Zoals het op het contract komt (persoon of zijn bedrijf)"
            >
              <Input
                id="contractorName"
                name="contractorName"
                defaultValue={c?.contractorName ?? d?.contractorName ?? ""}
                required placeholder="Jan de Vries"
              />
            </Field>
            <Field
              label="Contractnummer / referentie"
              htmlFor="number"
              error={e.number}
              hint="Bijv. Q4S-OVO-2025-001"
            >
              <Input id="number" name="number" defaultValue={c?.number ?? ""} placeholder="Q4S-2026-001" />
            </Field>
            <Field label="Status" htmlFor="status" error={e.status}>
              <Select
                id="status"
                name="status"
                defaultValue={c?.status ?? "DRAFT"}
              >
                {CONTRACT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
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
          <span className="text-sm text-ink-400">
            Zoals het op het contract komt te staan.
          </span>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Gevestigd te"
              htmlFor="contractorAddress"
              error={e.contractorAddress}
            >
              <Input
                id="contractorAddress"
                name="contractorAddress"
                defaultValue={
                  c?.contractorAddress ?? d?.contractorAddress ?? ""
                } placeholder="Industrieweg 12, 3044 AS Rotterdam"
              />
            </Field>
            <Field
              label="KvK-nummer"
              htmlFor="contractorKvk"
              error={e.contractorKvk}
            >
              <Input
                id="contractorKvk"
                name="contractorKvk"
                defaultValue={c?.contractorKvk ?? d?.contractorKvk ?? ""} placeholder="12345678"
              />
            </Field>
            <Field
              label="BTW-nummer"
              htmlFor="contractorVat"
              error={e.contractorVat}
            >
              <Input
                id="contractorVat"
                name="contractorVat"
                defaultValue={c?.contractorVat ?? d?.contractorVat ?? ""} placeholder="NL001234567B01"
              />
            </Field>
            <Field
              label="IBAN"
              htmlFor="contractorIban"
              error={e.contractorIban}
            >
              <Input
                id="contractorIban"
                name="contractorIban"
                defaultValue={c?.contractorIban ?? d?.contractorIban ?? ""}
                placeholder="NL00 BANK 0000 0000 00"
              />
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
            <Field
              label="Vakgebied Opdrachtgever"
              htmlFor="fieldOfWork"
              error={e.fieldOfWork}
              hint="Overweging a"
            >
              <Input
                id="fieldOfWork"
                name="fieldOfWork"
                defaultValue={zonderOudeStandaard(c?.fieldOfWork)} placeholder="Staalconstructie / QA-QC"
              />
            </Field>
            <Field
              label="Behoefte / dienst"
              htmlFor="serviceNeed"
              error={e.serviceNeed}
              hint="Overweging b"
            >
              <Input
                id="serviceNeed"
                name="serviceNeed"
                defaultValue={zonderOudeStandaard(c?.serviceNeed)} placeholder="Lasinspectie (CSWIP 3.1)"
              />
            </Field>
          </div>
          <Field
            label="Derde / eindklant / project"
            htmlFor="thirdParty"
            error={e.thirdParty}
            hint="Overweging c — bij of ten behoeve van welke derde"
          >
            <Input
              id="thirdParty"
              name="thirdParty"
              defaultValue={c?.thirdParty ?? ""} placeholder="Eindklant B.V. — project Maasvlakte"
            />
          </Field>
          <Field
            label="Werkzaamheden (artikel 1.1)"
            htmlFor="workDescription"
            error={e.workDescription}
          >
            <Textarea
              id="workDescription"
              name="workDescription"
              rows={3}
              defaultValue={c?.workDescription ?? ""} placeholder="Uitvoeren van lasinspecties en rapportage conform ISO 5817 …"
            />
          </Field>
        </CardContent>
      </Card>

      {/* Duur */}
      <Card>
        <CardHeader>
          <CardTitle>Duur &amp; opzegging (artikel 3 &amp; 5)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <Field label="Aanvang" htmlFor="startDate" error={e.startDate}>
              <Input
                id="startDate"
                name="startDate"
                type="date"
                defaultValue={toDateInput(c?.startDate ?? null)}
              />
            </Field>
            <Field label="Tot" htmlFor="endDate" error={e.endDate}>
              <Input
                id="endDate"
                name="endDate"
                type="date"
                defaultValue={toDateInput(c?.endDate ?? null)}
              />
            </Field>
            <Field
              label="Contractduur"
              htmlFor="projectDuration"
              error={e.projectDuration}
              hint="Bijv. 4 maanden met optie tot verlenging"
            >
              <Input
                id="projectDuration"
                name="projectDuration"
                defaultValue={c?.projectDuration ?? ""} placeholder="6 maanden"
              />
            </Field>
            <Field
              label="Opzegtermijn"
              htmlFor="noticePeriod"
              error={e.noticePeriod}
            >
              <Input
                id="noticePeriod"
                name="noticePeriod"
                defaultValue={c?.noticePeriod ?? "twee (2) weken"} placeholder="2 weken"
              />
            </Field>
          </div>
        </CardContent>
      </Card>

      {/* Vergoeding */}
      <Card>
        <CardHeader>
          <CardTitle>Vergoeding (artikel 6)</CardTitle>
          <span className="text-sm text-ink-400">
            Kies per tarief € (bedrag) of % (percentage) en vul het getal in.
          </span>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Zelfde tabel als artikel 6 op het contract: per rij (uurtarief, overuren, dagtarief) vijf kolommen. */}
          <div className="space-y-4">
            {TARIEF_RIJEN.map(([rij, namen]) => (
              <div
                key={rij}
                className="grid gap-3 sm:grid-cols-[8rem_repeat(5,minmax(0,1fr))] sm:items-end"
              >
                <p className="text-sm font-semibold text-ink-900 sm:pb-2.5">
                  {rij}
                </p>
                {namen.map((n, i) => (
                  <Field
                    key={n}
                    label={TARIEF_KOLOMMEN[i]}
                    htmlFor={n}
                    error={e[n]}
                  >
                    <RateInput
                      name={n}
                      defaultValue={(c?.[n] as string | undefined) ?? ""}
                    />
                  </Field>
                ))}
              </div>
            ))}
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field
              label="Voor overuren gelden uren"
              htmlFor="overtimeApplies"
              error={e.overtimeApplies}
            >
              <Input
                id="overtimeApplies"
                name="overtimeApplies"
                defaultValue={c?.overtimeApplies ?? ""}
                placeholder="zie uurtarief"
              />
            </Field>
            <Field
              label="Dagtarief o.b.v. werkdag van"
              htmlFor="dayBasedOnHours"
              error={e.dayBasedOnHours}
            >
              <Input
                id="dayBasedOnHours"
                name="dayBasedOnHours"
                defaultValue={c?.dayBasedOnHours ?? ""}
                placeholder="8 uur"
              />
            </Field>
            <Field
              label="Kilometervergoeding"
              htmlFor="kmRate"
              error={e.kmRate}
            >
              {/* Nieuw contract: standaard € 0,45 per km (aanpasbaar). */}
              <RateInput name="kmRate" defaultValue={c ? (c.kmRate ?? "") : (d?.kmRate ?? "€ 0,45")} />
            </Field>
          </div>
          <div className="grid gap-5 sm:grid-cols-3">
            <Field
              label="Factuur-e-mail"
              htmlFor="invoiceEmail"
              error={e.invoiceEmail}
            >
              <Input
                id="invoiceEmail"
                name="invoiceEmail"
                defaultValue={c?.invoiceEmail ?? "admin@q4s.nl"} placeholder="facturen@bedrijf.nl"
              />
            </Field>
            <Field
              label="Betalingstermijn (dagen)"
              htmlFor="paymentTermDays"
              error={e.paymentTermDays}
            >
              <Input
                id="paymentTermDays"
                name="paymentTermDays"
                type="number"
                min={0}
                defaultValue={c?.paymentTermDays ?? 30} placeholder="30"
              />
            </Field>
            <label className="flex items-center gap-2.5 pt-6 text-sm text-ink-800">
              <input
                type="checkbox"
                name="vatReverseCharge"
                defaultChecked={c ? c.vatReverseCharge : true}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30"
              />
              BTW verlegd (reverse charge)
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Verzekering + aanvullende artikelen */}
      <Card>
        <CardHeader>
          <CardTitle>Verzekering &amp; aanvullende artikelen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field
            label="WA-verzekering dekking (artikel 8)"
            htmlFor="insuranceCover"
            error={e.insuranceCover}
            className="max-w-xs"
          >
            <Input
              id="insuranceCover"
              name="insuranceCover"
              defaultValue={c?.insuranceCover ?? "€ 2.500.000,-"} placeholder="€ 1.250.000,- per gebeurtenis"
            />
          </Field>
          <div className="space-y-2.5">
            <p className="text-sm font-medium text-ink-700">
              Aanvullende artikelen (raken de modelovereenkomst niet):
            </p>
            <label className="flex items-center gap-2.5 text-sm text-ink-800">
              <input
                type="checkbox"
                name="includeConfidentiality"
                defaultChecked={c ? c.includeConfidentiality : true}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30"
              />
              Artikel 12 — Geheimhouding
            </label>
            <label className="flex items-center gap-2.5 text-sm text-ink-800">
              <input
                type="checkbox"
                name="includeGdpr"
                defaultChecked={c ? c.includeGdpr : true}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30"
              />
              Artikel 13 — Verwerking persoonsgegevens (AVG)
            </label>
            <label className="flex items-center gap-2.5 text-sm text-ink-800">
              <input
                type="checkbox"
                name="includeIp"
                defaultChecked={c ? c.includeIp : true}
                className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30"
              />
              Artikel 14 — Intellectueel eigendom
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Ondertekening */}
      <Card>
        <CardHeader>
          <CardTitle>Ondertekening</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Ondertekenaar Opdrachtgever (Q4S)"
              htmlFor="signerClient"
              error={e.signerClient}
            >
              <Input
                id="signerClient"
                name="signerClient"
                defaultValue={c?.signerClient ?? "P. Boomsma"} placeholder="Paul Boomsma"
              />
            </Field>
            <Field
              label="Plaats (Q4S)"
              htmlFor="signPlaceClient"
              error={e.signPlaceClient}
            >
              <Input
                id="signPlaceClient"
                name="signPlaceClient"
                defaultValue={c?.signPlaceClient ?? "Barendrecht"} placeholder="Barendrecht"
              />
            </Field>
            {/* Opdrachtnemer tekent zelf: datum, plaats en naam blijven open op het contract. */}
            <Field
              label="Datum ondertekening (Q4S)"
              htmlFor="signDate"
              error={e.signDate}
            >
              <Input
                id="signDate"
                name="signDate"
                type="date"
                defaultValue={toDateInput(c?.signDate ?? null)}
              />
            </Field>
          </div>
          <Field
            label="Interne notities (niet op het contract)"
            htmlFor="notes"
            error={e.notes}
          >
            <Textarea
              id="notes"
              name="notes"
              rows={2}
              defaultValue={c?.notes ?? ""} placeholder="Alleen intern zichtbaar"
            />
          </Field>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <ConfirmCancel href={cancelHref} />
        <SubmitButton pendingLabel="Opslaan…">Opslaan</SubmitButton>
      </div>
    </form>
  );
  if (!voorbeeld) return form;
  const bron =
    waarden ??
    c ??
    ({ ...d, contractorName: d?.contractorName ?? "" } as unknown as Contract);
  const fouten = state.error || Object.keys(e).length > 0;
  return (
    <>
      {fouten && (
        <p className="no-print rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Niet opgeslagen:{" "}
          {state.error ??
            `controleer ${Object.values(e).join(", ").toLowerCase()}`}
        </p>
      )}
      <InvulTabs
        acties={
          <>
            {bewaardOm && (
              <span className="text-xs text-ink-400">Bewaard {bewaardOm}</span>
            )}
            <Button
              type="submit"
              form="contract-form"
              name="opslaanAls"
              value="concept"
              variant="outline"
              size="sm"
            >
              <Save className="h-4 w-4" /> Opslaan als concept
            </Button>
            {voorbeeld.acties}
            <Button
              type="submit"
              form="contract-form"
              name="opslaanAls"
              value="klaar"
              variant="success"
              size="sm"
            >
              <Check className="h-4 w-4" /> Klaar
            </Button>
            {taalKeuze && <span className="ml-1 border-l border-ink-200 pl-3">{taalKeuze}</span>}
          </>
        }
        formulier={form}
        voorbeeld={
          <ContractVel
            doc={buildContractDoc(bron, voorbeeld.settings)}
            logoSrc={voorbeeld.logoSrc}
            handtekening={voorbeeld.handtekening}
            taal={voorbeeld.taal}
            className="ov-schaduw"
          />
        }
      />
    </>
  );
}

/** Tarief als bedrag (€) of percentage (%); het verborgen veld bevat de tekst zoals op het contract. */
function RateInput({
  name,
  defaultValue,
}: {
  name: string;
  defaultValue: string;
}) {
  const start = fromRateText(defaultValue);
  const [unit, setUnit] = useState<RateUnit>(start.unit);
  const [value, setValue] = useState(start.value);
  return (
    <div className="flex">
      <input type="hidden" name={name} value={toRateText(value, unit)} />
      <select
        name={`${name}__eenheid`}
        aria-label="Eenheid"
        value={unit}
        onChange={(ev) => setUnit(ev.target.value as RateUnit)}
        className="shrink-0 rounded-l-sm border border-r-0 border-ink-200 bg-ink-50 px-2 text-sm font-semibold text-ink-800 focus:outline-none"
      >
        <option value="€">€</option>
        <option value="%">%</option>
      </select>
      <Input
        id={name}
        name={`${name}__getal`}
        inputMode="decimal"
        value={value}
        onChange={(ev) => setValue(ev.target.value)}
        placeholder={unit === "€" ? "78" : "10"}
        className="rounded-l-none"
      />
    </div>
  );
}
