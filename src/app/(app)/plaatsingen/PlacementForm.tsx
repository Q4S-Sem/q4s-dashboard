"use client";

import { useActionState, useEffect, useState, type ReactNode, type KeyboardEvent } from "react";
import type { Placement } from "@prisma/client";
import {
  FileText,
  FileSignature,
  GraduationCap,
  Upload,
  Lock,
  Plus,
  X,
  Building2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Field, Input, Select, Textarea, Label } from "@/components/ui/field";
import { DateInput } from "@/components/ui/date-input";
import { SearchSelect } from "@/components/ui/search-select";
import { NumberInput } from "@/components/ui/number-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmCancel } from "@/components/confirm-cancel";
import { PLACEMENT_STATUSES, DISCIPLINES, EMPLOYMENT_TYPES } from "@/lib/domain";
import { cn, formatCurrency } from "@/lib/utils";
import { emptyFormState, type FormState } from "@/lib/form";
import { quickCreateClient } from "../klanten/actions";
import { lookupDutchAddress } from "../klanten/address-actions";
import { savePlacementDraft } from "./actions";

// Snelle duur-knoppen: vullen de einddatum vanaf de startdatum. Handig voor korte
// klussen (een week / paar weken) zodat je de einddatum niet los hoeft te kiezen.
const DURATIONS = [
  { kind: "1w", label: "1 week" },
  { kind: "2w", label: "2 weken" },
  { kind: "1m", label: "1 maand" },
  { kind: "3m", label: "3 maanden" },
] as const;
type DurationKind = (typeof DURATIONS)[number]["kind"];

