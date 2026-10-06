"use client";

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type KeyboardEvent,
} from "react";
import type { Placement } from "@prisma/client";
import {
  FileText,
  FileSignature,
  GraduationCap,
  Upload,
  Plus,
  X,
  Building2,
  Loader2,
  AlertTriangle,
  UserRound,
  Coins,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Field, Input, Select, Textarea, Label } from "@/components/ui/field";
import { DateInput } from "@/components/ui/date-input";
import { SearchSelect } from "@/components/ui/search-select";
import { NumberInput } from "@/components/ui/number-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmCancel } from "@/components/confirm-cancel";
import { FolderTab, FolderTabBar } from "@/components/dossier-tabs";
import {
  PLACEMENT_STATUSES,
  DISCIPLINES,
  EMPLOYMENT_TYPES,
} from "@/lib/domain";
import { cn, formatCurrency } from "@/lib/utils";
import { emptyFormState, type FormState } from "@/lib/form";
import { quickCreateClient } from "../klanten/actions";
import { savePlacementDraft } from "./actions";
import { WerknemerCvIntake } from "./WerknemerCvIntake";

/** A clean upload card: icon + label + a styled picker + the chosen file(s). */
/** Eén genummerd blok van het formulier. */
type Tab = "bestanden" | "werknemer" | "bedrijf" | "documenten" | "plaatsing";

/** Waar staat een veld (voor fouten van de server)? Onbekend = Plaatsing & tarief. */
const VELD_TAB: Record<string, Tab> = {
  consultantId: "werknemer",
  bill_email: "werknemer",
  firstName: "werknemer",
  lastName: "werknemer",
  dateOfBirth: "werknemer",
  discipline: "werknemer",
  employmentType: "werknemer",
  email: "werknemer",
  phone: "werknemer",
  bsn: "werknemer",
  nationality: "werknemer",
  companyName: "bedrijf",
  kvkNumber: "bedrijf",
  vatNumber: "bedrijf",
  iban: "bedrijf",
  address: "bedrijf",
  postalCode: "bedrijf",
  city: "bedrijf",
};

const VOLGENDE: Record<Tab, Tab> = {
  bestanden: "werknemer",
  werknemer: "bedrijf",
  bedrijf: "documenten",
  documenten: "plaatsing",
  plaatsing: "plaatsing",
};

/** Huidig mapje, gedeeld met de secties (alleen het actieve is zichtbaar). */
const TabContext = createContext<Tab>("werknemer");

function Sectie({
  nr,
  titel,
  sub,
  tab,
  children,
}: {
  nr: number;
  titel: string;
  sub?: string;
  tab: Tab;
  children: ReactNode;
}) {
  // Verborgen, niet weg: alle velden blijven in het ene formulier en gaan mee bij opslaan.
  const actief = useContext(TabContext) === tab;
  return (
    <Card className={actief ? undefined : "hidden"} data-tab={tab}>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 border-b border-ink-100 pb-3">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-ink-900 text-[13px] font-semibold text-white">
            {nr}
          </span>
          <div>
            <h2 className="text-[15px] font-semibold text-ink-900">{titel}</h2>
            {sub && <p className="text-xs text-ink-400">{sub}</p>}
          </div>
        </div>
        {children}
      </CardContent>
    </Card>
  );
}

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
        {files.length > 0
          ? "Wijzigen"
          : multiple
            ? "Bestanden kiezen"
            : "Bestand kiezen"}
      </label>
      <input
        id={id}
        type="file"
        name={name}
        multiple={multiple}
        aria-label={label}
        className="sr-only"
        onChange={(ev) =>
          setFiles(Array.from(ev.target.files ?? []).map((f) => f.name))
        }
      />
      {files.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center gap-1.5 text-xs text-ink-600"
            >
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

/** Kolommen van de toeslagentabel: naam | inkoop | doorrekenen | verkoop. */
const TOESLAG_GRID =
  "grid grid-cols-1 gap-2 px-3 py-2.5 sm:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_6.5rem_minmax(0,1fr)] sm:items-center sm:gap-3";

/** Getal met eenheid (%, €/u, €/km) rechts in het veld. Label optioneel. */
function ToeslagField({
  label,
  name,
  def,
  suffix,
  step,
  disabled,
}: {
  label?: string;
  name: string;
  def: number;
  suffix: string;
  step: number | string;
  disabled?: boolean;
}) {
  return (
    <label className={cn("block min-w-0 flex-1", disabled && "opacity-60")}>
      {label && (
        <span className="mb-1 block text-xs font-medium text-ink-500">
          {label}
        </span>
      )}
      <div className="relative">
        <NumberInput
          name={name}
          min={0}
          disabled={disabled}
          step={step}
          defaultValue={def || ""}
          placeholder="0"
          className="h-9 pr-12 text-right tabular-nums"
          aria-label={`${label || name} (${suffix})`}
        />
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">
          {suffix}
        </span>
      </div>
    </label>
  );
}

/** Kopregel boven de toeslagentabel (alleen op brede schermen). */
function ToeslagKop() {
  return (
    <div
      className={cn(
        TOESLAG_GRID,
        "hidden border-b border-ink-200 bg-ink-50/60 py-2 text-[11px] font-semibold uppercase tracking-wide text-ink-500 sm:grid",
      )}
    >
      <span>Toeslag</span>
      <span>Inkoop — wij betalen</span>
      <span>Klant betaalt?</span>
      <span>Verkoop — klant</span>
    </div>
  );
}

/**
 * Rekenen we deze toeslag door aan de klant? Uit = verkoop 0: wij betalen hem,
 * het gaat van de marge af (en hij komt niet op de verkoopfactuur).
 */
function Doorrekenen({
  aan,
  onChange,
  label,
}: {
  aan: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={aan}
      aria-label={`${label}: doorrekenen aan klant`}
      onClick={() => onChange(!aan)}
      className="inline-flex items-center gap-2 text-xs font-medium text-ink-600"
    >
      <span
        className={cn(
          "relative h-5 w-9 rounded-full transition-colors",
          aan ? "bg-ink-900" : "bg-ink-200",
        )}
      >
        <span
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
            aan ? "left-[18px]" : "left-0.5",
          )}
        />
      </span>
      {aan ? "Ja" : "Nee"}
    </button>
  );
}

