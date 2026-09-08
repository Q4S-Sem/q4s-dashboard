"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  FileText,
  FolderPlus,
  ListFilter,
  Search,
  Upload,
  UserRound,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/field";
import { formatCurrency, cn } from "@/lib/utils";
import { PersoonVierkant, COMPACT_PERSONEN_DREMPEL } from "@/components/ui/persoon-vierkant";
import {
  gereedeUrenstaatVanPlaatsingen,
  type GereedPerPlaatsing,
} from "@/lib/urenstaat-gereed";
import {
  filterPersonen,
  laatsteVerwerktLabel,
  openstaandLabel,
} from "@/lib/wizard-personen";
import {
  personenVoorWeek,
  weekLabel,
  weekSamenvatting,
  weekStatusKleur,
  weekStatusLabel,
  type PersoonWeekStatus,
} from "@/lib/wizard-weekfilter";
import { weekSlotVanKey } from "@/lib/wizard-weeknav";
import { WeekNavigator } from "./WeekNavigator";
import {
  inboxSamenvatting,
  type WizardPersoon,
  type WizardTimesheet,
  type WizardWeekkeuze,
} from "./wizard-data";

// ---------------------------------------------------------------------------
// STAP "KIES DE PERSOON" — de voordeur van de wizard "Week verwerken".
//
// De eigenaar kijkt per MENS: eerst wie er voor Q4S werkt, dan pas welke week.
// Eén kaart per persoon (nooit twee keer dezelfde naam), met daaronder zijn
// actieve plaatsing(en) en de tarieven waarmee straks gerekend wordt.
//
// Bovenaan staat de WEEKFILTER: de eigenaar kiest één week en blijft daar dan in
// werken. Elke kaart vertelt wat die persoon in DIE week te doen heeft — open,
// al verwerkt, of niets ingeleverd — en met "Alleen met open weken" verdwijnt
// de rest uit beeld. De week is navigatie: wat er straks vastgelegd wordt blijft
// de canonieke week uit de gewerkte dagen.
//
// Puur weergave: het groeperen, ontdubbelen, sorteren en zoeken gebeurt in
// src/lib/wizard-personen.ts en het week-werk in src/lib/wizard-weekfilter.ts
// (getest in tests/wizard-personen.test.ts en tests/wizard-weekfilter.test.ts).
// Dit bestand kiest alleen wat er waar staat.
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
  weekStatus,
  gereed,
  onKies,
}: {
  persoon: WizardPersoon;
  /** Wat deze persoon in de GEKOZEN week te doen heeft. */
  weekStatus: PersoonWeekStatus;
  /** Ligt er voor de gekozen week al een urenstaat klaar? Dan is die week af. */
  gereed: boolean;
  onKies: (persoon: WizardPersoon, placementId: string) => void;
}) {
  const open = persoon.openstaand.length;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <div className="flex items-center gap-3 border-b border-ink-100 p-3.5">
        <PersoonVierkant naam={persoon.naam} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-ink-900">{persoon.naam}</span>
          <span className="block truncate text-xs text-ink-400">
            {persoon.klanten.join(" · ") || "geen actieve plaatsing"}
          </span>
        </span>
        {/* De badge gaat over de GEKOZEN week; het totaal aantal open weken
            staat onderaan de kaart. Ligt de urenstaat van die week er al, dan
            staat dat er los bij — ook als er nog een scan open staat. */}
        {gereed && <Badge color="green">urenstaat gereed</Badge>}
        <Badge color={weekStatusKleur(weekStatus)}>{weekStatusLabel(weekStatus)}</Badge>
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
        <span className="shrink-0">
          {[
            open > 0 ? openstaandLabel(open) : null,
            persoon.plaatsingen.length > 1 ? `${persoon.plaatsingen.length} plaatsingen` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </div>
    </Card>
  );
}

export function PersoonPicker({
  personen,
  ongekoppeld,
  weekkeuze,
  week,
  onWeek,
  verwerktPerPlaatsing,
  gereedPerPlaatsing,
  onKies,
  onLosseStaat,
}: {
  /** Eén rij per persoon, al ontdubbeld en gesorteerd door bouwPersoonRijen. */
  personen: WizardPersoon[];
  /** Weekstaten waar (nog) geen persoon bij gevonden is. */
  ongekoppeld: WizardTimesheet[];
  /** De kiesbare weken + de lopende week, server-side bepaald. */
  weekkeuze: WizardWeekkeuze;
  /** De week waarin de eigenaar nu werkt ("" = geen week bekend). */
  week: string;
  /** Een andere week gekozen. */
  onWeek: (week: string) => void;
  /** placementId → al verwerkte weeksleutels (dezelfde map als de weekstrook). */
  verwerktPerPlaatsing: Record<string, string[]>;
  /** Dezelfde weken, mét de urenstaat die er al gereed staat (om te melden). */
  gereedPerPlaatsing: GereedPerPlaatsing;
  /** Gekozen: deze persoon, deze plaatsing ("" = straks zelf kiezen). */
  onKies: (persoon: WizardPersoon, placementId: string) => void;
  /** Zonder persoon verder: uploaden (null) of een niet-herkende staat openen. */
  onLosseStaat: (item: WizardTimesheet | null) => void;
}) {
  const [zoek, setZoek] = useState("");
  const [alleenOpen, setAlleenOpen] = useState(false);
  const toonZoek = personen.length >= ZOEK_VANAF;

  // Eerst zoeken (naam/klant/functie), dan de gekozen week erop: de twee filters
  // werken samen. Beide stappen zijn puur en getest.
  const gezocht = useMemo(() => filterPersonen(personen, zoek), [personen, zoek]);
  const inWeek = useMemo(
    () => personenVoorWeek({ personen: gezocht, week, verwerktPerPlaatsing }),
    [gezocht, week, verwerktPerPlaatsing],
  );
  const getoond = useMemo(
    () => personenVoorWeek({ personen: gezocht, week, verwerktPerPlaatsing, alleenOpen }),
    [gezocht, week, verwerktPerPlaatsing, alleenOpen],
  );

  // Grote ploeg → dichter raster (meer kolommen, kleinere kaarten) zodat >50
  // personen overzichtelijk in beeld blijven.
  const compact = personen.length > COMPACT_PERSONEN_DREMPEL;

  // De week waarin nu gewerkt wordt. Die kan buiten de bekende keuzelijst vallen
  // (de navigator kan naar élke week springen), dus vallen we terug op de slot
  // die puur uit de weeksleutel volgt. `huidig` = de lopende week.
  const huidigeWeekKey = weekkeuze.weken.find((w) => w.huidig)?.key ?? null;
  const gekozenWeek = weekkeuze.weken.find((w) => w.key === week) ?? weekSlotVanKey(week);
  const isHuidigeWeek = !!week && week === huidigeWeekKey;

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-ink-900">
            <Users className="h-4 w-4 text-brand-600" /> Kies de week en de persoon
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-ink-500">
            Kies eerst de week waarin je werkt, dan de persoon en zijn plaatsing — daarna loop je
            in drie stappen door de facturatie.
          </p>
        </div>

        {/* DE LEIDENDE WEEKFILTER: vorige/volgende week + kalender. Alles op deze
            pagina volgt de hier gekozen week. */}
        <div className="flex flex-col items-center gap-3 rounded-md border border-ink-200 bg-ink-50/50 px-3 py-3">
          <WeekNavigator week={week} onWeek={onWeek} huidigeWeekKey={huidigeWeekKey} />

          {toonZoek && (
            <div className="relative w-full max-w-sm">
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

        {/* De gekozen week in één regel, met de knop om de rest weg te laten. */}
        {gekozenWeek && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-ink-100 bg-ink-50/60 px-3 py-2">
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
              <CalendarDays className="h-4 w-4 shrink-0 text-brand-600" />
              <span className="font-semibold text-ink-900">{weekLabel(gekozenWeek)}</span>
              {isHuidigeWeek && <Badge color="blue">deze week</Badge>}
              <span className="text-ink-400">{weekSamenvatting(inWeek)}</span>
            </span>
            <Button
              type="button"
              size="sm"
              variant={alleenOpen ? "secondary" : "outline"}
              aria-pressed={alleenOpen}
              onClick={() => setAlleenOpen((v) => !v)}
            >
              <ListFilter className="h-4 w-4" />
              {alleenOpen ? "Toon iedereen" : "Alleen met open weken"}
            </Button>
          </div>
        )}

        {personen.length === 0 ? (
          <EmptyState
            icon={<UserRound className="h-6 w-6" />}
            title="Nog niemand om te verwerken"
            description="Er zijn geen actieve plaatsingen en er staat niets in de timesheet-inbox. Voeg een plaatsing toe, of sleep hieronder een losse urenstaat naar binnen."
          />
        ) : gezocht.length === 0 ? (
          <EmptyState
            icon={<Search className="h-6 w-6" />}
            title="Niemand gevonden"
            description={`Geen persoon of klant die op "${zoek.trim()}" lijkt. Pas de zoekterm aan.`}
          />
        ) : getoond.length === 0 ? (
          <EmptyState
            icon={<CalendarDays className="h-6 w-6" />}
            title={`Niets te verwerken in ${gekozenWeek ? weekLabel(gekozenWeek).toLowerCase() : "deze week"}`}
            description="Er ligt van niemand een urenstaat klaar voor deze week. Kies een andere week, of laat gewoon iedereen zien."
            action={
              <Button type="button" variant="outline" size="sm" onClick={() => setAlleenOpen(false)}>
                <Users className="h-4 w-4" /> Toon iedereen
              </Button>
            }
          />
        ) : (
          <div className={cn("grid gap-3 sm:grid-cols-2 2xl:grid-cols-3", compact && "xl:grid-cols-4 2xl:grid-cols-5")}>
            {getoond.map((p) => (
              <PersoonKaart
                key={p.consultantId}
                persoon={p}
                weekStatus={p.weekStatus}
                gereed={
                  gereedeUrenstaatVanPlaatsingen(
                    gereedPerPlaatsing,
                    p.plaatsingen.map((rij) => rij.plaatsing.id),
                    week,
                  ) !== null
                }
                onKies={onKies}
              />
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
            <div className="flex flex-wrap items-center gap-2">
              {/* De uploadbak (/inbox) staat niet meer in het menu: dit is de weg
                  ernaartoe. Verwerken doe je hier, in de wizard. */}
              <Link
                href="/inbox"
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                <FolderPlus className="h-4 w-4" /> Bestanden toevoegen (meerdere)
              </Link>
              <Button type="button" variant="outline" size="sm" onClick={() => onLosseStaat(null)}>
                <Upload className="h-4 w-4" /> Losse urenstaat uploaden
              </Button>
            </div>
          </div>

          <p className="text-xs text-ink-400">
            Meerdere urenstaten of een ZIP in één keer? Zet ze in de uploadbak — daarna verwerk je ze
            hier, persoon voor persoon.
          </p>

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
