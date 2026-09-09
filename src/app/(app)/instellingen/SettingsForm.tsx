"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import type { CompanySettings } from "@prisma/client";
import { Lock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConfirmSave } from "@/components/confirm-save";
import { Field, Input, Textarea } from "@/components/ui/field";
import { emptyFormState, type FormState } from "@/lib/form";
import { cn } from "@/lib/utils";

/**
 * Bedrijfsgegevens + facturatie-instellingen. Alles hier landt op de FACTUUR
 * (zie het voorbeeld ernaast), dus het scherm staat standaard OP SLOT: je leest
 * de gegevens, en pas na een klik op het potlood zijn ze te wijzigen. Opslaan
 * vraagt daarna nog één bevestiging — een typefout hier gaat mee met elke
 * factuur die daarna de deur uitgaat.
 *
 * Het slot is bewust één `<fieldset disabled>` om ALLE velden heen: een veld dat
 * er later bij komt valt daar vanzelf onder, zonder dat hier iets moet worden
 * bijgehouden. De `key` erop zet bij annuleren elk veld terug op de geladen
 * waarde — ook zonder te weten welke velden dat zijn.
 */
export function SettingsForm({
  action,
  settings,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  settings: CompanySettings;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const formRef = useRef<HTMLFormElement>(null);
  const [editing, setEditing] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  // Geslaagd opslaan levert een nieuwe `updatedAt` op → terug op slot, met de
  // zojuist opgeslagen (en server-genormaliseerde) waarden in beeld. Mislukt het
  // opslaan, dan verandert er niets en blijft het formulier openstaan, zodat de
  // foutmelding bij het veld staat dat hem veroorzaakt.
  const savedAt = settings.updatedAt.getTime();
  const seenSavedAt = useRef(savedAt);
  useEffect(() => {
    if (seenSavedAt.current === savedAt) return;
    seenSavedAt.current = savedAt;
    setEditing(false);
    setResetKey((n) => n + 1);
  }, [savedAt]);

  const cancel = () => {
    setResetKey((n) => n + 1);
    setEditing(false);
  };

  // Foutmeldingen horen bij het bewerken; op slot is er niets te corrigeren.
  const e = editing ? (state.fieldErrors ?? {}) : {};

  return (
    <form ref={formRef} action={formAction} className="space-y-6">
      {editing && state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      <Card>
        <CardHeader>
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cn(
                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm",
                editing ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-500",
              )}
            >
              {editing ? <Pencil className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            </span>
            <div className="min-w-0">
              <CardTitle>{editing ? "Bewerken" : "Vergrendeld"}</CardTitle>
              <p className="mt-1 text-sm leading-relaxed text-ink-500">
                {editing
                  ? "Pas aan wat nodig is en klik op “Instellingen opslaan”. Je krijgt eerst nog een bevestiging."
                  : "Deze gegevens staan op elke factuur. Klik op het potlood om ze te wijzigen."}
              </p>
            </div>
          </div>
          {editing ? (
            <Button type="button" variant="outline" onClick={cancel}>
              Annuleren
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setEditing(true)}
              title="Bewerken"
            >
              <Pencil className="h-4 w-4" /> Bewerken
            </Button>
          )}
        </CardHeader>
      </Card>

      <fieldset key={resetKey} disabled={!editing} className="min-w-0 space-y-6">
        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle>Bedrijfsgegevens</CardTitle>
              <p className="mt-1 text-sm text-ink-500">
                Het briefhoofd linksboven op de factuur.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field
              label="Bedrijfsnaam"
              htmlFor="companyName"
              hint="Vet bovenaan het briefhoofd en in de afsluiting onder het betaalkader."
              error={e.companyName}
            >
              <Input id="companyName" name="companyName" defaultValue={settings.companyName ?? "Q4S"} />
            </Field>

            <Field
              label="Adres"
              htmlFor="address"
              hint="Adres, postcode + plaats en land staan als losse regels onder de bedrijfsnaam."
              error={e.address}
            >
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
              <Field
                label="E-mail"
                htmlFor="email"
                hint="Contactkolom naast het adres."
                error={e.email}
              >
                <Input id="email" name="email" type="email" defaultValue={settings.email ?? ""} />
              </Field>
              <Field
                label="Telefoon"
                htmlFor="phone"
                hint="Staat op de factuur als “Tel: …”."
                error={e.phone}
              >
                <Input id="phone" name="phone" defaultValue={settings.phone ?? ""} />
              </Field>
            </div>

            <Field
              label="Website"
              htmlFor="website"
              hint="Ook in de contactkolom, boven het e-mailadres."
              error={e.website}
            >
              <Input id="website" name="website" defaultValue={settings.website ?? ""} />
            </Field>
          </CardContent>
        </Card>

        {/* Volgorde volgt de factuur: eerst het bankblok (IBAN, VAT, KvK), dan het
            kopblok rechts (Invoice no, Invoice Date), dan de totalen (VAT rate)
            en tot slot de voettekst. */}
        <Card>
          <CardHeader>
            <div className="min-w-0">
              <CardTitle>Fiscaal &amp; facturatie</CardTitle>
              <p className="mt-1 text-sm text-ink-500">
                In dezelfde volgorde als ze op de factuur staan.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            <Field
              label="IBAN (op de factuur)"
              htmlFor="iban"
              hint="In het bankblok onder het briefhoofd, en in de e-mail waarmee de factuur meegaat."
              error={e.iban}
            >
              <Input id="iban" name="iban" defaultValue={settings.iban ?? ""} />
            </Field>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="BIC"
                htmlFor="bic"
                hint="Bankidentificatie, staat op de factuur."
                error={e.bic}
              >
                <Input id="bic" name="bic" defaultValue={settings.bic ?? ""} />
              </Field>
              <Field
                label="G-rekening"
                htmlFor="gAccount"
                hint="G-rekeningnummer, indien van toepassing — staat op de factuur."
                error={e.gAccount}
              >
                <Input id="gAccount" name="gAccount" defaultValue={settings.gAccount ?? ""} />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="BTW-nummer (VAT no)"
                htmlFor="vatNumber"
                hint="Twee keer op de factuur: “VAT” in het bankblok en “VAT no” in het kopblok rechts."
                error={e.vatNumber}
              >
                <Input id="vatNumber" name="vatNumber" placeholder="NL000000000B00" defaultValue={settings.vatNumber ?? ""} />
              </Field>
              <Field
                label="KvK-nummer (KvK no)"
                htmlFor="kvkNumber"
                hint="“KvK” in het bankblok en “KvK no” in het kopblok rechts."
                error={e.kvkNumber}
              >
                <Input id="kvkNumber" name="kvkNumber" defaultValue={settings.kvkNumber ?? ""} />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Voorvoegsel factuurnummer (bijv. Q4S-)"
                htmlFor="invoicePrefix"
                hint="Komt vóór jaar en volgnummer: Q4S- wordt Q4S-2026-0100. Op de factuur bij “Invoice no”."
                error={e.invoicePrefix}
              >
                <Input id="invoicePrefix" name="invoicePrefix" placeholder="Q4S-" defaultValue={settings.invoicePrefix ?? ""} />
              </Field>
              <Field
                label="Facturen doorlopend nummeren vanaf"
                htmlFor="invoiceStartNumber"
                hint="Het volgnummer waarmee een jaar begint, bijv. 100 → Q4S-2026-0100. Is dit jaar al verder, dan blijft die stand staan — nummers lopen nooit terug en worden nooit hergebruikt."
                error={e.invoiceStartNumber}
              >
                <Input
                  id="invoiceStartNumber"
                  name="invoiceStartNumber"
                  type="number"
                  min={1}
                  max={9999}
                  step={1}
                  defaultValue={settings.invoiceStartNumber ?? 1}
                />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Q4S offerte-/quotationnummer"
                htmlFor="quotationNumber"
                hint="Vaste Q4S-referentie die als “Our ref” op elke verkoopfactuur komt (bijv. Q4S-Q-2026-014). Leeg = geen Our ref-regel."
                error={e.quotationNumber}
              >
                <Input
                  id="quotationNumber"
                  name="quotationNumber"
                  placeholder="Q4S-Q-2026-014"
                  defaultValue={settings.quotationNumber ?? ""}
                />
              </Field>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                label="Standaard betaaltermijn (dagen)"
                htmlFor="defaultPaymentTermDays"
                hint="Vervaldatum = “Invoice Date” + dit aantal dagen. Heeft een klant een eigen betaaltermijn (Klanten → Betaaltermijn), dan telt die op zijn factuur."
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
              <Field
                label="Standaard BTW-tarief (%)"
                htmlFor="defaultVatRate"
                hint="Geldt voor ALLE nieuwe verkoopfacturen tegelijk — pas 'm hier één keer aan om het %-niveau overal te wijzigen. Per plaatsing kun je 'BTW verlegd' aanzetten (dan 0%). Onder het subtotaal als “VAT rate 21%”."
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
            </div>

            <Field
              label="Factuurvoettekst"
              htmlFor="invoiceFooter"
              hint="Onderaan de inkoopfactuur (self-billing) aan de medewerker. De verkoopfactuur naar de klant sluit af met het betaalkader en de bedrijfsnaam."
              error={e.invoiceFooter}
            >
              <Textarea id="invoiceFooter" name="invoiceFooter" defaultValue={settings.invoiceFooter ?? ""} />
            </Field>
          </CardContent>
        </Card>

        {/* Testmodus — mail omleiden zodat er geen echte klant-/medewerker-mail uitgaat */}
        <Card className="border-amber-300 ring-1 ring-amber-200">
          <CardHeader>
            <CardTitle className="text-amber-900">Testmodus — e-mail omleiden</CardTitle>
            <span className="text-sm text-ink-500">
              Vul een adres in om <strong>alle</strong> uitgaande mail (facturen, herinneringen, …) daarheen te
              sturen i.p.v. naar klanten en medewerkers. Leeg = normaal versturen naar de echte ontvanger.
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            {settings.mailRedirectTo?.trim() ? (
              <p className="rounded-lg bg-amber-100 px-3 py-2 text-sm text-amber-900">
                ⚠️ <strong>Testmodus staat AAN</strong> — alle mail gaat nu naar{" "}
                <strong>{settings.mailRedirectTo}</strong>. Klanten en medewerkers ontvangen niets. Maak dit veld
                leeg (en sla op) om écht te gaan versturen.
              </p>
            ) : (
              <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                Testmodus staat <strong>uit</strong> — mail gaat naar de echte ontvangers.
              </p>
            )}
            <Field
              label="Alle uitgaande mail omleiden naar"
              htmlFor="mailRedirectTo"
              hint="Leeg laten = normaal versturen. Handig om te testen zonder klanten te mailen."
              error={e.mailRedirectTo}
            >
              <Input
                id="mailRedirectTo"
                name="mailRedirectTo"
                type="email"
                placeholder="bijv. jij@voorbeeld.nl"
                defaultValue={settings.mailRedirectTo ?? ""}
              />
            </Field>
          </CardContent>
        </Card>
      </fieldset>

      {editing && (
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-500">
              Opslaan geldt meteen voor nieuwe facturen en voor het voorbeeld hiernaast.
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="outline" onClick={cancel}>
                Annuleren
              </Button>
              <ConfirmSave
                onConfirm={() => formRef.current?.requestSubmit()}
                description="Je wijzigt gegevens die op de facturen worden gebruikt."
                confirmLabel="Ja, opslaan"
              >
                Instellingen opslaan
              </ConfirmSave>
            </div>
          </CardContent>
        </Card>
      )}
    </form>
  );
}
