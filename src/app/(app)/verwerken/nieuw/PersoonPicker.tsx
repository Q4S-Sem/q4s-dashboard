"use client";

import { useMemo, useState } from "react";
import { ArrowRight, FileText, Search, Upload, UserRound, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { formatCurrency } from "@/lib/utils";
import { initialen } from "@/lib/weekverwerking";
import {
  filterPersonen,
  laatsteVerwerktLabel,
  openstaandLabel,
} from "@/lib/wizard-personen";
import { inboxSamenvatting, type WizardPersoon, type WizardTimesheet } from "./wizard-data";

// ---------------------------------------------------------------------------
// STAP "KIES DE PERSOON" — de voordeur van de wizard "Week verwerken".
//
// De eigenaar kijkt per MENS: eerst wie er voor Q4S werkt, dan pas welke week.
// Eén kaart per persoon (nooit twee keer dezelfde naam), met daaronder zijn
// actieve plaatsing(en) en de tarieven waarmee straks gerekend wordt.
//
// Puur weergave: het groeperen, ontdubbelen, sorteren en zoeken gebeurt in
// src/lib/wizard-personen.ts (getest in tests/wizard-personen.test.ts). Dit
// bestand kiest alleen wat er waar staat.
// ---------------------------------------------------------------------------

/** Kopje boven een blok — hetzelfde grijze kapitaaltje als in de wizard. */
const KOPJE = "text-[11px] font-bold uppercase tracking-wide text-ink-400";
/** Vanaf hoeveel mensen het zoekveld verschijnt (daaronder scan je gewoon). */
const ZOEK_VANAF = 6;

/** Eén tarief, klein en rechts uitgelijnd — overal even breed, dus scanbaar. */
function Tarief({ label, waarde }: { label: string; waarde: number }) {
  return (
    <span className="hidden shrink-0 text-right sm:block">
      <span className="block text-[10px] font-bold uppercase tracking-wide text-ink-400">
        {label}
      </span>
      <span className="block text-[13px] font-semibold tabular-nums text-ink-900">
        {formatCurrency(waarde)}
      </span>
    </span>
  );
}

/** Eén persoon: kop met naam/status, daaronder een regel per plaatsing. */
function PersoonKaart({
  persoon,
  onKies,
}: {
  persoon: WizardPersoon;
  onKies: (persoon: WizardPersoon, placementId: string) => void;
}) {
  const open = persoon.openstaand.length;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-ink-100 p-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-brand-600 text-[13px] font-bold text-white">
          {initialen(persoon.naam)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-ink-900">{persoon.naam}</span>
          <span className="block truncate text-xs text-ink-400">
            {persoon.klanten.join(" · ") || "geen actieve plaatsing"}
          </span>
        </span>
        <Badge color={open > 0 ? "amber" : "slate"}>{openstaandLabel(open)}</Badge>
      </div>

      <div className="divide-y divide-ink-100">
        {persoon.plaatsingen.length === 0 ? (
          // Alleen uit de inbox bekend: hij mag gewoon door, de plaatsing kiest
          // hij straks in stap 1 zelf.
          <button
            type="button"
            onClick={() => onKies(persoon, "")}
            className="group flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-brand-50/60"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold text-ink-900">
                Geen actieve plaatsing
              </span>
              <span className="block truncate text-xs text-ink-400">
                de plaatsing kies je straks zelf
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-ink-300 group-hover:text-brand-600" />
          </button>
        ) : (
          persoon.plaatsingen.map((rij) => (
            <button
              key={rij.plaatsing.id}
              type="button"
              onClick={() => onKies(persoon, rij.plaatsing.id)}
              className="group flex w-full items-center gap-3 px-3.5 py-2.5 text-left transition-colors hover:bg-brand-50/60"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink-900">
                  {rij.plaatsing.klantNaam ?? "— geen bedrijf"}
                </span>
                <span className="block truncate text-xs text-ink-400">
                  {rij.openstaand > 0
                    ? `${rij.plaatsing.functie} · ${openstaandLabel(rij.openstaand)}`
                    : rij.plaatsing.functie}
                </span>
              </span>
              <Tarief label="inkoop" waarde={rij.plaatsing.config.costRate} />
              <Tarief label="verkoop" waarde={rij.plaatsing.config.chargeRate} />
              <ArrowRight className="h-4 w-4 shrink-0 text-ink-300 group-hover:text-brand-600" />
            </button>
          ))
        )}
      </div>

      {/* mt-auto: de voetregel van elke kaart ligt op dezelfde hoogte. */}
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-ink-100 bg-ink-50/60 px-3.5 py-2 text-[11px] text-ink-400">
        <span className="truncate">{laatsteVerwerktLabel(persoon.laatsteVerwerkteWeek)}</span>
        {persoon.plaatsingen.length > 1 && (
          <span className="shrink-0">{persoon.plaatsingen.length} plaatsingen</span>
        )}
      </div>
    </Card>
  );
}

export function PersoonPicker({
  personen,
  ongekoppeld,
  onKies,
  onLosseStaat,
}: {
  /** Eén rij per persoon, al ontdubbeld en gesorteerd door bouwPersoonRijen. */
  personen: WizardPersoon[];
  /** Weekstaten waar (nog) geen persoon bij gevonden is. */
  ongekoppeld: WizardTimesheet[];
  /** Gekozen: deze persoon, deze plaatsing ("" = straks zelf kiezen). */
  onKies: (persoon: WizardPersoon, placementId: string) => void;
  /** Zonder persoon verder: uploaden (null) of een niet-herkende staat openen. */
  onLosseStaat: (item: WizardTimesheet | null) => void;
}) {
  const [zoek, setZoek] = useState("");
  const getoond = useMemo(() => filterPersonen(personen, zoek), [personen, zoek]);
  const toonZoek = personen.length >= ZOEK_VANAF;

  return (
    <Card>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink-900">
              <Users className="h-4 w-4 text-brand-600" /> Kies de persoon
            </h2>
            <p className="mt-1 max-w-3xl text-sm text-ink-500">
              Voor wie ga je verwerken? Kies hieronder de persoon en zijn plaatsing — daarna zie je
              meteen zijn weken, en loop je in drie stappen door de facturatie.
            </p>
          </div>

          {toonZoek && (
            <div className="relative w-full sm:w-72">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
              <Input
                type="search"
                value={zoek}
                onChange={(e) => setZoek(e.target.value)}
                placeholder="Zoek op naam of klant…"
                aria-label="Zoek op naam of klant"
                className="pl-9"
              />
            </div>
          )}
        </div>

        {personen.length === 0 ? (
          <EmptyState
            icon={<UserRound className="h-6 w-6" />}
            title="Nog niemand om te verwerken"
            description="Er zijn geen actieve plaatsingen en er staat niets in de timesheet-inbox. Voeg een plaatsing toe, of sleep hieronder een losse urenstaat naar binnen."
          />
        ) : getoond.length === 0 ? (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="Niemand gevonden"
            description={`Geen persoon of klant die op "${zoek.trim()}" lijkt. Pas de zoekterm aan.`}
          />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {getoond.map((p) => (
              <PersoonKaart key={p.consultantId} persoon={p} onKies={onKies} />
            ))}
          </div>
        )}

        {/* Altijd bereikbaar: uploaden zonder persoon, en de staten waar de naam
            (nog) niet herkend is — die mogen niet achter de personen verdwijnen. */}
        <div className="space-y-3 border-t border-ink-100 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className={KOPJE}>
              {ongekoppeld.length > 0
                ? `Nog niet herkend (${ongekoppeld.length})`
                : "Zonder persoon beginnen"}
            </h3>
            <Button type="button" variant="outline" size="sm" onClick={() => onLosseStaat(null)}>
              <Upload className="h-4 w-4" /> Losse urenstaat uploaden
            </Button>
          </div>

          {ongekoppeld.length > 0 && (
            <div className="overflow-hidden rounded-md border border-ink-100">
              {ongekoppeld.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onLosseStaat(item)}
                  className="flex w-full items-center gap-3 border-b border-ink-100 px-4 py-3 text-left last:border-b-0 hover:bg-ink-50"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-ink-100 text-ink-500">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-ink-900">
                      {item.naam}
                    </span>
                    <span className="block truncate text-xs text-ink-400">
                      {inboxSamenvatting(item)}
                    </span>
                  </span>
                  <Badge color="amber">persoon onbekend</Badge>
                </button>
              ))}
            </div>
          )}

          {ongekoppeld.length === 0 && (
            <p className="text-xs text-ink-400">
              Hoort een urenstaat bij niemand uit de lijst? Upload &apos;m los — je kiest de
              plaatsing dan in stap 1 zelf.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
