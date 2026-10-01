"use client";

import { useActionState } from "react";
import { AlertTriangle, CheckCircle2, Pencil } from "lucide-react";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn } from "@/lib/utils";
import { bewaarCorrecties, type CorrectieState } from "./actions";
import type { DossierInvoer } from "@/lib/facturatie-week";

// ---------------------------------------------------------------------------
// De uitgelezen waarden CORRIGEREN vóór het akkoord. Links de uren per dag,
// rechts de factuurvelden — in één formulier, met één knop, zodat de controles
// daarna in één keer opnieuw over álles heen gaan.
//
// Dit legt niets vast: de uren gaan naar het concept-vangnet van de scan en de
// factuurvelden naar de nog niet goedgekeurde ontvangen factuur. Een al
// vastgelegde week is niet meer te corrigeren — dan staat het formulier op slot
// en wijst het naar "Verwijderen & opnieuw".
// ---------------------------------------------------------------------------

export function CorrectieFormulier({
  placementId,
  week,
  invoer,
  dagen,
  isZZP,
  heeftFactuur,
  vergrendeld,
}: {
  placementId: string;
  week: string;
  invoer: DossierInvoer;
  dagen: { iso: string; label: string; weekend: boolean }[];
  isZZP: boolean;
  heeftFactuur: boolean;
  /** Week al vastgelegd → alleen lezen. */
  vergrendeld: boolean;
}) {
  const [state, action] = useActionState<CorrectieState, FormData>(bewaarCorrecties, {});

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="placementId" value={placementId} />
      <input type="hidden" name="week" value={week} />

      <div>
        <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">
          Uren per dag (uit de urenstaat)
        </p>
        <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7">
          {dagen.map((dag, i) => (
            <label
              key={dag.iso}
              className={cn(
                "rounded-md border px-1 pb-0.5 pt-1 text-center",
                dag.weekend ? "border-ink-200 bg-ink-50" : "border-ink-200 bg-white",
              )}
            >
              <span className="block text-[11px] font-semibold uppercase text-ink-400">
                {dag.label}
              </span>
              <Input
                name={`uren_${i}`}
                type="text"
                inputMode="decimal"
                defaultValue={invoer.dagUren[i]}
                disabled={vergrendeld}
                aria-label={`Uren ${dag.label} ${dag.iso}`}
                className="h-7 border-0 bg-transparent px-1 py-0 text-center tabular-nums shadow-none focus:ring-0"
              />
            </label>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:max-w-sm">
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink-600">Overuren</span>
            <Input
              name="overuren"
              type="text"
              inputMode="decimal"
              defaultValue={invoer.overuren}
              disabled={vergrendeld}
              placeholder="0"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[13px] font-medium text-ink-600">Kilometers</span>
            <Input
              name="kilometers"
              type="text"
              inputMode="decimal"
              defaultValue={invoer.kilometers}
              disabled={vergrendeld}
              placeholder="0"
            />
          </label>
        </div>
      </div>

      {isZZP && (
        <div>
          <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-ink-400">
            Gegevens van zijn factuur
          </p>
          {!heeftFactuur ? (
            <p className="rounded-sm border border-dashed border-ink-200 bg-ink-50/40 px-3 py-2 text-[13px] text-ink-500">
              Er is nog geen factuur geregistreerd voor deze week. Voeg hem toe op het
              weekoverzicht; daarna zijn de velden hier te corrigeren.
            </p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 2xl:grid-cols-3">
              <Veld label="Factuurnummer" name="factuurNummer" value={invoer.factuurNummer} disabled={vergrendeld} />
              <Veld label="Factuurdatum" name="factuurDatum" value={invoer.factuurDatum} type="date" disabled={vergrendeld} />
              <Veld label="Periode van" name="factuurPeriodeStart" value={invoer.factuurPeriodeStart} type="date" disabled={vergrendeld} />
              <Veld label="Periode t/m" name="factuurPeriodeEind" value={invoer.factuurPeriodeEind} type="date" disabled={vergrendeld} />
              <Veld label="Uren op de factuur" name="factuurUren" value={invoer.factuurUren} disabled={vergrendeld} />
              <Veld label="Uurtarief (€)" name="factuurTarief" value={invoer.factuurTarief} disabled={vergrendeld} />
              <Veld label="Overuren op de factuur" name="factuurOveruren" value={invoer.factuurOveruren} disabled={vergrendeld} />
              <Veld label="Kilometers op de factuur" name="factuurKilometers" value={invoer.factuurKilometers} disabled={vergrendeld} />
              <Veld label="Totaalbedrag incl. btw (€)" name="factuurBedrag" value={invoer.factuurBedrag} disabled={vergrendeld} />
              <Veld label="Btw-bedrag (€)" name="factuurBtw" value={invoer.factuurBtw} disabled={vergrendeld} />
            </div>
          )}
        </div>
      )}

      {!vergrendeld && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-ink-400">
            Opslaan legt niets vast — het draait alleen de controles opnieuw.
          </p>
          <SubmitButton variant="outline" size="sm" pendingLabel="Opnieuw controleren…">
            <Pencil className="h-3.5 w-3.5" /> Opslaan &amp; opnieuw controleren
          </SubmitButton>
        </div>
      )}

      {state.melding && (
        <p className="flex items-start gap-2 rounded-sm border border-emerald-200 bg-emerald-50 px-3 py-2 text-[13px] text-emerald-800">
          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {state.melding}
        </p>
      )}
      {state.error && (
        <p className="flex items-start gap-2 rounded-sm border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {state.error}
        </p>
      )}
    </form>
  );
}

function Veld({
  label,
  name,
  value,
  type = "text",
  disabled,
}: {
  label: string;
  name: string;
  value: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] font-medium text-ink-600">{label}</span>
      <Input
        name={name}
        type={type}
        inputMode={type === "text" ? "text" : undefined}
        defaultValue={value}
        disabled={disabled}
      />
    </label>
  );
}