function NietDoor({ name, tekst }: { name: string; tekst?: string }) {
  return (
    <div className="flex h-9 items-center rounded-md border border-dashed border-amber-300 bg-amber-50 px-3 text-xs text-amber-800">
      <input type="hidden" name={name} value={0} />
      <span className="truncate" title={tekst}>
        {tekst ? tekst : "Wij betalen — uit de marge"}
      </span>
    </div>
  );
}

/** Icoon-schakelaar %/€ per veld — compact, alleen de tekens. */
function UnitSchakelaar({
  unit,
  onChange,
  label,
}: {
  unit: "PCT" | "FIXED";
  onChange: (u: "PCT" | "FIXED") => void;
  label: string;
}) {
  const tab = (active: boolean) =>
    cn(
      "flex h-9 w-8 items-center justify-center text-xs font-semibold transition-colors",
      active
        ? "bg-ink-900 text-white"
        : "bg-white text-ink-400 hover:text-ink-700",
    );
  return (
    <div
      role="group"
      aria-label={`${label}: percentage of vast tarief`}
      className="inline-flex shrink-0 overflow-hidden rounded-md border border-ink-200"
    >
      <button
        type="button"
        onClick={() => onChange("PCT")}
        aria-pressed={unit === "PCT"}
        title="Percentage (%)"
        aria-label="Percentage"
        className={cn(tab(unit === "PCT"), "border-r border-ink-200")}
      >
        %
      </button>
      <button
        type="button"
        onClick={() => onChange("FIXED")}
        aria-pressed={unit === "FIXED"}
        title="Vast tarief (€ per uur)"
        aria-label="Vast tarief per uur"
        className={tab(unit === "FIXED")}
      >
        €
      </button>
    </div>
  );
}