function isoToDate(iso: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
function dateToIso(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
/** Einddatum = startdatum + duur (inclusief: 1 week eindigt op dag 7). */
function computeEnd(startISO: string, kind: DurationKind): string {
  const d = isoToDate(startISO);
  if (!d) return "";
  if (kind === "1w") d.setDate(d.getDate() + 6);
  else if (kind === "2w") d.setDate(d.getDate() + 13);
  else if (kind === "1m") {
    d.setMonth(d.getMonth() + 1);
    d.setDate(d.getDate() - 1);
  } else {
    d.setMonth(d.getMonth() + 3);
    d.setDate(d.getDate() - 1);
  }
  return dateToIso(d);
}

/** A clean upload card: icon + label + a styled picker + the chosen file(s). */
function UploadCard({
  id,
  name,
  label,
  hint,
  icon,
  multiple,
}: {
  id: string;
  name: string;
  label: string;
  hint: string;
  icon: ReactNode;
  multiple?: boolean;
}) {
  const [files, setFiles] = useState<string[]>([]);
  return (
    <div className="flex flex-col rounded-xl border border-ink-200 bg-white p-3">
      <div className="flex items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink-800">{label}</p>
          <p className="truncate text-xs text-ink-400">{hint}</p>
        </div>
      </div>
      <label
        htmlFor={id}
        className="mt-3 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-ink-300 bg-ink-50 px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:border-brand-400 hover:bg-brand-50 hover:text-brand-700"
      >
        <Upload className="h-4 w-4" />
        {files.length > 0 ? "Wijzigen" : multiple ? "Bestanden kiezen" : "Bestand kiezen"}
      </label>
      <input
        id={id}
        type="file"
        name={name}
        multiple={multiple}
        aria-label={label}
        className="sr-only"
        onChange={(ev) => setFiles(Array.from(ev.target.files ?? []).map((f) => f.name))}
      />
      {files.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-1.5 text-xs text-ink-600">
              <FileText className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
              <span className="truncate">{f}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-xs text-ink-400">Nog geen bestand gekozen</p>
      )}
    </div>
  );
}

/** One labelled number field (Inkoop or Verkoop) with a % / €/km suffix inside. */
function ToeslagField({
  label,
  name,
  def,
  suffix,
  step,
}: {
  label: string;
  name: string;
  def: number;
  suffix: string;
  step: number | string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-400">
        {label}
      </span>
      <div className="relative">
        <NumberInput
          name={name}
          min={0}
          step={step}
          defaultValue={def || ""}
          placeholder="0"
          className="pr-12 text-right"
          aria-label={`${label} (${suffix})`}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-ink-400">
          {suffix}
        </span>
      </div>
    </label>
  );
}

/** A toeslag/km as its own block with a clear Inkoop + Verkoop field. */
function ToeslagBlock({
  title,
  hint,
  buyName,
  sellName,
  buyDefault,
  sellDefault,
  suffix,
  step,
}: {
  title: string;
  hint: string;
  buyName: string;
  sellName: string;
  buyDefault: number;
  sellDefault: number;
  suffix: string;
  step: number | string;
}) {
  return (
    <div className="rounded-lg border border-ink-200 bg-white p-4">
      <p className="text-sm font-semibold text-ink-800">{title}</p>
      <p className="mt-0.5 text-xs text-ink-400">{hint}</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <ToeslagField label="Inkoop — wij betalen" name={buyName} def={buyDefault} suffix={suffix} step={step} />
        <ToeslagField label="Verkoop — klant betaalt" name={sellName} def={sellDefault} suffix={suffix} step={step} />
      </div>
    </div>
  );
}

/**
 * Klant-keuze met een inline "+ Nieuw bedrijf". Vergeet je een bedrijf, dan zet
 * je 'm er hier meteen bij zónder de rest van je (half ingevulde) plaatsing kwijt
 * te raken — het nieuwe bedrijf wordt direct geselecteerd. De overige klantvelden
 * (BTW, KvK, adres…) vul je later op de klantpagina aan.
 */
function ClientPicker({
  initialClients,
  initialClientId,
  error,
}: {
  initialClients: { id: string; companyName: string }[];
  initialClientId?: string | null;
  error?: string;
}) {
  const [clients, setClients] = useState(initialClients);
  const [clientId, setClientId] = useState(initialClientId ?? "");
  // Bumped only when we programmatically pick a just-created klant, to remount
  // the (uncontrolled) Select with the new defaultValue.
  const [seed, setSeed] = useState(0);

  const [open, setOpen] = useState(false);
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [city, setCity] = useState("");
  const [kvkNumber, setKvkNumber] = useState("");
  const [vatNumber, setVatNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function addClient() {
    const name = companyName.trim();
    if (!name) {
      setErr("Vul een bedrijfsnaam in.");
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await quickCreateClient({
      companyName: name,
      contactName: contactName.trim() || undefined,
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      address: address.trim() || undefined,
      postalCode: postalCode.trim() || undefined,
      city: city.trim() || undefined,
      kvkNumber: kvkNumber.trim() || undefined,
      vatNumber: vatNumber.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    setClients((cs) =>
      [...cs, res.client].sort((a, b) =>
        a.companyName.localeCompare(b.companyName, "nl"),
      ),
    );
    setClientId(res.client.id);
    setSeed((s) => s + 1);
    setCompanyName("");
    setContactName("");
    setEmail("");
    setPhone("");
    setAddress("");
    setPostalCode("");
    setCity("");
    setKvkNumber("");
    setVatNumber("");
    setOpen(false);
  }

  // Enter binnen het bedrijf-paneel voegt het bedrijf toe i.p.v. het hele
  // plaatsing-formulier te versturen.
  const onEnter = (ev: KeyboardEvent) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      void addClient();
    }
  };

  return (
    <div className="space-y-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <Label htmlFor="clientId" className="mb-0">
          Klant <span className="font-normal text-ink-400">(optioneel)</span>
        </Label>
        <button
          type="button"
          onClick={() => {
            setErr(null);
            setOpen((o) => !o);
          }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-50"
        >
          {open ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
          {open ? "Sluiten" : "Nieuw bedrijf"}
        </button>
      </div>

      <SearchSelect
        key={seed}
        id="clientId"
        name="clientId"
        defaultValue={clientId}
        onValueChange={setClientId}
        options={clients.map((c) => ({ value: c.id, label: c.companyName }))}
        placeholder="Typ een klant om te zoeken…"
        emptyText="Geen klant gevonden."
      />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}

      {!clientId && !open && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span>
            <strong>Geen bedrijf gekoppeld.</strong> Je kunt deze plaatsing gewoon opslaan, maar
            er kan pas een verkoopfactuur gemaakt worden zodra je een klant koppelt. Voeg het bedrijf
            later toe door de plaatsing te bewerken.
          </span>
        </div>
      )}

      {open && (
        <div className="mt-3 space-y-3 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-ink-800">Nieuw bedrijf toevoegen</p>
              <p className="text-xs text-ink-500">
                Vul in wat je hebt — later aanvullen of wijzigen kan altijd op de klantpagina.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="qc-companyName">
                Bedrijfsnaam<span className="ml-0.5 text-red-500">*</span>
              </Label>
              <Input
                id="qc-companyName"
                value={companyName}
                onChange={(ev) => setCompanyName(ev.target.value)}
                onKeyDown={onEnter}
                placeholder="Bijv. Damen Shipyards Gorinchem"
                autoFocus
              />
            </div>
            <div>
              <Label htmlFor="qc-contactName">Contactpersoon</Label>
              <Input
                id="qc-contactName"
                value={contactName}
                onChange={(ev) => setContactName(ev.target.value)}
                onKeyDown={onEnter}
              />
            </div>
            <div>
              <Label htmlFor="qc-email">E-mail</Label>
              <Input
                id="qc-email"
                type="email"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                onKeyDown={onEnter}
              />
            </div>
            <div>
              <Label htmlFor="qc-phone">Telefoon</Label>
              <Input
                id="qc-phone"
                value={phone}
                onChange={(ev) => setPhone(ev.target.value)}
                onKeyDown={onEnter}
              />
            </div>
            <div>
              <Label htmlFor="qc-kvk">KvK-nummer</Label>
              <Input
                id="qc-kvk"
                value={kvkNumber}
                onChange={(ev) => setKvkNumber(ev.target.value)}
                onKeyDown={onEnter}
                placeholder="8 cijfers"
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="qc-address">Adres</Label>
              <Input
                id="qc-address"
                value={address}
                onChange={(ev) => setAddress(ev.target.value)}
                onKeyDown={onEnter}
                placeholder="Straat en huisnummer"
              />
            </div>
            <div>
              <Label htmlFor="qc-postalCode">Postcode</Label>
              <Input
                id="qc-postalCode"
                value={postalCode}
                onChange={(ev) => setPostalCode(ev.target.value)}
                onKeyDown={onEnter}
                placeholder="1234 AB"
              />
            </div>
            <div>
              <Label htmlFor="qc-city">Plaats</Label>
              <Input
                id="qc-city"
                value={city}
                onChange={(ev) => setCity(ev.target.value)}
                onKeyDown={onEnter}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="qc-vat">BTW-nummer</Label>
              <Input
                id="qc-vat"
                value={vatNumber}
                onChange={(ev) => setVatNumber(ev.target.value)}
                onKeyDown={onEnter}
                placeholder="NL000000000B00"
              />
            </div>
          </div>

          {err && <p className="text-xs text-red-600">{err}</p>}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setErr(null);
                setOpen(false);
              }}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition-colors hover:bg-white"
            >
              Annuleren
            </button>
            <button
              type="button"
              onClick={() => void addClient()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              {busy ? "Bezig…" : "Toevoegen & selecteren"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function PlacementForm({
  action,
  placement,
  consultants,
  clients,
  submitLabel,
  cancelHref,
  draft,
  draftId,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  placement?: Placement;
  consultants: { id: string; firstName: string; lastName: string }[];
  clients: { id: string; companyName: string }[];
  submitLabel: string;
  cancelHref: string;
  /** Bewaard concept om verder in te vullen (veld → waarde). */
  draft?: Record<string, string>;
  draftId?: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};
  const dv = (name: string, fallback = "") => draft?.[name] ?? fallback;

  // Create mode only: fill in a new person inline (default) or pick an existing one.
  const [personMode, setPersonMode] = useState<"existing" | "new">(
    draft?.personMode === "existing" ? "existing" : "new",
  );

  // Mirror the rate inputs into state purely to render a live margin panel.
  const [costRate, setCostRate] = useState<number>(
    draft?.costRate ? Number(draft.costRate) || 0 : placement?.costRate ?? 0,
  );
  const [chargeRate, setChargeRate] = useState<number>(
    draft?.chargeRate ? Number(draft.chargeRate) || 0 : placement?.chargeRate ?? 0,
  );

  // Start/eind gecontroleerd, zodat de snelle duur-knoppen de einddatum kunnen zetten.
  const [startDate, setStartDate] = useState<string>(
    draft?.startDate ??
      (placement?.startDate
        ? new Date(placement.startDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)),
  );
  const [endDate, setEndDate] = useState<string>(
    draft?.endDate ??
      (placement?.endDate ? new Date(placement.endDate).toISOString().slice(0, 10) : ""),
  );

  // Concept terugzetten: vul de gewone tekstvelden uit het opgeslagen concept.
  // De custom velden (datums, klant, werknemer, dienstverband, status) komen via
  // hun eigen state/defaults hierboven. data-no-persist op het formulier voorkomt
  // dat de sessionStorage-autosave dit overschrijft.
  useEffect(() => {
    if (!draft) return;
    const CUSTOM = new Set([
      "personMode",
      "draftId",
      "clientId",
      "consultantId",
      "startDate",
      "endDate",
      "employmentType",
      "status",
    ]);
    for (const [name, value] of Object.entries(draft)) {
      if (CUSTOM.has(name)) continue;
      document.getElementsByName(name).forEach((el) => {
        const isField =
          (el instanceof HTMLInputElement && el.type !== "hidden" && el.type !== "file") ||
          el instanceof HTMLTextAreaElement;
        if (isField && (el as HTMLInputElement | HTMLTextAreaElement).value !== value) {
          (el as HTMLInputElement | HTMLTextAreaElement).value = value;
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ZZP-adres → postcode + plaats automatisch aanvullen via PDOK (gratis, geen
  // sleutel). Schrijft rechtstreeks naar de (uncontrolled) inputs op hun id.
  const [addrStatus, setAddrStatus] = useState<"idle" | "busy" | "done" | "none">("idle");
  async function autofillZzpAddress(raw: string) {
    const q = raw.trim();
    if (q.length < 5 || !/\d/.test(q)) return; // geen huisnummer → niets op te zoeken
    setAddrStatus("busy");
    const res = await lookupDutchAddress(q);
    if (!res) {
      setAddrStatus("none");
      return;
    }
    // Alleen vertrouwen als er een postcode in stond of de straat echt in de tekst
    // voorkomt (voorkomt een verkeerde "beste gok" bij vage invoer).
    const low = q.toLowerCase();
    const pcInQuery = /\d{4}\s?[a-z]{2}/i.test(q);
    const streetMatch = Boolean(res.street) && low.includes(res.street.toLowerCase());
    if (!pcInQuery && !streetMatch) {
      setAddrStatus("none");
      return;
    }
    const setVal = (id: string, val: string) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el && val) {
        el.value = val;
        el.dispatchEvent(new Event("input", { bubbles: true }));
      }
    };
    setVal("p-address", [res.street, res.houseNumber].filter(Boolean).join(" "));
    setVal("p-postalCode", res.postcode);
    setVal("p-city", res.city);
    setAddrStatus("done");
  }

  // The werknemer of an existing plaatsing is fixed and cannot be changed here.
  const currentPerson = placement
    ? consultants.find((c) => c.id === placement.consultantId)
    : undefined;
  const currentPersonName = currentPerson
    ? `${currentPerson.firstName} ${currentPerson.lastName}`
    : "Onbekende werknemer";

  const marginPerHour = chargeRate - costRate;
  const marginPct = chargeRate > 0 ? ((chargeRate - costRate) / chargeRate) * 100 : 0;

  return (
    <form action={formAction} data-no-persist={draft ? "" : undefined}>
      {placement && <input type="hidden" name="id" value={placement.id} />}
      {draftId && <input type="hidden" name="draftId" value={draftId} />}

      {/* Snel opslaan — blijft bovenaan in beeld tijdens het scrollen. */}
      <div className="sticky top-16 z-20 mb-4 flex flex-wrap items-center justify-end gap-2 rounded-lg border border-ink-200 bg-white/90 px-3 py-2.5 shadow-sm backdrop-blur">
        <ConfirmCancel href={cancelHref} size="sm" />
        {!placement && (
          <button
            type="submit"
            formAction={savePlacementDraft}
            formNoValidate
            className={buttonVariants({ variant: "outline", size: "sm" })}
            title="Bewaar wat je nu hebt als concept — verschijnt bovenaan bij Plaatsingen"
          >
            Bewaar als concept
          </button>
        )}
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>

      <Card>
        <CardContent className="space-y-5">
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          {placement ? (
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Werknemer" error={e.consultantId}>
                {/* Fixed — the person on a plaatsing cannot be changed here. */}
                <input type="hidden" name="consultantId" value={placement.consultantId} />
                <div className="flex items-center gap-2 rounded-lg border border-ink-200 bg-ink-50 px-3 py-2">
                  <span className="text-sm font-medium text-ink-900">
                    {currentPersonName}
                  </span>
                  <span className="ml-auto inline-flex items-center gap-1 text-xs text-ink-400">
                    <Lock className="h-3 w-3" /> Vast
                  </span>
                </div>
              </Field>
              <ClientPicker
                initialClients={clients}
                initialClientId={placement.clientId}
                error={e.clientId}
              />
            </div>
          ) : (
            <>
              <input type="hidden" name="personMode" value={personMode} />
              <div>
                <Label>Werknemer</Label>
                <div className="inline-flex rounded-lg border border-ink-200 bg-ink-50 p-1 text-sm">
                  <button
                    type="button"
                    onClick={() => setPersonMode("new")}
                    className={cn(
                      "rounded-md px-3 py-1.5 font-medium transition-colors",
                      personMode === "new"
                        ? "bg-white text-brand-700 shadow-sm"
                        : "text-ink-600 hover:text-ink-900",
                    )}
                  >
                    Nieuwe werknemer
                  </button>
                  <button
                    type="button"
                    onClick={() => setPersonMode("existing")}
                    className={cn(
                      "rounded-md px-3 py-1.5 font-medium transition-colors",
                      personMode === "existing"
                        ? "bg-white text-brand-700 shadow-sm"
                        : "text-ink-600 hover:text-ink-900",
                    )}
                  >
                    Bestaande werknemer
                  </button>
                </div>
              </div>

              {personMode === "existing" ? (
                <Field label="Kies werknemer" htmlFor="consultantId" required error={e.consultantId}>
                  <SearchSelect
                    id="consultantId"
                    name="consultantId"
                    defaultValue={dv("consultantId")}
                    options={consultants.map((c) => ({
                      value: c.id,
                      label: `${c.firstName} ${c.lastName}`,
                    }))}
                    placeholder="Typ een naam om te zoeken…"
                    emptyText={
                      consultants.length === 0
                        ? "Nog geen werknemers — gebruik ‘Nieuwe werknemer’ of detacheer een medewerker."
                        : "Geen werknemer gevonden."
                    }
                  />
                </Field>
              ) : (
                <div className="space-y-4 rounded-lg border border-ink-200 p-4">
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                    Nieuwe werknemer — gegevens
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field label="Voornaam" htmlFor="firstName" required error={e.firstName}>
                      <Input id="firstName" name="firstName" required />
                    </Field>
                    <Field label="Achternaam" htmlFor="lastName" required error={e.lastName}>
                      <Input id="lastName" name="lastName" required />
                    </Field>
                    <Field label="Geboortedatum" htmlFor="dateOfBirth" error={e.dateOfBirth}>
                      <Input id="dateOfBirth" name="dateOfBirth" type="date" />
                    </Field>
                    <Field
                      label="Discipline"
                      htmlFor="discipline"
                      required
                      error={e.discipline}
                      hint="Kies een suggestie of typ je eigen discipline"
                    >
                      <Input
                        id="discipline"
                        name="discipline"
                        list="discipline-options"
                        placeholder="Bijv. Lassen, NDT, QC, HSE…"
                        required
                      />
                      <datalist id="discipline-options">
                        {DISCIPLINES.map((o) => (
                          <option key={o.value} value={o.label} />
                        ))}
                      </datalist>
                    </Field>
                    <Field label="Dienstverband" htmlFor="employmentType" error={e.employmentType}>
                      <Select id="employmentType" name="employmentType" defaultValue={dv("employmentType", "ZZP")}>
                        {EMPLOYMENT_TYPES.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="E-mail" htmlFor="email" error={e.email}>
                      <Input id="email" name="email" type="email" />
                    </Field>
                    <Field label="Telefoon" htmlFor="phone" error={e.phone}>
                      <Input id="phone" name="phone" />
                    </Field>
                    <Field label="BSN" htmlFor="bsn" error={e.bsn}>
                      <Input id="bsn" name="bsn" />
                    </Field>
                    <Field label="Nationaliteit" htmlFor="nationality" error={e.nationality}>
                      <Input id="nationality" name="nationality" />
                    </Field>
                  </div>

                  <div className="border-t border-ink-100 pt-4">
                    <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-ink-500">
                      Bedrijfsgegevens{" "}
                      <span className="font-normal normal-case text-ink-400">
                        (ZZP — voor de inkoopfactuur &amp; betaling)
                      </span>
                    </p>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Bedrijfsnaam" htmlFor="p-companyName" error={e.companyName}>
                        <Input id="p-companyName" name="companyName" placeholder="Bijv. Balder Quality Service" />
                      </Field>
                      <Field label="KvK-nummer" htmlFor="p-kvk" error={e.kvkNumber}>
                        <Input id="p-kvk" name="kvkNumber" placeholder="8 cijfers" />
                      </Field>
                      <Field label="BTW-nummer" htmlFor="p-vat" error={e.vatNumber}>
                        <Input id="p-vat" name="vatNumber" placeholder="NL000000000B00" />
                      </Field>
                      <Field label="IBAN" htmlFor="p-iban" error={e.iban}>
                        <Input id="p-iban" name="iban" placeholder="NL00 BANK 0000 0000 00" />
                      </Field>
                      <Field
                        label="Adres"
                        htmlFor="p-address"
                        hint={
                          addrStatus === "busy"
                            ? "Adres opzoeken…"
                            : addrStatus === "done"
                              ? "Postcode en plaats automatisch aangevuld ✓"
                              : addrStatus === "none"
                                ? "Niet gevonden — vul postcode en plaats zelf in."
                                : "Typ straat + huisnummer — postcode en plaats worden automatisch aangevuld."
                        }
                        error={e.address}
                      >
                        <Input
                          id="p-address"
                          name="address"
                          placeholder="Straat en huisnummer"
                          autoComplete="off"
                          onChange={() => addrStatus !== "idle" && setAddrStatus("idle")}
                          onBlur={(ev) => autofillZzpAddress(ev.target.value)}
                        />
                      </Field>
                      <div className="grid grid-cols-2 gap-3">
                        <Field label="Postcode" htmlFor="p-postalCode" error={e.postalCode}>
                          <Input id="p-postalCode" name="postalCode" placeholder="1234 AB" />
                        </Field>
                        <Field label="Plaats" htmlFor="p-city" error={e.city}>
                          <Input id="p-city" name="city" />
                        </Field>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-ink-100 pt-4">
                    <p className="mb-2.5 text-xs font-medium uppercase tracking-wide text-ink-500">
                      Documenten{" "}
                      <span className="font-normal normal-case text-ink-400">
                        (optioneel)
                      </span>
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <UploadCard
                        id="cvFile"
                        name="cvFile"
                        label="CV"
                        hint="Curriculum vitae"
                        icon={<FileText className="h-[18px] w-[18px]" />}
                      />
                      <UploadCard
                        id="contractFile"
                        name="contractFile"
                        label="Contract"
                        hint="Arbeids-/opdrachtovereenkomst"
                        icon={<FileSignature className="h-[18px] w-[18px]" />}
                      />
                      <UploadCard
                        id="diplomaFiles"
                        name="diplomaFiles"
                        label="Diploma's"
                        hint="Certificaten · meerdere mogelijk"
                        icon={<GraduationCap className="h-[18px] w-[18px]" />}
                        multiple
                      />
                    </div>
                    <p className="mt-2.5 text-xs text-ink-400">
                      Je kunt deze ook later op de plaatsing toevoegen.
                    </p>
                  </div>
                </div>
              )}

              <ClientPicker initialClients={clients} initialClientId={dv("clientId")} error={e.clientId} />
            </>
          )}

          <Field label="Functie" htmlFor="title" required error={e.title}>
            <Input
              id="title"
              name="title"
              defaultValue={placement?.title ?? ""}
              placeholder="Bijv. NDT Inspector Level 2"
              required
            />
          </Field>

          <div className="space-y-3">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Startdatum" htmlFor="startDate" required error={e.startDate}>
                <DateInput
                  id="startDate"
                  name="startDate"
                  required
                  value={startDate}
                  onValueChange={setStartDate}
                />
              </Field>
              <Field
                label="Einddatum"
                htmlFor="endDate"
                hint="Leeg laten als de plaatsing nog loopt"
                error={e.endDate}
              >
                <DateInput id="endDate" name="endDate" value={endDate} onValueChange={setEndDate} />
              </Field>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-ink-500">Snelle duur:</span>
              {DURATIONS.map((d) => (
                <button
                  key={d.kind}
                  type="button"
                  onClick={() => setEndDate(computeEnd(startDate, d.kind))}
                  disabled={!startDate}
                  className="rounded-full border border-ink-200 bg-white px-3 py-1 text-xs font-medium text-ink-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                  title={`Einddatum = startdatum + ${d.label.toLowerCase()}`}
                >
                  {d.label}
                </button>
              ))}
              {endDate && (
                <button
                  type="button"
                  onClick={() => setEndDate("")}
                  className="rounded-full px-2 py-1 text-xs text-ink-400 hover:text-ink-700"
                >
                  wissen
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Inkooptarief (per uur)" htmlFor="costRate" required error={e.costRate}>
              <Input
                id="costRate"
                name="costRate"
                type="number"
                step="0.01"
                min={0}
                defaultValue={placement?.costRate ?? ""}
                onChange={(ev) => setCostRate(Number(ev.target.value) || 0)}
                required
              />
            </Field>
            <Field label="Verkooptarief (per uur)" htmlFor="chargeRate" required error={e.chargeRate}>
              <Input
                id="chargeRate"
                name="chargeRate"
                type="number"
                step="0.01"
                min={0}
                defaultValue={placement?.chargeRate ?? ""}
                onChange={(ev) => setChargeRate(Number(ev.target.value) || 0)}
                required
              />
            </Field>
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
              Marge
            </p>
            <p className="mt-1 text-lg font-bold text-emerald-700">
              {formatCurrency(marginPerHour)}/uur{" "}
              <span className="text-sm font-medium text-emerald-600">
                ({marginPct.toFixed(1)}%)
              </span>
            </p>
          </div>

          <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-4">
            <p className="text-sm font-semibold text-ink-700">
              Toeslagen &amp; kilometervergoeding
            </p>
            <p className="mt-1 text-xs text-ink-400">
              Per persoon. <span className="font-medium text-ink-500">Inkoop</span> ={" "}
              wat we de werknemer betalen, <span className="font-medium text-ink-500">Verkoop</span>{" "}
              = wat we de klant rekenen. Laat 0 staan als er geen toeslag geldt — het
              komt als aparte regel bovenop het basisbedrag op de factuur.
            </p>
            <div className="mt-4 space-y-3">
              <ToeslagBlock
                title="Weekendtoeslag"
                hint="Extra percentage op de zaterdag-/zonduren."
                buyName="weekendSurchargeBuy"
                sellName="weekendSurchargeSell"
                buyDefault={placement?.weekendSurchargeBuy ?? 0}
                sellDefault={placement?.weekendSurchargeSell ?? 0}
                suffix="%"
                step="any"
              />
              <ToeslagBlock
                title="Overurentoeslag"
                hint="Extra percentage op de overuren."
                buyName="overtimeSurchargeBuy"
                sellName="overtimeSurchargeSell"
                buyDefault={placement?.overtimeSurchargeBuy ?? 0}
                sellDefault={placement?.overtimeSurchargeSell ?? 0}
                suffix="%"
                step="any"
              />
              <ToeslagBlock
                title="Kilometervergoeding"
                hint="Vergoeding per gereden kilometer (reiskosten)."
                buyName="kmRateBuy"
                sellName="kmRateSell"
                buyDefault={placement?.kmRateBuy ?? 0}
                sellDefault={placement?.kmRateSell ?? 0}
                suffix="€/km"
                step={0.01}
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Status" htmlFor="status" required error={e.status}>
              <Select
                id="status"
                name="status"
                defaultValue={dv("status", placement?.status ?? "ACTIVE")}
              >
                {PLACEMENT_STATUSES.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Notities" htmlFor="notes" error={e.notes}>
            <Textarea id="notes" name="notes" defaultValue={placement?.notes ?? ""} />
          </Field>
        </CardContent>
        <CardFooter className="flex flex-wrap justify-end gap-2">
          <ConfirmCancel href={cancelHref} />
          {!placement && (
            <button
              type="submit"
              formAction={savePlacementDraft}
              formNoValidate
              className={buttonVariants({ variant: "outline" })}
              title="Bewaar wat je nu hebt als concept — verschijnt bovenaan bij Plaatsingen"
            >
              Bewaar als concept
            </button>
          )}
          <SubmitButton>{submitLabel}</SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}