/** Naamcel: titel + korte uitleg, optioneel met aan/uit-vinkje. */
function ToeslagNaam({
  title,
  hint,
  toggle,
}: {
  title: string;
  hint: string;
  toggle?: { name?: string; aan: boolean; set: (v: boolean) => void };
}) {
  return (
    <div className="min-w-0">
      {toggle ? (
        <label className="flex cursor-pointer items-center gap-2">
          <input
            type="checkbox"
            name={toggle.name}
            checked={toggle.aan}
            onChange={(ev) => toggle.set(ev.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30"
          />
          <span className="text-sm font-medium text-ink-900">{title}</span>
        </label>
      ) : (
        <p className="text-sm font-medium text-ink-900">{title}</p>
      )}
      <p className="truncate text-xs text-ink-400" title={hint}>
        {hint}
      </p>
    </div>
  );
}

/** Overuren-tarief / kilometers: één rij met vaste eenheid. */
function ToeslagBlock({
  title,
  hint,
  buyName,
  sellName,
  buyDefault,
  sellDefault,
  suffix,
  step,
  nietDoorTekst,
  standaardAan,
}: {
  title: string;
  hint: string;
  buyName: string;
  sellName: string;
  buyDefault: number;
  sellDefault: number;
  suffix: string;
  step: number | string;
  nietDoorTekst?: string;
  /** Standaard aangevinkt (staat klaar), uit te vinken. */
  standaardAan?: boolean;
}) {
  const [door, setDoor] = useState(sellDefault > 0 || buyDefault === 0);
  // Uitgevinkt = geldt niet: beide bedragen gaan als 0 mee.
  const [aan, setAan] = useState(
    standaardAan || buyDefault > 0 || sellDefault > 0,
  );
  return (
    <div className={cn(TOESLAG_GRID, !aan && "bg-ink-50/40")}>
      <ToeslagNaam
        title={title}
        hint={aan ? hint : "Uit — vink aan als het geldt"}
        toggle={{ aan, set: setAan }}
      />
      {!aan ? (
        <>
          <input type="hidden" name={buyName} value={0} />
          <input type="hidden" name={sellName} value={0} />
          <span className="hidden text-xs italic text-ink-300 sm:col-span-3 sm:block">
            Niet van toepassing
          </span>
        </>
      ) : (
        <>
          <ToeslagField
            name={buyName}
            def={buyDefault}
            suffix={suffix}
            step={step}
            label=""
          />
          <Doorrekenen aan={door} onChange={setDoor} label={title} />
          {door ? (
            <ToeslagField
              name={sellName}
              def={sellDefault}
              suffix={suffix}
              step={step}
              label=""
            />
          ) : (
            <NietDoor name={sellName} tekst={nietDoorTekst} />
          )}
        </>
      )}
    </div>
  );
}

/**
 * Eén toeslag als tabelrij: per zijde een %/€-schakelaar (gaat als verborgen
 * `…SurchargeUnit` mee) en een "klant betaalt?"-schakelaar.
 *
 * Doordeweeks/zaterdag/zondag volgen uit de datums op de urenstaat. Offshore,
 * ploegendienst en buitenland krijgen een AAN/UIT-vinkje: aan = geldt over ALLE
 * gewerkte reguliere uren. Uit = bedragen blijven bewaard (verborgen velden).
 */
function ToeslagRow({
  title,
  hint,
  prefix,
  buyDefault,
  sellDefault,
  unitDefault,
  sellUnitDefault,
  toggle,
  standaardAan,
}: {
  title: string;
  hint: string;
  /** Veldnaam-voorvoegsel: "saturday" → saturdaySurchargeBuy/Sell/Unit. */
  prefix: string;
  buyDefault: number;
  sellDefault: number;
  unitDefault: string;
  sellUnitDefault: string;
  /** Offshore/ploegendienst/buitenland: eigen aan/uit-veld (bedragen blijven bewaard). */
  toggle?: { name: string; defaultOn: boolean };
  /** Standaard aangevinkt (staat klaar), uit te vinken. */
  standaardAan?: boolean;
}) {
  const [buyUnit, setBuyUnit] = useState<"PCT" | "FIXED">(
    unitDefault === "FIXED" ? "FIXED" : "PCT",
  );
  const [sellUnit, setSellUnit] = useState<"PCT" | "FIXED">(
    sellUnitDefault === "FIXED" ? "FIXED" : "PCT",
  );
  // Zonder eigen veld (meeruren, zaterdag, zondag): uitgevinkt = 0 = geldt niet.
  const [aan, setAan] = useState(
    standaardAan || (toggle?.defaultOn ?? (buyDefault > 0 || sellDefault > 0)),
  );
  const [door, setDoor] = useState(sellDefault > 0 || buyDefault === 0);
  const uit = !aan;
  const buyName = `${prefix}SurchargeBuy`;
  const sellName = `${prefix}SurchargeSell`;
  const unitInfo = (u: "PCT" | "FIXED") =>
    u === "PCT"
      ? { suffix: "%", step: "any" as const }
      : { suffix: "€/u", step: 0.01 };

  return (
    <div className={cn(TOESLAG_GRID, uit && "bg-ink-50/40")}>
      <ToeslagNaam
        title={title}
        hint={uit ? "Uit — vink aan als het geldt" : hint}
        toggle={{ name: toggle?.name, aan, set: setAan }}
      />
      {/* De schakelaars reizen als verborgen velden mee (per zijde). */}
      <input type="hidden" name={`${prefix}SurchargeUnit`} value={buyUnit} />
      <input
        type="hidden"
        name={`${prefix}SurchargeSellUnit`}
        value={sellUnit}
      />

      {uit ? (
        // Uitgevinkt: de bedragen blijven bewaard, maar zijn niet te bewerken.
        <>
          <input type="hidden" name={buyName} value={toggle ? buyDefault : 0} />
          <input
            type="hidden"
            name={sellName}
            value={toggle ? sellDefault : 0}
          />
          <span className="hidden text-xs italic text-ink-300 sm:col-span-3 sm:block">
            Niet van toepassing
          </span>
        </>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <UnitSchakelaar
              unit={buyUnit}
              onChange={setBuyUnit}
              label={`${title} inkoop`}
            />
            <ToeslagField
              name={buyName}
              def={buyDefault}
              {...unitInfo(buyUnit)}
              label=""
            />
          </div>
          <Doorrekenen aan={door} onChange={setDoor} label={title} />
          {door ? (
            <div className="flex items-center gap-1.5">
              <UnitSchakelaar
                unit={sellUnit}
                onChange={setSellUnit}
                label={`${title} verkoop`}
              />
              <ToeslagField
                name={sellName}
                def={sellDefault}
                {...unitInfo(sellUnit)}
                label=""
              />
            </div>
          ) : (
            <NietDoor name={sellName} />
          )}
        </>
      )}
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
          Klant{" "}
          <span className="font-normal text-ink-400">
            — wie de factuur krijgt (bij inhuur via een partij: die partij,
            bijv. IMG Tech)
          </span>
        </Label>
        <button
          type="button"
          onClick={() => {
            setErr(null);
            setOpen((o) => !o);
          }}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-50"
        >
          {open ? (
            <X className="h-3.5 w-3.5" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
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
            <strong>Geen bedrijf gekoppeld.</strong> Je kunt deze plaatsing
            gewoon opslaan, maar er kan pas een verkoopfactuur gemaakt worden
            zodra je een klant koppelt. Voeg het bedrijf later toe door de
            plaatsing te bewerken.
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
              <p className="text-sm font-semibold text-ink-800">
                Nieuw bedrijf toevoegen
              </p>
              <p className="text-xs text-ink-500">
                Vul in wat je hebt — later aanvullen of wijzigen kan altijd op
                de klantpagina.
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
  contractEinde,
  billing,
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
  /** Einddatum uit het (nieuwste) contract van deze persoon, om over te nemen. */
  contractEinde?: { datum: string; label: string } | null;
  /** Bewerken: factuur- & betaalgegevens van de huidige werknemer. */
  billing?: Record<
    | "companyName"
    | "iban"
    | "kvkNumber"
    | "vatNumber"
    | "email"
    | "phone"
    | "address"
    | "postalCode"
    | "city",
    string | null
  > | null;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};
  const [tab, setTab] = useState<Tab>(placement ? "werknemer" : "bestanden");
  const [eerderState, setEerderState] = useState(state);
  // Server keurt een veld af → spring naar het mapje waar dat veld staat.
  if (state !== eerderState) {
    setEerderState(state);
    const eersteFout = Object.keys(state.fieldErrors ?? {})[0];
    if (eersteFout) setTab(VELD_TAB[eersteFout] ?? "plaatsing");
  }
  const dv = (name: string, fallback = "") => draft?.[name] ?? fallback;
  const [allIn, setAllIn] = useState(
    draft ? draft.allIn === "on" : (placement?.allIn ?? false),
  );

  // Create mode only: fill in a new person inline (default) or pick an existing one.
  const [personMode, setPersonMode] = useState<"existing" | "new">(
    draft?.personMode === "existing" ? "existing" : "new",
  );

  // Mirror the rate inputs into state purely to render a live margin panel.
  const [costRate, setCostRate] = useState<number>(
    draft?.costRate ? Number(draft.costRate) || 0 : (placement?.costRate ?? 0),
  );
  const [chargeRate, setChargeRate] = useState<number>(
    draft?.chargeRate
      ? Number(draft.chargeRate) || 0
      : (placement?.chargeRate ?? 0),
  );
  const [rateUnit, setRateUnit] = useState<string>(
    draft?.rateUnit === "DAY"
      ? "DAY"
      : placement?.rateUnit === "DAY"
        ? "DAY"
        : "HOUR",
  );
  const eenheid = rateUnit === "DAY" ? "dag" : "uur";

  // Start/eind gecontroleerd, zodat de snelle duur-knoppen de einddatum kunnen zetten.
  const [startDate, setStartDate] = useState<string>(
    draft?.startDate ??
      (placement?.startDate
        ? new Date(placement.startDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)),
  );
  const [endDate, setEndDate] = useState<string>(
    draft?.endDate ??
      (placement?.endDate
        ? new Date(placement.endDate).toISOString().slice(0, 10)
        : ""),
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
          (el instanceof HTMLInputElement &&
            el.type !== "hidden" &&
            el.type !== "file") ||
          el instanceof HTMLTextAreaElement;
        if (
          isField &&
          (el as HTMLInputElement | HTMLTextAreaElement).value !== value
        ) {
          (el as HTMLInputElement | HTMLTextAreaElement).value = value;
          el.dispatchEvent(new Event("input", { bubbles: true }));
        }
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The werknemer of an existing plaatsing is fixed and cannot be changed here.
  const currentPerson = placement
    ? consultants.find((c) => c.id === placement.consultantId)
    : undefined;
  const currentPersonName = currentPerson
    ? `${currentPerson.firstName} ${currentPerson.lastName}`
    : "Onbekende werknemer";

  const marginPerHour = chargeRate - costRate;
  const marginPct =
    chargeRate > 0 ? ((chargeRate - costRate) / chargeRate) * 100 : 0;

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

      {state.error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}

      {/* Mapjes: zelfde look als de dossiers. Een veld dat de browser afkeurt
          springt naar zijn eigen mapje (onInvalidCapture). */}
      <TabContext.Provider value={tab}>
        <FolderTabBar label="Plaatsing">
          {(placement || personMode === "existing"
            ? ([
                [
                  "werknemer",
                  "Werknemer",
                  <UserRound key="i" className="h-4 w-4" />,
                ],
                [
                  "plaatsing",
                  "Plaatsing & tarief",
                  <Coins key="i" className="h-4 w-4" />,
                ],
              ] as const)
            : ([
                [
                  "bestanden",
                  "Bestanden uitlezen",
                  <Sparkles key="i" className="h-4 w-4" />,
                ],
                [
                  "werknemer",
                  "Werknemer",
                  <UserRound key="i" className="h-4 w-4" />,
                ],
                [
                  "bedrijf",
                  "Bedrijf ZZP",
                  <Building2 key="i" className="h-4 w-4" />,
                ],
                [
                  "documenten",
                  "Documenten",
                  <FileText key="i" className="h-4 w-4" />,
                ],
                [
                  "plaatsing",
                  "Plaatsing & tarief",
                  <Coins key="i" className="h-4 w-4" />,
                ],
              ] as const)
          ).map(([key, label, icon]) => (
            <FolderTab
              key={key}
              icon={icon}
              label={label}
              active={tab === key}
              onClick={() => setTab(key)}
            />
          ))}
        </FolderTabBar>

        <div
          className="space-y-4 pt-4"
          onInvalidCapture={(ev) => {
            const t = (ev.target as HTMLElement)
              .closest("[data-tab]")
              ?.getAttribute("data-tab") as Tab | null;
            if (t && t !== tab) setTab(t);
          }}
        >
          {/* 1. Eerst de bestanden: de AI vult de rest zoveel mogelijk in. */}
          {!placement && personMode === "new" && (
            <Sectie
              tab="bestanden"
              nr={1}
              titel="Bestanden uitlezen"
              sub="Begin hier — sleep het CV erin, de AI vult de gegevens hieronder in."
            >
              <WerknemerCvIntake />
            </Sectie>
          )}

          <Sectie
            tab="werknemer"
            nr={placement ? 1 : 2}
            titel="Werknemer"
            sub={placement ? undefined : "Wie gaan we plaatsen?"}
          >
            {placement ? (
              <div className="space-y-6">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field
                    label="Werknemer"
                    htmlFor="consultantId"
                    required
                    error={e.consultantId}
                  >
                    <SearchSelect
                      id="consultantId"
                      name="consultantId"
                      defaultValue={placement.consultantId}
                      options={consultants.map((c) => ({
                        value: c.id,
                        label: `${c.firstName} ${c.lastName}`,
                      }))}
                      placeholder="Typ een naam om te zoeken…"
                      emptyText="Geen werknemer gevonden."
                    />
                  </Field>
                  <ClientPicker
                    initialClients={clients}
                    initialClientId={placement.clientId}
                    error={e.clientId}
                  />
                </div>
                {billing && (
                  <div className="space-y-3 border-t border-ink-100 pt-5">
                    <div>
                      <p className="text-sm font-semibold text-ink-900">
                        Factuur- &amp; betaalgegevens {currentPersonName}
                      </p>
                      <p className="text-xs text-ink-400">
                        Voor de inkoopfactuur. Hoort bij de persoon en geldt
                        voor al zijn plaatsingen. Kies je hierboven een andere
                        werknemer, dan blijven deze gegevens bij{" "}
                        {currentPersonName}.
                      </p>
                    </div>
                    {/* bill_-voorvoegsel: geen botsing met de klant-/persoonvelden in dit formulier. */}
                    <input
                      type="hidden"
                      name="bill_consultantId"
                      value={placement.consultantId}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <Field label="Bedrijfsnaam" htmlFor="bill_companyName">
                        <Input
                          id="bill_companyName"
                          name="bill_companyName"
                          defaultValue={billing["companyName"] ?? ""}
                        />
                      </Field>
                      <Field label="IBAN" htmlFor="bill_iban">
                        <Input
                          id="bill_iban"
                          name="bill_iban"
                          defaultValue={billing["iban"] ?? ""}
                        />
                      </Field>
                      <Field label="KvK-nummer" htmlFor="bill_kvkNumber">
                        <Input
                          id="bill_kvkNumber"
                          name="bill_kvkNumber"
                          defaultValue={billing["kvkNumber"] ?? ""}
                        />
                      </Field>
                      <Field label="BTW-nummer" htmlFor="bill_vatNumber">
                        <Input
                          id="bill_vatNumber"
                          name="bill_vatNumber"
                          defaultValue={billing["vatNumber"] ?? ""}
                        />
                      </Field>
                      <Field
                        label="E-mail"
                        htmlFor="bill_email"
                        error={e.bill_email}
                      >
                        <Input
                          id="bill_email"
                          name="bill_email"
                          type="email"
                          defaultValue={billing["email"] ?? ""}
                        />
                      </Field>
                      <Field label="Telefoon" htmlFor="bill_phone">
                        <Input
                          id="bill_phone"
                          name="bill_phone"
                          defaultValue={billing["phone"] ?? ""}
                        />
                      </Field>
                      <Field label="Adres" htmlFor="bill_address">
                        <Input
                          id="bill_address"
                          name="bill_address"
                          defaultValue={billing["address"] ?? ""}
                        />
                      </Field>
                      <Field label="Postcode" htmlFor="bill_postalCode">
                        <Input
                          id="bill_postalCode"
                          name="bill_postalCode"
                          defaultValue={billing["postalCode"] ?? ""}
                        />
                      </Field>
                      <Field label="Plaats" htmlFor="bill_city">
                        <Input
                          id="bill_city"
                          name="bill_city"
                          defaultValue={billing["city"] ?? ""}
                        />
                      </Field>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4">
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
                  <Field
                    label="Kies werknemer"
                    htmlFor="consultantId"
                    required
                    error={e.consultantId}
                    hint="Dezelfde persoon mag meerdere plaatsingen tegelijk hebben — bijv. bij verschillende bedrijven. Kies 'm hier gewoon opnieuw voor een extra plaatsing."
                  >
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
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Field
                      label="Voornaam"
                      htmlFor="firstName"
                      required
                      error={e.firstName}
                    >
                      <Input id="firstName" name="firstName" required />
                    </Field>
                    <Field
                      label="Achternaam"
                      htmlFor="lastName"
                      required
                      error={e.lastName}
                    >
                      <Input id="lastName" name="lastName" required />
                    </Field>
                    <Field
                      label="Geboortedatum"
                      htmlFor="dateOfBirth"
                      error={e.dateOfBirth}
                    >
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
                    <Field
                      label="Dienstverband"
                      htmlFor="employmentType"
                      error={e.employmentType}
                    >
                      <Select
                        id="employmentType"
                        name="employmentType"
                        defaultValue={dv("employmentType", "ZZP")}
                      >
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
                    <Field
                      label="Nationaliteit"
                      htmlFor="nationality"
                      error={e.nationality}
                    >
                      <Input id="nationality" name="nationality" />
                    </Field>
                  </div>
                )}
              </div>
            )}
          </Sectie>

          {!placement && personMode === "new" && (
            <>
              <Sectie
                tab="bedrijf"
                nr={3}
                titel="Bedrijfsgegevens ZZP"
                sub="Voor de inkoopfactuur en de betaling — leeg laten bij loondienst."
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Bedrijfsnaam"
                    htmlFor="p-companyName"
                    error={e.companyName}
                  >
                    <Input
                      id="p-companyName"
                      name="companyName"
                      placeholder="Bijv. Balder Quality Service"
                    />
                  </Field>
                  <Field label="KvK-nummer" htmlFor="p-kvk" error={e.kvkNumber}>
                    <Input
                      id="p-kvk"
                      name="kvkNumber"
                      placeholder="8 cijfers"
                    />
                  </Field>
                  <Field label="BTW-nummer" htmlFor="p-vat" error={e.vatNumber}>
                    <Input
                      id="p-vat"
                      name="vatNumber"
                      placeholder="NL000000000B00"
                    />
                  </Field>
                  <Field label="IBAN" htmlFor="p-iban" error={e.iban}>
                    <Input
                      id="p-iban"
                      name="iban"
                      placeholder="NL00 BANK 0000 0000 00"
                    />
                  </Field>
                  <Field label="Adres" htmlFor="p-address" error={e.address}>
                    <Input
                      id="p-address"
                      name="address"
                      placeholder="Straat en huisnummer"
                      autoComplete="off"
                    />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field
                      label="Postcode"
                      htmlFor="p-postalCode"
                      error={e.postalCode}
                    >
                      <Input
                        id="p-postalCode"
                        name="postalCode"
                        placeholder="1234 AB"
                      />
                    </Field>
                    <Field label="Plaats" htmlFor="p-city" error={e.city}>
                      <Input id="p-city" name="city" />
                    </Field>
                  </div>
                </div>
              </Sectie>

              <Sectie
                tab="documenten"
                nr={4}
                titel="Documenten"
                sub="Optioneel — kan ook later in het dossier."
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  <UploadCard
                    id="cvFile"
                    name="cvFile"
                    label="CV"
                    hint="Automatisch gevuld via 'CV inlezen' hierboven"
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
              </Sectie>
            </>
          )}

          <Sectie
            tab="plaatsing"
            nr={placement ? 2 : 5}
            titel="Plaatsing & tarief"
            sub="Bij welke klant, vanaf wanneer en tegen welk tarief."
          >
            <div className="space-y-5">
              {!placement && (
                <ClientPicker
                  initialClients={clients}
                  initialClientId={dv("clientId")}
                  error={e.clientId}
                />
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Functie" htmlFor="title" required error={e.title}>
                  <Input
                    id="title"
                    name="title"
                    defaultValue={placement?.title ?? ""}
                    placeholder="Bijv. NDT Inspector Level 2"
                    required
                  />
                </Field>
                <Field
                  label="PO-nummer klant"
                  htmlFor="poNumber"
                  error={e.poNumber}
                  hint="Optioneel — komt als “PO” op de verkoopfactuur."
                >
                  <Input
                    id="poNumber"
                    name="poNumber"
                    defaultValue={placement?.poNumber ?? ""}
                    placeholder="Bijv. 4500123456"
                  />
                </Field>
                <Field
                  label="Werklocatie / eindklant"
                  htmlFor="workLocation"
                  hint="Waar hij écht werkt (bijv. “LyondellBasell via KWR”). Alleen info op de factuur (kolom LOCATIE) — de factuur gaat altijd naar de Klant hierboven."
                  className="sm:col-span-2"
                >
                  <Input
                    id="workLocation"
                    name="workLocation"
                    defaultValue={placement?.workLocation ?? ""}
                    placeholder="Bijv. LyondellBasell Moerdijk via KWR"
                  />
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Startdatum"
                  htmlFor="startDate"
                  required
                  error={e.startDate}
                >
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
                  error={e.endDate}
                  hint="Leeg laten als de plaatsing nog loopt"
                >
                  <DateInput
                    id="endDate"
                    name="endDate"
                    value={endDate}
                    onValueChange={setEndDate}
                  />
                  {contractEinde && contractEinde.datum !== endDate && (
                    <button
                      type="button"
                      onClick={() => setEndDate(contractEinde.datum)}
                      className="mt-1 text-xs font-medium text-brand-700 underline underline-offset-2 hover:text-ink-900"
                    >
                      Overnemen uit contract {contractEinde.label} (
                      {contractEinde.datum.split("-").reverse().join("-")})
                    </button>
                  )}
                </Field>
              </div>

              {/* Basistarief + marge op één regel. */}
              <div className="rounded-lg border border-ink-200">
                <div className="grid gap-4 p-3 sm:grid-cols-[9rem_1fr_1fr_11rem] sm:items-end">
                  <Field label="Tarief per" htmlFor="rateUnit">
                    <Select
                      id="rateUnit"
                      name="rateUnit"
                      defaultValue={rateUnit}
                      onValueChange={setRateUnit}
                    >
                      <option value="HOUR">Uur</option>
                      <option value="DAY">Dag (dayrate)</option>
                    </Select>
                  </Field>
                  <Field
                    label={`Inkoop — wij betalen (per ${eenheid})`}
                    htmlFor="costRate"
                    required
                    error={e.costRate}
                  >
                    <Input
                      id="costRate"
                      name="costRate"
                      type="number"
                      step="0.01"
                      min={0}
                      defaultValue={placement?.costRate ?? ""}
                      onChange={(ev) =>
                        setCostRate(Number(ev.target.value) || 0)
                      }
                      required
                      className="tabular-nums"
                    />
                  </Field>
                  <Field
                    label={`Verkoop — klant betaalt (per ${eenheid})`}
                    htmlFor="chargeRate"
                    required
                    error={e.chargeRate}
                  >
                    <Input
                      id="chargeRate"
                      name="chargeRate"
                      type="number"
                      step="0.01"
                      min={0}
                      defaultValue={placement?.chargeRate ?? ""}
                      onChange={(ev) =>
                        setChargeRate(Number(ev.target.value) || 0)
                      }
                      required
                      className="tabular-nums"
                    />
                  </Field>
                  <div
                    className={cn(
                      "rounded-md px-3 py-1.5",
                      marginPerHour < 0 ? "bg-red-50" : "bg-emerald-50",
                    )}
                  >
                    <p
                      className={cn(
                        "text-[11px] font-semibold uppercase tracking-wide",
                        marginPerHour < 0 ? "text-red-700" : "text-emerald-700",
                      )}
                    >
                      Marge
                    </p>
                    <p
                      className={cn(
                        "text-base font-bold tabular-nums",
                        marginPerHour < 0 ? "text-red-700" : "text-emerald-700",
                      )}
                    >
                      {formatCurrency(marginPerHour)}/{eenheid}{" "}
                      <span className="text-xs font-medium">
                        ({marginPct.toFixed(1)}%)
                      </span>
                    </p>
                  </div>
                </div>
                <label className="flex cursor-pointer items-center gap-2 border-t border-ink-100 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    name="vatReverseCharge"
                    defaultChecked={placement?.vatReverseCharge ?? false}
                    className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30"
                  />
                  <span className="font-medium text-ink-900">BTW verlegd</span>
                  <span className="text-xs text-ink-400">
                    — verkoopfactuur met 0% BTW en de verplichte vermelding
                  </span>
                </label>
              </div>

              {/* Toeslagen als één compacte tabel. */}
              <div className="overflow-hidden rounded-lg border border-ink-200">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-ink-200 px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-3">
                    <p className="text-sm font-semibold text-ink-900">
                      Toeslagen, overuren &amp; kilometers
                    </p>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md border border-ink-200 bg-white px-2.5 py-1 text-[13px] font-medium text-ink-800">
                      <input
                        type="checkbox"
                        name="allIn"
                        checked={allIn}
                        onChange={(ev) => setAllIn(ev.target.checked)}
                        className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500/30"
                      />
                      All-in tarief
                    </label>
                  </div>
                  <p className="text-xs text-ink-400">
                    Klant betaalt? Nee = wij betalen, gaat van de marge af · 0 =
                    geldt niet
                  </p>
                </div>
                <ToeslagKop />
                {allIn && (
                  <p className="border-b border-ink-100 bg-ink-50/60 px-3 py-2 text-xs text-ink-500">
                    All-in: alleen het uurtarief hierboven (inkoop → verkoop) +
                    kilometervergoeding. Geen overuren of toeslagen — die gaan
                    bij opslaan op 0.
                  </p>
                )}
                {/* Km staat altijd zichtbaar, ook bij all-in. */}
                <div className="border-b border-ink-100">
                  <ToeslagBlock
                    title="Kilometervergoeding"
                    hint="Per gereden kilometer"
                    buyName="kmRateBuy"
                    sellName="kmRateSell"
                    buyDefault={placement ? placement.kmRateBuy : 0.45}
                    sellDefault={placement ? placement.kmRateSell : 0.45}
                    suffix="€/km"
                    step={0.01}
                    standaardAan
                  />
                </div>
                <div
                  className={cn("divide-y divide-ink-100", allIn && "hidden")}
                >
                  <input type="hidden" name="weekendSurchargeBuy" value={0} />
                  <input type="hidden" name="weekendSurchargeSell" value={0} />
                  <ToeslagRow
                    title="Zaterdag"
                    standaardAan
                    hint="Uren op zaterdag"
                    prefix="saturday"
                    buyDefault={
                      placement?.saturdaySurchargeBuy ||
                      placement?.weekendSurchargeBuy ||
                      0
                    }
                    sellDefault={
                      placement?.saturdaySurchargeSell ||
                      placement?.weekendSurchargeSell ||
                      0
                    }
                    unitDefault={placement?.saturdaySurchargeUnit ?? "PCT"}
                    sellUnitDefault={
                      placement?.saturdaySurchargeSellUnit ??
                      placement?.saturdaySurchargeUnit ??
                      "PCT"
                    }
                  />
                  <ToeslagRow
                    title="Zondag & feestdag"
                    standaardAan
                    hint="Uren op zondag en feestdagen"
                    prefix="sunday"
                    buyDefault={
                      placement?.sundaySurchargeBuy ||
                      placement?.weekendSurchargeBuy ||
                      0
                    }
                    sellDefault={
                      placement?.sundaySurchargeSell ||
                      placement?.weekendSurchargeSell ||
                      0
                    }
                    unitDefault={placement?.sundaySurchargeUnit ?? "PCT"}
                    sellUnitDefault={
                      placement?.sundaySurchargeSellUnit ??
                      placement?.sundaySurchargeUnit ??
                      "PCT"
                    }
                  />
                  <ToeslagRow
                    title="Ploegendienst"
                    hint="Over alle reguliere uren"
                    prefix="shift"
                    buyDefault={
                      placement?.shiftEnabled ? placement.shiftSurchargeBuy : 0
                    }
                    sellDefault={
                      placement?.shiftEnabled ? placement.shiftSurchargeSell : 0
                    }
                    unitDefault={placement?.shiftSurchargeUnit ?? "PCT"}
                    sellUnitDefault={
                      placement?.shiftSurchargeSellUnit ??
                      placement?.shiftSurchargeUnit ??
                      "PCT"
                    }
                    toggle={{ name: "shiftEnabled", defaultOn: true }}
                    standaardAan
                  />
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2 bg-ink-50/40 px-3 py-2.5 text-sm text-ink-700">
                    <span className="font-medium text-ink-900">
                      Meeruren ma–vr
                    </span>
                    <span className="text-ink-500">vanaf</span>
                    <div className="w-28">
                      <ToeslagField
                        name="otFromHours"
                        def={placement?.otFromHours ?? 0}
                        suffix="u/dag"
                        step={0.5}
                        label=""
                      />
                    </div>
                    <span className="text-ink-500">per dag, eerste trede</span>
                    <div className="w-24">
                      <ToeslagField
                        name="ot1Hours"
                        def={placement?.ot1Hours ?? 2}
                        suffix="uur"
                        step={0.5}
                        label=""
                      />
                    </div>
                    <span className="text-xs text-ink-400">
                      Leeg = geen meeruren-toeslag · feestdag telt als zondag
                    </span>
                  </div>
                  <ToeslagRow
                    title="Meeruren · trede 1"
                    hint="Bijv. 9e & 10e uur"
                    prefix="weekday"
                    buyDefault={
                      placement?.otFromHours != null
                        ? placement.weekdaySurchargeBuy
                        : 0
                    }
                    sellDefault={
                      placement?.otFromHours != null
                        ? placement.weekdaySurchargeSell
                        : 0
                    }
                    unitDefault={placement?.weekdaySurchargeUnit ?? "PCT"}
                    sellUnitDefault={
                      placement?.weekdaySurchargeSellUnit ??
                      placement?.weekdaySurchargeUnit ??
                      "PCT"
                    }
                  />
                  <ToeslagRow
                    title="Meeruren · trede 2"
                    hint="Boven de eerste trede"
                    prefix="weekday2"
                    buyDefault={placement?.weekday2SurchargeBuy ?? 0}
                    sellDefault={placement?.weekday2SurchargeSell ?? 0}
                    unitDefault={placement?.weekday2SurchargeUnit ?? "PCT"}
                    sellUnitDefault={
                      placement?.weekday2SurchargeSellUnit ??
                      placement?.weekday2SurchargeUnit ??
                      "PCT"
                    }
                  />
                  <ToeslagRow
                    title="Offshore"
                    hint="Over alle reguliere uren"
                    prefix="offshore"
                    buyDefault={placement?.offshoreSurchargeBuy ?? 0}
                    sellDefault={placement?.offshoreSurchargeSell ?? 0}
                    unitDefault={placement?.offshoreSurchargeUnit ?? "PCT"}
                    sellUnitDefault={
                      placement?.offshoreSurchargeSellUnit ??
                      placement?.offshoreSurchargeUnit ??
                      "PCT"
                    }
                    toggle={{
                      name: "offshoreEnabled",
                      defaultOn: placement?.offshoreEnabled ?? false,
                    }}
                  />
                  <ToeslagRow
                    title="Buitenland"
                    hint="Over alle reguliere uren"
                    prefix="abroad"
                    buyDefault={placement?.abroadSurchargeBuy ?? 0}
                    sellDefault={placement?.abroadSurchargeSell ?? 0}
                    unitDefault={placement?.abroadSurchargeUnit ?? "PCT"}
                    sellUnitDefault={
                      placement?.abroadSurchargeSellUnit ??
                      placement?.abroadSurchargeUnit ??
                      "PCT"
                    }
                    toggle={{
                      name: "abroadEnabled",
                      defaultOn: placement?.abroadEnabled ?? false,
                    }}
                  />
                  {/* Overuren: een APART uurtarief (€/u) dat alléén over de losse
                  overuren-uren rekent (het aantal vul je per week in bij 'Week
                  verwerken'). Leeg = overuren tegen het normale tarief. De oude
                  percentage-velden bewaren we verborgen voor terugval. */}
                  <input
                    type="hidden"
                    name="overtimeSurchargeBuy"
                    value={placement?.overtimeSurchargeBuy ?? 0}
                  />
                  <input
                    type="hidden"
                    name="overtimeSurchargeSell"
                    value={placement?.overtimeSurchargeSell ?? 0}
                  />
                  <ToeslagBlock
                    title="Overuren-tarief"
                    hint="Vast €/u voor losse overuren · leeg = normaal tarief"
                    buyName="overtimeCostRate"
                    sellName="overtimeChargeRate"
                    buyDefault={placement?.overtimeCostRate ?? 0}
                    sellDefault={placement?.overtimeChargeRate ?? 0}
                    suffix="€/u"
                    step={0.01}
                    nietDoorTekst="Klant betaalt overuren tegen het normale tarief — het verschil betalen wij uit de marge."
                  />
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[14rem_1fr]">
                <Field
                  label="Status"
                  htmlFor="status"
                  required
                  error={e.status}
                  hint="Actief = gaat door de facturatie. Ontbreken er nog gegevens (werknemer, klant, tarieven), dan wordt het vanzelf “Nog niet actief”."
                >
                  <Select
                    id="status"
                    name="status"
                    defaultValue={dv("status", placement?.status ?? "ACTIVE")}
                  >
                    {PLACEMENT_STATUSES.filter(
                      (o) =>
                        o.value !== "ARCHIVED" ||
                        placement?.status === "ARCHIVED",
                    ).map((o) => (
                      <option
                        key={o.value}
                        value={o.value}
                        data-color={o.color}
                      >
                        {o.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Notities" htmlFor="notes" error={e.notes}>
                  <Textarea
                    id="notes"
                    name="notes"
                    rows={2}
                    defaultValue={placement?.notes ?? ""}
                  />
                </Field>
              </div>
            </div>
          </Sectie>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {tab !== "plaatsing" && (
              <button
                type="button"
                onClick={() =>
                  setTab(
                    placement || personMode === "existing"
                      ? "plaatsing"
                      : VOLGENDE[tab],
                  )
                }
                className={cn(
                  buttonVariants({ variant: "outline" }),
                  "mr-auto",
                )}
              >
                Volgende →
              </button>
            )}

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
          </div>
        </div>
      </TabContext.Provider>
    </form>
  );
}
