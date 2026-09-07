"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  CheckCircle2,
  Copy,
  FileDown,
  FileText,
  FolderPlus,
  Inbox,
  Receipt,
  RotateCcw,
  Sparkles,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { DateInput } from "@/components/ui/date-input";
import { Dropzone } from "@/components/ui/dropzone";
import { EmptyState } from "@/components/ui/empty-state";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { wizardBestandUrl } from "@/lib/document-viewer";
import { evaluateMargin } from "@/lib/facturatie-detecties";
import { computeTimesheetMoney } from "@/lib/toeslag";
import {
  cn,
  formatCurrency,
  formatDate,
  formatHours,
  formatPercent,
  formatWeekLabel,
  parseHours,
  round2,
} from "@/lib/utils";
import { initialen } from "@/lib/weekverwerking";
import {
  gereedMelding,
  gereedeUrenstaat,
  type GereedeUrenstaat,
} from "@/lib/urenstaat-gereed";
import {
  buildWeekStrip,
  canonicalWeekFromDates,
  weekKey,
  weekMismatch,
  weekMismatchLabel,
} from "@/lib/week-koppeling";
import {
  STANDAARD_MARGENORM,
  margeGezondheid,
  matchFactuurBedrag,
  parseBedrag,
  wizardVoortgang,
} from "@/lib/week-wizard";
import { bouwPersoonRijen } from "@/lib/wizard-personen";
import { dubbeleUploadLabel } from "@/lib/wizard-dubbelen";
import { weekLabel, weekstatenVoorWeek } from "@/lib/wizard-weekfilter";
import { deleteTimesheet } from "../../uren/actions";
import { leesFactuur, leesTimesheet, verwerkWeek } from "./actions";
import { DocumentViewer } from "./DocumentViewer";
import { PersoonPicker } from "./PersoonPicker";
import { WeekStrip } from "./WeekStrip";
import {
  LEGE_DAGUREN,
  inboxSamenvatting,
  toDateInput,
  type BestaandeUrenstaat,
  type FactuurLeesState,
  type FactuurVelden,
  type TimesheetLeesState,
  type VerwerkState,
  type WizardPersoon,
  type WizardPlaatsing,
  type WizardTimesheet,
  type WizardWeekkeuze,
  type WizardWeekstrook,
} from "./wizard-data";

// ---------------------------------------------------------------------------
// Het scherm van de wizard "Week verwerken": één persoon, één week, drie stappen.
//
// PERSOON EERST: de wizard begint niet bij een stapel bestanden maar bij de
// MENS. Zolang er niemand gekozen is toont dit scherm de personenkaart-lijst
// (PersoonPicker); daarna draait de hele ronde op die ene persoon — zijn
// plaatsing is voorgevuld, en stap 1 laat alleen ZIJN openstaande weken zien.
// Het groeperen/ontdubbelen zelf zit in src/lib/wizard-personen.ts.
//
// Alle bedragen die hier staan komen uit computeTimesheetMoney (src/lib/toeslag.ts)
// — dezelfde functie waarmee createSalesInvoice de échte factuurregels bouwt — en
// de oordelen uit src/lib/week-wizard.ts en src/lib/facturatie-detecties.ts. Er
// wordt in dit bestand dus niets zelf uitgerekend of afgesproken.
//
// De AI vult alleen voor; elk veld hieronder is met de hand te corrigeren. Pas de
// knop "Akkoord — verwerk deze week" (stap 3) legt iets vast.
//
// STATE-MODEL, bewust zonder useEffect: de uitgelezen waarden blijven staan waar
// ze vandaan komen (de useActionState-uitkomst) en worden NIET naar state
// gekopieerd. Wat de mens verandert komt als "overschrijving" bovenop de
// AI-waarde. Een nieuwe week beginnen = de ronde-teller ophogen, waardoor het
// hele binnenwerk (inclusief de actie-uitkomsten) opnieuw opgebouwd wordt.
// ---------------------------------------------------------------------------

const DAG_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const DAG_MS = 86400000;

const TIMESHEET_ACCEPT =
  ".pdf,.png,.jpg,.jpeg,.webp,.gif,.xlsx,.xls,.csv,application/pdf,image/*";
const FACTUUR_ACCEPT = ".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv,application/pdf,image/*";

// --- de brede indeling -----------------------------------------------------
// De wizard vult de hele werkbreedte (zie page.tsx), zodat het document en de
// uitgelezen velden naast elkaar passen. Die tweedeling zit hieronder in één
// paar klassen, zodat stap 1 en stap 2 gegarandeerd dezelfde kolommen hebben.

/**
 * Document | velden: twee gelijke kolommen met hun bovenkant op één lijn. Pas
 * vanaf xl — daaronder is een halve kolom te smal voor allebei en zetten we ze
 * onder elkaar (document eerst, want daar controleer je aan).
 */
const SPLIT = "grid gap-5 xl:grid-cols-2 xl:items-start";
/** Kopje boven een kolom of paneel — overal hetzelfde grijze kapitaaltje. */
const KOPJE = "text-[11px] font-bold uppercase tracking-wide text-ink-400";
/** Breder scherm mag het document ook hóger tonen: beter te lezen. */
const DOC_HOOGTE = "h-[420px] sm:h-[520px] xl:h-[600px] 2xl:h-[680px]";
/** Velden in de halve kolom: één op een rij, twee zodra er ruimte voor is. */
const VELD_GRID = "grid gap-4 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2";
/** Inleidende tekst blijft leesbaar smal, ook al is de pagina breed. */
const INTRO = "mt-1 max-w-3xl text-sm text-ink-500";

/** Heeft deze medewerker precies één actieve plaatsing? Dan alvast invullen. */
function eenPlaatsingVoor(plaatsingen: WizardPlaatsing[], consultantId: string | null): string {
  if (!consultantId) return "";
  const eigen = plaatsingen.filter((p) => p.consultantId === consultantId);
  return eigen.length === 1 ? eigen[0].id : "";
}

/** De velden zoals de AI-uitlezing ze aanreikt — de basis onder de correcties. */
function beginWaarden(item: WizardTimesheet, plaatsingen: WizardPlaatsing[]) {
  return {
    placementId: item.placementId || eenPlaatsingVoor(plaatsingen, item.consultantId),
    weekStart: item.weekStart,
    dagUren: item.dagUren.length === 7 ? item.dagUren : LEGE_DAGUREN,
    overuren: item.overuren,
    kilometers: item.kilometers,
  };
}

/** Wat de mens boven de AI-uitlezing heeft gezet (leeg = AI-waarde geldt). */
type Correcties = {
  placementId?: string;
  weekStart?: string;
  dagUren?: string[];
  overuren?: string;
  kilometers?: string;
};

// --- kleine bouwstenen -----------------------------------------------------

/** Eén regel in een paneel: omschrijving links, bedrag/waarde rechts. */
function KV({ k, v, sterk = false }: { k: React.ReactNode; v: React.ReactNode; sterk?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-dashed border-ink-100 py-1.5 last:border-b-0">
      <span className={cn("text-sm", sterk ? "font-semibold text-ink-900" : "text-ink-500")}>
        {k}
      </span>
      <span
        className={cn(
          "text-right text-sm font-semibold tabular-nums text-ink-900",
          sterk && "text-[15px]",
        )}
      >
        {v}
      </span>
    </div>
  );
}

function Paneel({
  titel,
  accent = false,
  children,
}: {
  titel: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "rounded-md border p-4",
        accent ? "border-brand-200 bg-brand-50/50" : "border-ink-100 bg-white",
      )}
    >
      <h3
        className={cn(
          "mb-2 text-[11px] font-bold uppercase tracking-wide",
          accent ? "text-brand-700" : "text-ink-400",
        )}
      >
        {titel}
      </h3>
      {children}
    </div>
  );
}

/**
 * De week-afwijking: op de stukken staat een ander weeknummer dan de gewerkte
 * dagen aangeven. Bewust een MELDING en geen keuze — de wizard rekent gewoon
 * door met de week uit de dagen en het akkoord blijft gewoon mogelijk.
 */
function WeekAfwijkingNote({ melding }: { melding: string }) {
  return (
    <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
      <span>
        {melding}{" "}
        <span className="text-amber-700">
          Je hoeft niets te kiezen — de gewerkte dagen zijn leidend.
        </span>
      </span>
    </p>
  );
}

/**
 * Waar je een dubbele scan opruimt. De weekcontrole is de nette plek — daar zit
 * de bestaande verwijderknop mét guard (verwijderScan → deleteInbox) — maar die
 * pagina kent alleen UITGELEZEN staten; een nog niet uitgelezen dubbele ruim je
 * op zijn inbox-regel op, waar dezelfde deleteInbox onder de knop zit.
 */
function opruimHref(item: WizardTimesheet): string {
  return item.status === "EXTRACTED" ? `/verwerken/week/${item.id}` : `/inbox/${item.id}`;
}

/**
 * Dezelfde persoon-week is meer dan eens aangeleverd. De wizard toont er één (de
 * uitgelezen/nieuwste) en meldt hier wat er verborgen is, met een link naar de
 * plek waar de extra scan weg kan. Bewust een MELDING: er wordt nooit iets
 * automatisch verwijderd — dat blijft mensenwerk.
 */
function DubbeleUploadNote({ dubbelen }: { dubbelen: WizardTimesheet[] }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
      <Copy className="h-3.5 w-3.5 shrink-0" />
      <span>{dubbeleUploadLabel(dubbelen.length)} —</span>
      {dubbelen.map((dubbel, i) => (
        <Link
          key={dubbel.id}
          href={opruimHref(dubbel)}
          title={`${dubbel.originalName} · ${inboxSamenvatting(dubbel)}`}
          className="font-semibold underline underline-offset-2 hover:text-amber-900"
        >
          {dubbelen.length > 1 ? `opruimen (${i + 1})` : "opruimen"}
        </Link>
      ))}
    </p>
  );
}

/**
 * "Er staat al een urenstaat gereed voor <naam> — week <N>."
 *
 * Deze persoon-week is al verwerkt: er ligt een goedgekeurde (of al
 * gefactureerde) urenstaat. Bewust VOORAF — niet pas als het akkoord op de
 * @@unique stuit: de eigenaar ziet meteen dat er niets meer te doen is en klikt
 * door naar de urenstaat die er al ligt.
 *
 * Er wordt hier niets gewijzigd, niets verwijderd en niets automatisch
 * overgeslagen: alleen het akkoord vervalt, zodat dezelfde week niet nog een
 * keer verwerkt wordt.
 */
function GereedNote({
  naam,
  gereed,
  klein = false,
}: {
  naam: string;
  gereed: GereedeUrenstaat;
  /** Compacte variant voor onder een regel in de weekenlijst van stap 1. */
  klein?: boolean;
}) {
  if (klein) {
    return (
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
        <span>{gereedMelding(naam, gereed)} Je hoeft deze week niet nog eens te verwerken —</span>
        <Link
          href={`/uren/${gereed.id}`}
          className="font-semibold underline underline-offset-2 hover:text-amber-900"
        >
          bekijk de urenstaat
        </Link>
      </p>
    );
  }

  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
      <p className="flex items-start gap-2 text-sm font-semibold text-amber-900">
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
        {gereedMelding(naam, gereed)}
      </p>
      <p className="mt-1.5 text-sm text-amber-800">
        Deze week is al verwerkt — je hoeft hem niet nog een keer te doen. Klopt er iets niet, pas
        het dan aan bij de urenstaat zelf.
      </p>
      <div className="mt-3">
        <Link
          href={`/uren/${gereed.id}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <FileText className="h-4 w-4" /> Bekijk de urenstaat
        </Link>
      </div>
    </div>
  );
}

/**
 * "Er bestaat al een urenstaat voor deze week."
 *
 * De week lag er al (de @@unique op plaatsing + week sloeg toe). Het akkoord
 * loopt daar niet meer op stuk: is die bestaande urenstaat nog niet gefactureerd,
 * dan is hij gewoon gebruikt en staat dit paneel bij de uitkomst als uitleg. Is
 * hij al wél gefactureerd, dan is dit de uitweg — met de factuur erbij.
 *
 * De twee keuzes staan hier naast elkaar: de bestaande urenstaat erbij pakken,
 * of hem weggooien en de week opnieuw doen. Verwijderen gaat via de BESTAANDE
 * deleteTimesheet-actie, met dezelfde guard (nooit een gefactureerde week) en
 * altijd met een bevestiging — er wordt hier nooit iets vanzelf verwijderd.
 */
function BestaandeWeekPaneel({ bestaand }: { bestaand: BestaandeUrenstaat }) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 p-4">
      <p className="flex items-start gap-2 text-sm font-semibold text-amber-900">
        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0" />
        Er bestaat al een urenstaat voor deze week
      </p>
      <p className="mt-1.5 text-sm text-amber-800">
        {[
          bestaand.consultantNaam,
          bestaand.klantNaam,
          bestaand.weekLabel,
          `${formatHours(bestaand.uren)} u`,
        ]
          .filter(Boolean)
          .join(" · ")}{" "}
        — {bestaand.reden}.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link
          href={`/uren/${bestaand.id}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <FileText className="h-4 w-4" /> Bekijk de bestaande urenstaat
        </Link>

        {bestaand.alGefactureerd && bestaand.factuurId && (
          <Link
            href={`/facturen/${bestaand.factuurId}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Receipt className="h-4 w-4" /> Bekijk factuur{" "}
            {bestaand.factuurNummer ?? "(zonder nummer)"}
          </Link>
        )}

        {bestaand.magVerwijderen && (
          <ConfirmSubmit
            action={deleteTimesheet}
            id={bestaand.id}
            hidden={{ terug: "/verwerken/nieuw" }}
            trigger="button"
            size="sm"
            message={`De bestaande urenstaat van ${bestaand.weekLabel.toLowerCase()} verwijderen?`}
            description="De urenstaat en zijn dagregels verdwijnen; er wordt geen factuur aangeraakt (een week die al op een factuur staat kan sowieso niet weg). Daarna kun je deze week in de wizard opnieuw verwerken."
            confirmLabel="Urenstaat verwijderen"
          >
            <Trash2 className="h-4 w-4" /> Verwijder de bestaande urenstaat
          </ConfirmSubmit>
        )}
      </div>

      <p className="mt-2.5 text-xs text-amber-700">
        {bestaand.alGefactureerd
          ? "Deze week is al gefactureerd, dus er is niets veranderd. Wil je 'm toch opnieuw doen, draai dan eerst de factuur terug bij Facturen."
          : "Verwijderen brengt je naar de wizard terug; kies daar deze persoon en week opnieuw."}
      </p>
    </div>
  );
}

/** De stappen van de wizard; 0 = de persoon kiezen, daarna de drie bekende. */
type WizardStap = 0 | 1 | 2 | 3;

/**
 * De vier stappen bovenaan; afgeronde stappen krijgen een vinkje. De eerste
 * stap is de PERSOON — die houdt geen nummer maar een poppetje, zodat de drie
 * vertrouwde stappen 1/2/3 blijven heten.
 */
function Stepper({
  stap,
  persoonLabel,
  timesheetKlaar,
  factuurKlaar,
  maxStap,
  ga,
}: {
  stap: WizardStap;
  /** De gekozen persoon, of null zolang er nog niemand gekozen is. */
  persoonLabel: string | null;
  timesheetKlaar: boolean;
  factuurKlaar: boolean;
  maxStap: WizardStap;
  ga: (n: WizardStap) => void;
}) {
  const stappen = [
    {
      n: 0 as const,
      label: "Persoon",
      cap: persoonLabel ?? "wie werkt er",
      klaar: persoonLabel !== null,
    },
    { n: 1 as const, label: "Timesheet", cap: "uren", klaar: timesheetKlaar },
    { n: 2 as const, label: "Factuur", cap: "inkoop", klaar: factuurKlaar },
    { n: 3 as const, label: "Controle", cap: "akkoord", klaar: false },
  ];

  return (
    <div className="flex overflow-hidden rounded-md border border-ink-100 bg-white">
      {stappen.map((s) => {
        const actief = stap === s.n;
        const bereikbaar = s.n <= maxStap;
        return (
          <button
            key={s.n}
            type="button"
            onClick={() => ga(s.n)}
            disabled={!bereikbaar}
            aria-current={actief ? "step" : undefined}
            className={cn(
              "flex flex-1 items-center gap-3 border-r border-ink-100 px-4 py-3 text-left transition-colors last:border-r-0",
              bereikbaar ? "cursor-pointer hover:bg-ink-50" : "cursor-not-allowed opacity-50",
            )}
          >
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
                actief
                  ? "border-brand-600 bg-brand-600 text-white"
                  : s.klaar
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-ink-200 bg-ink-50 text-ink-400",
              )}
            >
              {s.klaar && !actief ? (
                <Check className="h-3.5 w-3.5" />
              ) : s.n === 0 ? (
                <Users className="h-3.5 w-3.5" />
              ) : (
                s.n
              )}
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  "block truncate text-[13px] font-semibold",
                  actief ? "text-brand-700" : "text-ink-900",
                )}
              >
                {s.label}
              </span>
              <span className="block truncate text-xs text-ink-400">{s.cap}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

// --- de wizard -------------------------------------------------------------

/**
 * Wie er gekozen is. Bewust alleen ID's + een naam: de rijen zelf worden elke
 * render opnieuw uit de (ververste) serverlijst gehaald, zodat een verwerkte
 * week meteen uit het overzicht verdwijnt.
 */
type Keuze = {
  /** null = zonder persoon begonnen (losse upload of niet-herkende weekstaat). */
  consultantId: string | null;
  /** Naam voor de kop, ook als de persoon straks uit de lijst valt. */
  naam: string;
  /** De gekozen plaatsing ("" = de mens kiest 'm in stap 1 zelf). */
  placementId: string;
  /** Meteen deze weekstaat openen (uit de niet-herkende lijst). */
  itemId: string | null;
  /**
   * De week uit de weekfilter waarin hij gekozen heeft ("" = geen). Puur om
   * stap 1 naar die week te leiden — de week die vastgelegd wordt komt en blijft
   * uit de gewerkte dagen (canonicalWeekFromDates).
   */
  week: string;
};

export function WeekWizard(props: {
  items: WizardTimesheet[];
  /**
   * Per getoonde weekstaat (zijn id) de dubbele uploads die de server eronder
   * verborgen heeft — zie src/lib/wizard-dubbelen.ts. Alleen om te melden.
   */
  dubbelen: Record<string, WizardTimesheet[]>;
  plaatsingen: WizardPlaatsing[];
  weekstrook: WizardWeekstrook;
  weekkeuze: WizardWeekkeuze;
  aiKlaar: boolean;
}) {
  const router = useRouter();
  const [ronde, setRonde] = useState(0);
  const [keuze, setKeuze] = useState<Keuze | null>(null);
  // De week waarin de eigenaar werkt. De startwaarde komt van de server (de
  // recentste week met openstaande staten, anders de lopende week), zodat het
  // scherm er geen eigen `new Date()` voor nodig heeft. Blijft staan als hij van
  // persoon wisselt — daar is de filter juist voor.
  const [week, setWeek] = useState(props.weekkeuze.standaard);

  // Eén rij per persoon: zijn plaatsing(en) en zijn openstaande weken bij
  // elkaar. Puur en getest (src/lib/wizard-personen.ts) — hier alleen tonen.
  const overzicht = useMemo(
    () =>
      bouwPersoonRijen<WizardPlaatsing, WizardTimesheet>({
        plaatsingen: props.plaatsingen,
        weekstaten: props.items,
        weekstrook: props.weekstrook,
      }),
    [props.plaatsingen, props.items, props.weekstrook],
  );

  // STAP 0 — nog niemand gekozen: de personenlijst is de voordeur.
  if (!keuze) {
    return (
      <div className="space-y-4">
        <Stepper
          stap={0}
          persoonLabel={null}
          timesheetKlaar={false}
          factuurKlaar={false}
          maxStap={0}
          ga={() => {}}
        />
        <PersoonPicker
          personen={overzicht.personen}
          ongekoppeld={overzicht.ongekoppeld}
          weekkeuze={props.weekkeuze}
          week={week}
          onWeek={setWeek}
          verwerktPerPlaatsing={props.weekstrook.verwerktPerPlaatsing}
          gereedPerPlaatsing={props.weekstrook.gereedPerPlaatsing}
          onKies={(persoon, placementId) =>
            setKeuze({
              consultantId: persoon.consultantId,
              naam: persoon.naam,
              placementId,
              itemId: null,
              week,
            })
          }
          onLosseStaat={(item) =>
            setKeuze({
              consultantId: null,
              naam: item?.naam ?? "Losse urenstaat",
              placementId: item?.placementId ?? "",
              itemId: item?.id ?? null,
              week,
            })
          }
        />
      </div>
    );
  }

  // De rij van de gekozen persoon, elke render vers uit het overzicht: na een
  // verwerkte week ververst de server de lijst en klopt de teller weer.
  const persoon = keuze.consultantId
    ? (overzicht.personen.find((p) => p.consultantId === keuze.consultantId) ?? null)
    : null;

  // Eén ronde = één persoon-week. Opnieuw beginnen is bewust een verse mount:
  // dan zijn ook de uitlees-uitkomsten (useActionState) weer leeg, zonder dat we
  // ergens een "al gezien"-vlag hoeven bij te houden.
  return (
    <WizardRonde
      key={`${keuze.consultantId ?? "los"}:${keuze.placementId}:${ronde}`}
      {...props}
      // Alleen ZIJN openstaande weken — zonder persoon: wat nog niet herkend is.
      items={persoon ? persoon.openstaand : overzicht.ongekoppeld}
      keuze={keuze}
      persoon={persoon}
      startItem={keuze.itemId ? (props.items.find((i) => i.id === keuze.itemId) ?? null) : null}
      opnieuw={() => {
        // Volgende week van dezelfde persoon: verse ronde, maar niet nog eens
        // dezelfde weekstaat openen — die is net verwerkt.
        setKeuze((k) => (k?.itemId ? { ...k, itemId: null } : k));
        setRonde((r) => r + 1);
        // De verwerkte week is uit de inbox verdwenen — verse lijst ophalen.
        router.refresh();
      }}
      wisselPersoon={() => {
        setKeuze(null);
        setRonde((r) => r + 1);
        router.refresh();
      }}
    />
  );
}

function WizardRonde({
  items,
  dubbelen,
  plaatsingen,
  weekstrook,
  weekkeuze,
  aiKlaar,
  keuze,
  persoon,
  startItem,
  opnieuw,
  wisselPersoon,
}: {
  /** De openstaande weken van de gekozen persoon (of: wat niet herkend is). */
  items: WizardTimesheet[];
  /** Per weekstaat de dubbele uploads die eronder verborgen zijn. */
  dubbelen: Record<string, WizardTimesheet[]>;
  plaatsingen: WizardPlaatsing[];
  weekstrook: WizardWeekstrook;
  weekkeuze: WizardWeekkeuze;
  aiKlaar: boolean;
  keuze: Keuze;
  /** De rij van de gekozen persoon; null = zonder persoon begonnen. */
  persoon: WizardPersoon | null;
  /** Meteen te openen weekstaat (uit de niet-herkende lijst). */
  startItem: WizardTimesheet | null;
  opnieuw: () => void;
  wisselPersoon: () => void;
}) {
  const [stap, setStap] = useState<1 | 2 | 3>(1);
  const [gekozenItem, setGekozenItem] = useState<WizardTimesheet | null>(startItem);
  // De gekozen persoon dríjft de rest: zijn plaatsing staat meteen goed, dus de
  // tarieven, de weekstrook en straks de verkoopfactuur kloppen vanaf stap 1.
  const [correcties, setCorrecties] = useState<Correcties>(
    keuze.placementId ? { placementId: keuze.placementId } : {},
  );
  const [factuurCorrectie, setFactuurCorrectie] = useState<{
    voor: string;
    velden: FactuurVelden;
  } | null>(null);

  const [tsState, tsAction] = useActionState<TimesheetLeesState, FormData>(leesTimesheet, {});
  const [invState, invAction] = useActionState<FactuurLeesState, FormData>(leesFactuur, {});
  const [verwerkState, verwerkAction] = useActionState<VerwerkState, FormData>(verwerkWeek, {});

  // De week uit de weekfilter: alleen om stap 1 naar die week te leiden. Wat er
  // straks vastgelegd wordt komt uit de gewerkte dagen, niet hieruit. Meteen
  // uitgepakt tot platte waarden — verderop hangt er dus geen object meer aan.
  const filterWeek = weekkeuze.weken.find((w) => w.key === keuze.week) ?? null;
  const filterWeekMaandag = filterWeek?.monday ?? "";
  const filterWeekLabel = filterWeek
    ? weekLabel({ isoWeek: filterWeek.isoWeek, year: filterWeek.year })
    : "";
  // Zijn openstaande weken met die van de gekozen week vooraan — niets verdwijnt.
  const eigenWeken = weekstatenVoorWeek(items, keuze.week);

  // --- stap 1: de weekstaat, met de correcties van de mens erbovenop -------
  const gekozen = gekozenItem ?? tsState.item ?? null;
  const basis = gekozen ? beginWaarden(gekozen, plaatsingen) : null;
  const placementId = correcties.placementId ?? basis?.placementId ?? "";
  // Noemt de weekstaat zelf geen week (niets uitgelezen), dan begint hij op de
  // week die hij in de filter koos — te overschrijven met het datumveld.
  const weekStart = correcties.weekStart ?? (basis?.weekStart || filterWeekMaandag);
  const weekUitFilter = weekStart !== "" && !correcties.weekStart && !basis?.weekStart;
  const dagUren = correcties.dagUren ?? basis?.dagUren ?? LEGE_DAGUREN;
  const overuren = correcties.overuren ?? basis?.overuren ?? "";
  const kilometers = correcties.kilometers ?? basis?.kilometers ?? "";

  function corrigeer(patch: Correcties) {
    setCorrecties((prev) => ({ ...prev, ...patch }));
  }

  function kies(item: WizardTimesheet) {
    setGekozenItem(item);
    // De plaatsing van de gekozen persoon blijft staan; de rest van de
    // correcties hoorde bij de vorige weekstaat en vervalt.
    setCorrecties(placementId ? { placementId } : {});
  }

  // --- stap 2: zijn eigen factuur -----------------------------------------
  // De correcties horen bij één geüpload bestand; komt er een nieuwe factuur
  // binnen, dan tellen de oude wijzigingen niet meer mee.
  const factuurBestand = invState.bestand ?? null;
  const factuurSleutel = factuurBestand?.fileName ?? "";
  // Het bestand is wél opgeslagen maar heeft nog geen ReceivedInvoice-rij, dus
  // het voorbeeld komt van de opslagnaam-route (null = sleutel niet vertrouwd).
  const factuurSrc = factuurBestand ? wizardBestandUrl(factuurBestand) : null;
  const factuur =
    factuurCorrectie && factuurCorrectie.voor === factuurSleutel
      ? factuurCorrectie.velden
      : (invState.values ?? null);

  function zetFactuur(velden: FactuurVelden) {
    setFactuurCorrectie({ voor: factuurSleutel, velden });
  }

  // --- DE WEEK: altijd uit de gewerkte dagen -------------------------------
  // canonicalWeekFromDates (src/lib/week-koppeling.ts) is de bron van waarheid:
  // de ingevulde datum wordt naar zijn ISO-maandag getrokken, en dát is de week
  // die het scherm toont én die straks meegaat naar confirmInboxItem (en dus in
  // de urenstaat waar createSalesInvoice mee factureert). Wat er op de stukken
  // getypt staat telt nooit mee — hooguit als melding, zie hieronder.
  const canoniek = canonicalWeekFromDates(weekStart);
  const maandag = canoniek?.monday ?? null;
  const canoniekeWeekStart = maandag ? toDateInput(maandag) : "";

  // De afwijking tussen het getypte weeknummer (staat én factuur) en de echte
  // week. Blokkeert nooit iets; het is puur een melding in stap 1 en stap 2.
  const staatAfwijking = weekMismatch({
    canonicalWeek: canoniek,
    typedWeek: gekozen?.getypteWeek ?? null,
  });
  const factuurAfwijking = weekMismatch({
    canonicalWeek: canoniek,
    typedWeek: invState.getypteWeek ?? null,
  });

  // --- afgeleide bedragen (geen eigen rekenwerk: alles via toeslag.ts) -----
  const plaatsing = plaatsingen.find((p) => p.id === placementId) ?? null;

  const entries = useMemo(() => {
    // Ook hier de canonieke maandag: de dagregels moeten op dezelfde week landen
    // als het scherm toont en als straks in de urenstaat komt.
    const ma = canonicalWeekFromDates(weekStart)?.monday ?? null;
    if (!ma) return [];
    return dagUren
      .map((h, i) => ({ date: new Date(ma.getTime() + i * DAG_MS), hours: parseHours(h) }))
      .filter((e) => e.hours > 0);
  }, [dagUren, weekStart]);

  // --- de weekstrook van deze persoon -------------------------------------
  // Welke weken zijn al verwerkt en welke ontbreken er nog? De verwerkte weken
  // komen van de server (goedgekeurde urenstaten van deze plaatsing); de week
  // die nu op tafel ligt kleurt "bezig" — of "afwijking" als het weeknummer op
  // de stukken niet klopte.
  const bezigWeek = canoniek ? weekKey(canoniek) : null;
  const heeftWeekAfwijking = staatAfwijking !== null || factuurAfwijking !== null;
  // Ligt er voor deze plaatsing + week AL een goedgekeurde urenstaat? Dan is
  // deze week klaar: het scherm meldt dat (met een link erheen) en het akkoord
  // maakt plaats voor "Al verwerkt — bekijk urenstaat". Zolang er nog geen
  // weekstaat gekozen is telt de week uit de filter, zodat de melding er al
  // staat vóór je hem opent. Opzoeken is puur en getest (urenstaat-gereed.ts);
  // de echte blokkade blijft de @@unique op de server.
  const gereed = gereedeUrenstaat(weekstrook.gereedPerPlaatsing, placementId, bezigWeek);
  // Tien hokjes samenstellen is verwaarloosbaar werk — geen useMemo nodig.
  const stripCellen = placementId
    ? buildWeekStrip({
        weken: weekstrook.weken,
        verwerkt: weekstrook.verwerktPerPlaatsing[placementId] ?? [],
        afwijkend: heeftWeekAfwijking && bezigWeek ? [bezigWeek] : [],
        bezig: bezigWeek,
      })
    : [];

  const geld =
    plaatsing && entries.length > 0
      ? computeTimesheetMoney(
          {
            entries,
            overtimeHours: parseHours(overuren) || null,
            kilometers: parseHours(kilometers) || null,
          },
          plaatsing.config,
        )
      : null;

  // Zijn factuurbedrag EX btw — de verkoopkant is ook ex btw, dus pas dan is het
  // een eerlijke vergelijking. Bij verlegde btw is er niets af te trekken.
  const factuurBedrag = factuur ? parseBedrag(factuur.amount) : null;
  const factuurBtw = factuur ? parseBedrag(factuur.vatAmount) : null;
  const factuurExcl =
    factuurBedrag === null
      ? null
      : round2(factuurBedrag - (factuurBtw && factuurBtw > 0 ? factuurBtw : 0));

  const match = matchFactuurBedrag({
    factuurBedrag: factuurExcl,
    verwachtBedrag: geld?.buy.total ?? null,
  });

  const inkoop = factuurExcl ?? geld?.buy.total ?? null;
  const weekMarge = geld && inkoop !== null ? round2(geld.sell.total - inkoop) : null;
  const marge = evaluateMargin({
    hoursOnInvoice: factuurExcl !== null ? (geld?.hours ?? null) : null,
    invoiceAmount: factuurExcl,
    costRate: plaatsing?.config.costRate ?? null,
    chargeRate: plaatsing?.config.chargeRate ?? null,
    expectedMarginPerHour: STANDAARD_MARGENORM,
  });
  const margeBadge = margeGezondheid({
    marginPerHour: marge.marginPerHour,
    belowNorm: marge.belowNorm,
    normPerHour: STANDAARD_MARGENORM,
  });

  const voortgang = wizardVoortgang({
    heeftTimesheet: gekozen !== null && entries.length > 0,
    heeftFactuur: factuur !== null && factuurBedrag !== null,
  });
  // Akkoord kan pas als er uren én een plaatsing zijn: zonder plaatsing weten we
  // niet wie er gefactureerd wordt en tegen welk tarief.
  const klaarVoorAkkoord = voortgang.kanAfronden && placementId !== "";
  const totaalUren = geld?.hours ?? 0;
  const resultaat = verwerkState.resultaat;

  // De naam in de kop: de plaatsing is het meest exact, daarna de gekozen
  // persoon, dan wat er op de weekstaat stond.
  const persoonNaam =
    plaatsing?.consultantNaam ?? persoon?.naam ?? gekozen?.naam ?? keuze.naam;

  function ga(n: WizardStap) {
    // Stap 0 is de personenlijst: terug naar de voordeur.
    if (n === 0) {
      wisselPersoon();
      return;
    }
    if (n > voortgang.maxStap) return;
    setStap(n);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // --- klaar: het succesbeeld ---------------------------------------------
  if (resultaat) {
    // De échte Q4S-factuur-PDF: dezelfde route die /verzenden gebruikt om de
    // bijlage te maken (src/app/(app)/verzenden/[type]/[id]/pdf/route.ts), dus
    // exact het document dat de klant straks in de mail krijgt.
    const verkoopPdfHref = resultaat.verkoopFactuurId
      ? `/verzenden/verkoop/${resultaat.verkoopFactuurId}/pdf`
      : null;

    return (
      <Card className="border-emerald-200">
        <CardContent className="space-y-5">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-[17px] font-bold text-ink-900">Week verwerkt</h2>
              <p className="mt-1 text-sm text-ink-500">
                {resultaat.consultantNaam}
                {resultaat.klantNaam ? ` · ${resultaat.klantNaam}` : ""}
                {resultaat.weekLabel ? ` · ${resultaat.weekLabel}` : ""}
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Paneel titel="Uren">
              <KV k="Geaccepteerd" v={`${formatHours(resultaat.uren)} u`} />
              <div className="mt-2">
                <Badge color="green">urenstaat goedgekeurd</Badge>
              </div>
            </Paneel>
            <Paneel titel="Inkoop — zijn factuur">
              <KV
                k={resultaat.ontvangenFactuurId ? "Geregistreerd" : "Niet geregistreerd"}
                v={resultaat.inkoop != null ? formatCurrency(resultaat.inkoop) : "—"}
              />
              <div className="mt-2">
                {resultaat.ontvangenFactuurId ? (
                  <Badge color="green">bij Ontvangen facturen · gecontroleerd</Badge>
                ) : (
                  <Badge color="amber">factuur ontbreekt nog</Badge>
                )}
              </div>
            </Paneel>
            <Paneel titel="Verkoop — naar klant">
              <KV k="Verkoopfactuur (excl.)" v={formatCurrency(resultaat.verkoop)} />
              <div className="mt-2">
                {resultaat.verkoopFactuurNummer ? (
                  <Badge color="blue">concept {resultaat.verkoopFactuurNummer}</Badge>
                ) : (
                  <Badge color="amber">geen verkoopfactuur gemaakt</Badge>
                )}
              </div>
              {verkoopPdfHref && (
                <a
                  href={verkoopPdfHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
                >
                  <FileDown className="h-3.5 w-3.5" /> Open de PDF
                </a>
              )}
            </Paneel>
            <Paneel titel="Jouw marge" accent>
              <KV
                k="Verkoop − inkoop"
                v={resultaat.marge != null ? formatCurrency(resultaat.marge) : "—"}
                sterk
              />
            </Paneel>
          </div>

          {/* Werd de week tegen een AL BESTAANDE urenstaat afgemaakt? Dan staat
              hier welke dat was — en, zolang er nog niets gefactureerd is, de
              knop om hem alsnog weg te gooien en opnieuw te beginnen. */}
          {verwerkState.bestaand && <BestaandeWeekPaneel bestaand={verwerkState.bestaand} />}

          {resultaat.waarschuwingen.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="flex items-center gap-2 text-sm font-semibold text-amber-900">
                <AlertTriangle className="h-4 w-4" /> Let op
              </p>
              <ul className="mt-1.5 space-y-1 text-sm text-amber-800">
                {resultaat.waarschuwingen.map((w, i) => (
                  <li key={i} className="flex items-start gap-1.5">
                    <span aria-hidden>•</span>
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 pt-4">
            {verkoopPdfHref && (
              <a
                href={verkoopPdfHref}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonVariants()}
              >
                <FileDown className="h-4 w-4" /> Verkoopfactuur (PDF)
              </a>
            )}
            <Button type="button" variant="outline" onClick={opnieuw}>
              <RotateCcw className="h-4 w-4" /> Volgende week van {persoonNaam}
            </Button>
            <Button type="button" variant="outline" onClick={wisselPersoon}>
              <Users className="h-4 w-4" /> Andere persoon
            </Button>
            {resultaat.verkoopFactuurId && (
              <Link
                href={`/facturen/${resultaat.verkoopFactuurId}`}
                className={buttonVariants({ variant: "outline" })}
              >
                <Receipt className="h-4 w-4" /> Bekijk conceptfactuur
              </Link>
            )}
            <Link href="/uren" className={buttonVariants({ variant: "outline" })}>
              <FileText className="h-4 w-4" /> Urenregistratie
            </Link>
          </div>

          <p className="text-xs text-ink-400">
            Er is niets verstuurd — de verkoopfactuur blijft concept tot jij &apos;m verstuurt.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* --- wie & welke week (+ de weekstrook van deze persoon) --- */}
      <Card>
        <CardContent className="p-0">
          <div className="flex flex-wrap items-center gap-3 p-3.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-brand-600 text-[13px] font-bold text-white">
              {initialen(persoonNaam)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-ink-900">{persoonNaam}</span>
              <span className="block truncate text-xs text-ink-400">
                {[
                  plaatsing ? (plaatsing.klantNaam ?? "— geen bedrijf") : null,
                  // De week uit de gewerkte dagen — niet het nummer van de staat.
                  maandag
                    ? `${formatWeekLabel(maandag)} (${formatDate(maandag)} – ${formatDate(new Date(maandag.getTime() + 6 * DAG_MS))})`
                    : null,
                  plaatsing ? `inkoop ${formatCurrency(plaatsing.config.costRate)}/u` : null,
                  plaatsing ? `verkoop ${formatCurrency(plaatsing.config.chargeRate)}/u` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Kies hieronder een week — de rest vult zich vanzelf."}
              </span>
            </span>
            {heeftWeekAfwijking && canoniek && (
              <Badge color="orange">week {canoniek.isoWeek} volgens de dagen</Badge>
            )}
            {gereed && <Badge color="green">urenstaat gereed</Badge>}
            <Badge color={gekozen ? "blue" : "slate"}>
              {gekozen ? "in behandeling" : "nog niet begonnen"}
            </Badge>
            <button
              type="button"
              onClick={wisselPersoon}
              className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-sm border border-ink-200 px-2.5 py-1 text-xs font-semibold text-ink-600 transition-colors hover:border-ink-900 hover:bg-ink-50"
            >
              <Users className="h-3.5 w-3.5" /> Wissel van persoon
            </button>
          </div>

          {/* Werkt hij op meer plaatsen? Dan kies je hier voor welke klant deze
              week is — dezelfde keuze als op zijn kaart, altijd bij de hand. */}
          {persoon && persoon.plaatsingen.length > 1 && (
            <div className="flex flex-wrap items-center gap-2 border-t border-ink-100 px-3.5 py-2.5">
              <span className={KOPJE}>Plaatsing</span>
              {persoon.plaatsingen.map((rij) => {
                const actief = rij.plaatsing.id === placementId;
                return (
                  <button
                    key={rij.plaatsing.id}
                    type="button"
                    onClick={() => corrigeer({ placementId: rij.plaatsing.id })}
                    aria-pressed={actief}
                    className={cn(
                      "cursor-pointer rounded-sm border px-2.5 py-1 text-xs font-semibold transition-colors",
                      actief
                        ? "border-brand-600 bg-brand-50 text-brand-700"
                        : "border-ink-200 bg-white text-ink-500 hover:border-ink-900 hover:bg-ink-50",
                    )}
                  >
                    {rij.plaatsing.klantNaam ?? "— geen bedrijf"}
                    <span className="ml-1.5 font-normal text-ink-400">{rij.plaatsing.functie}</span>
                  </button>
                );
              })}
            </div>
          )}

          {stripCellen.length > 0 && (
            <div className="border-t border-ink-100 px-3.5 py-2.5">
              <WeekStrip cellen={stripCellen} />
            </div>
          )}
        </CardContent>
      </Card>

      <Stepper
        stap={stap}
        persoonLabel={persoonNaam}
        timesheetKlaar={voortgang.timesheet === "done"}
        factuurKlaar={voortgang.factuur === "done"}
        maxStap={voortgang.maxStap}
        ga={ga}
      />

      {/* ================= STAP 1 ================= */}
      {stap === 1 && (
        <Card>
          <CardContent className="space-y-5">
            <div>
              <h2 className="text-[15px] font-bold text-ink-900">Stap 1 · Timesheet erin</h2>
              <p className={INTRO}>
                {persoon
                  ? `Kies hiernaast de week van ${persoonNaam} die je wilt verwerken, of sleep een nieuwe urenstaat erin. `
                  : "Sleep de urenstaat hierin, of kies er één uit de lijst. "}
                De AI leest de uren automatisch uit — jij controleert.
              </p>
            </div>

            {/* Deze week ligt er al: melden en doorlinken, niet nog eens doen. */}
            {gereed && <GereedNote naam={persoonNaam} gereed={gereed} />}

            {!gekozen ? (
              // ZIJN weken links (de gewone route), uploaden rechts (de
              // uitzondering) — twee kolommen met hun kopjes op één lijn.
              <div className={SPLIT}>
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className={KOPJE}>
                      {persoon
                        ? `Openstaande weken van ${persoonNaam}`
                        : "Nog niet herkende weekstaten"}
                    </h3>
                    {/* De week uit de filter staat bovenaan — de rest blijft
                        gewoon staan, je kunt altijd een andere week pakken. */}
                    {filterWeekLabel !== "" && (
                      <span className="text-[11px] text-ink-400">
                        {filterWeekLabel} staat bovenaan
                      </span>
                    )}
                  </div>
                  {eigenWeken.length === 0 ? (
                    <EmptyState
                      icon={<Inbox className="h-6 w-6" />}
                      title={persoon ? "Geen openstaande weken" : "Niets in de inbox"}
                      description={
                        persoon
                          ? `Er staat geen weekstaat van ${persoonNaam} klaar. Sleep er hiernaast één in, of pak een andere persoon op.`
                          : "Er staan geen weekstaten zonder persoon klaar. Sleep er hiernaast één in, of kies een persoon uit de lijst."
                      }
                      action={
                        <Button type="button" variant="outline" size="sm" onClick={wisselPersoon}>
                          <Users className="h-4 w-4" /> Wissel van persoon
                        </Button>
                      }
                    />
                  ) : (
                    <div className="overflow-hidden rounded-md border border-ink-100">
                      {eigenWeken.map((item) => {
                        // Onder een persoon is de WEEK de kop (zijn naam staat al
                        // bovenaan); zonder persoon blijft dat de naam op de staat.
                        const week = canonicalWeekFromDates(item.weekStart);
                        const kop = persoon
                          ? week
                            ? weekLabel(week)
                            : item.originalName
                          : item.naam;
                        const isFilterWeek =
                          week !== null && keuze.week !== "" && weekKey(week) === keuze.week;
                        // Dezelfde week twee keer aangeleverd? Dan staat hier de
                        // bewaarde staat, met eronder de melding wat er verborgen is.
                        const dubbel = dubbelen[item.id] ?? [];
                        // Ligt de urenstaat van déze week er al? Dan zegt de regel
                        // dat meteen, zodat je hem niet opnieuw oppakt.
                        const alGereed = gereedeUrenstaat(
                          weekstrook.gereedPerPlaatsing,
                          placementId,
                          week ? weekKey(week) : null,
                        );
                        return (
                          <div key={item.id} className="border-b border-ink-100 last:border-b-0">
                            <button
                              type="button"
                              onClick={() => kies(item)}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ink-50"
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-ink-100 text-ink-500">
                                <FileText className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-ink-900">
                                  {kop}
                                </span>
                                <span className="block truncate text-xs text-ink-400">
                                  {inboxSamenvatting(item)}
                                </span>
                              </span>
                              {isFilterWeek && <Badge color="blue">gekozen week</Badge>}
                              {alGereed ? (
                                <Badge color="green">urenstaat gereed</Badge>
                              ) : item.status === "NEW" ? (
                                <Badge color="amber">nog niet uitgelezen</Badge>
                              ) : item.needsReview ? (
                                <Badge color="amber">nakijken</Badge>
                              ) : (
                                <Badge color="green">uitgelezen</Badge>
                              )}
                            </button>
                            {alGereed && (
                              <GereedNote
                                naam={persoon?.naam ?? item.naam}
                                gereed={alGereed}
                                klein
                              />
                            )}
                            {dubbel.length > 0 && <DubbeleUploadNote dubbelen={dubbel} />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className={KOPJE}>Of upload een nieuwe urenstaat</h3>
                    {/* Eén bestand gaat hieronder; een stapel of een ZIP hoort in
                        de uploadbak. Verwerken blijft hier gebeuren. */}
                    <Link
                      href="/inbox"
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      <FolderPlus className="h-4 w-4" /> Bestanden toevoegen (meerdere)
                    </Link>
                  </div>
                  <form action={tsAction} className="space-y-3">
                    <Dropzone
                      name="file"
                      accept={TIMESHEET_ACCEPT}
                      label="Sleep de timesheet hierheen"
                      hint="PDF, foto/scan of Excel — gedraaide scans worden automatisch rechtgezet"
                    />
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="text-xs text-ink-400">
                        {aiKlaar
                          ? "Het bestand komt ook gewoon in de timesheet-inbox te staan."
                          : "Er is geen AI ingesteld — je vult de uren straks zelf in."}
                      </p>
                      <SubmitButton pendingLabel="AI leest…">
                        <Sparkles className="h-4 w-4" /> Upload &amp; uitlezen
                      </SubmitButton>
                    </div>
                  </form>

                  {tsState.error && (
                    <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
                      {tsState.error}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <>
                {(tsState.waarschuwing || gekozen.aiNotes) && (
                  <p className="flex items-start gap-2 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{tsState.waarschuwing ?? gekozen.aiNotes}</span>
                  </p>
                )}

                {staatAfwijking && (
                  <WeekAfwijkingNote melding={weekMismatchLabel(staatAfwijking)} />
                )}

                {/* Document links, uitgelezen velden rechts — op één regel te
                    vergelijken; op smalle schermen staat het document bovenaan. */}
                <div className={SPLIT}>
                  <DocumentViewer
                    src={`/api/inbox/${gekozen.id}`}
                    mimeType={gekozen.mimeType}
                    originalName={gekozen.originalName}
                    titel="Timesheet"
                    hoogte={DOC_HOOGTE}
                  />

                  <div className="rounded-md border border-ink-100 p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <h3 className={KOPJE}>Uitgelezen door AI — controleer de uren</h3>
                      <button
                        type="button"
                        onClick={opnieuw}
                        className="shrink-0 text-xs font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800"
                      >
                        andere kiezen
                      </button>
                    </div>

                    <div className={VELD_GRID}>
                      <Field label="Plaatsing (werknemer · klant)" htmlFor="placementId" required>
                        <Select
                          id="placementId"
                          defaultValue={placementId}
                          onValueChange={(v) => corrigeer({ placementId: v })}
                          aria-label="Plaatsing"
                        >
                          <option value="" disabled>
                            Kies een plaatsing…
                          </option>
                          {plaatsingen.map((p) => (
                            <option key={p.id} value={p.id}>
                              {`${p.consultantNaam} — ${p.klantNaam ?? "— geen bedrijf"} · ${p.functie}`}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field
                        label="Week (uit de gewerkte dagen)"
                        htmlFor="weekStart"
                        hint={
                          weekUitFilter
                            ? "Deze staat noemt zelf geen week; we beginnen bij de week die je bovenaan koos. Klopt dat niet, kies dan een dag uit de juiste week."
                            : "Kies een dag uit de week — wij houden altijd de maandag van die ISO-week aan."
                        }
                        required
                      >
                        <DateInput
                          id="weekStart"
                          weekMode
                          value={canoniekeWeekStart || weekStart}
                          onValueChange={(v) => corrigeer({ weekStart: v })}
                        />
                      </Field>
                    </div>

                    <div className="mt-4">
                      <span className="mb-1.5 block text-[13px] font-medium text-ink-600">
                        Uren per dag
                      </span>
                      <div className="grid grid-cols-7 gap-1.5">
                        {DAG_LABELS.map((label, i) => {
                          const weekend = i >= 5;
                          const dag = maandag ? new Date(maandag.getTime() + i * DAG_MS) : null;
                          return (
                            <div key={label}>
                              <label
                                htmlFor={`dag_${i}`}
                                className={cn(
                                  "mb-1 block text-center text-[11px]",
                                  weekend ? "font-semibold text-brand-600" : "text-ink-400",
                                )}
                              >
                                {label}
                                {dag ? ` ${dag.getDate()}` : ""}
                              </label>
                              <Input
                                id={`dag_${i}`}
                                type="number"
                                step="0.25"
                                min="0"
                                className={cn(
                                  "px-1.5 text-center tabular-nums",
                                  weekend && "bg-brand-50",
                                )}
                                value={dagUren[i] ?? ""}
                                onChange={(e) =>
                                  corrigeer({
                                    dagUren: dagUren.map((h, j) => (j === i ? e.target.value : h)),
                                  })
                                }
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className={cn("mt-4", VELD_GRID)}>
                      <Field label="Overuren (apart vermeld)" htmlFor="overuren">
                        <Input
                          id="overuren"
                          type="number"
                          step="0.25"
                          min="0"
                          className="tabular-nums"
                          value={overuren}
                          onChange={(e) => corrigeer({ overuren: e.target.value })}
                        />
                      </Field>
                      <Field label="Kilometers" htmlFor="kilometers">
                        <Input
                          id="kilometers"
                          type="number"
                          step="1"
                          min="0"
                          className="tabular-nums"
                          value={kilometers}
                          onChange={(e) => corrigeer({ kilometers: e.target.value })}
                        />
                      </Field>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <Badge color={totaalUren > 0 ? "green" : "amber"}>
                        {formatHours(totaalUren)} reguliere uren
                      </Badge>
                      {parseHours(overuren) > 0 && (
                        <Badge color="green">{formatHours(parseHours(overuren))} overuren</Badge>
                      )}
                      <Badge color="blue">{formatHours(parseHours(kilometers))} km</Badge>
                      {geld && geld.weekendHours > 0 && (
                        <Badge color="orange">{formatHours(geld.weekendHours)} weekenduren</Badge>
                      )}
                    </div>

                    <p className="mt-3 flex items-start gap-1.5 text-[13px] text-ink-500">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                      <span>
                        Kloppen de uren? Pas ze hierboven aan als iets niet klopt, of{" "}
                        <Link
                          href={`/verwerken/week/${gekozen.id}/mail`}
                          className="font-semibold text-brand-700 underline underline-offset-2"
                        >
                          meld een fout bij de freelancer
                        </Link>
                        .
                      </span>
                    </p>
                  </div>
                </div>
              </>
            )}

            <div className="flex items-center justify-between gap-3 border-t border-ink-100 pt-4">
              <Link href="/verwerken/week" className={buttonVariants({ variant: "ghost" })}>
                Annuleren
              </Link>
              <Button type="button" onClick={() => ga(2)} disabled={!klaarVoorAkkoord}>
                Volgende: factuur <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
            {gekozen && !klaarVoorAkkoord && (
              <p className="text-right text-xs text-amber-700">
                Vul eerst een plaatsing, de week en minimaal één dag met uren in.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* ================= STAP 2 ================= */}
      {stap === 2 && (
        <Card>
          <CardContent className="space-y-5">
            <div>
              <h2 className="text-[15px] font-bold text-ink-900">
                Stap 2 · Factuur van de freelancer erin
              </h2>
              <p className={INTRO}>
                Dit is <strong className="font-semibold text-ink-700">zijn eigen factuur</strong> =
                jullie inkoop. Sleep &apos;m erin; de AI leest factuurnummer, bedrag en periode uit
                en controleert of het klopt met de uren. Nog niet binnen? Dan sla je deze stap over.
              </p>
            </div>

            <form action={invAction} className="space-y-3">
              <Dropzone
                name="file"
                accept={FACTUUR_ACCEPT}
                label="Sleep de factuur hierheen"
                hint="PDF of Excel · geen aparte inkoopfactuur nodig — deze telt als inkoop"
              />
              <div className="flex justify-end">
                <SubmitButton variant="outline" pendingLabel="AI leest…">
                  <Sparkles className="h-4 w-4" /> Factuur uitlezen
                </SubmitButton>
              </div>
            </form>

            {invState.error && (
              <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
                {invState.error}
              </p>
            )}
            {invState.waarschuwing && (
              <p className="flex items-start gap-2 rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{invState.waarschuwing}</span>
              </p>
            )}

            {factuurAfwijking && (
              <WeekAfwijkingNote melding={weekMismatchLabel(factuurAfwijking)} />
            )}

            {factuur && (
              // Zijn factuur links, de uitgelezen bedragen rechts — zo liggen de
              // getallen en het document naast elkaar. Zonder voorbeeld (bestand
              // niet leesbaar) blijft het paneel gewoon over de volle breedte.
              <div className={factuurSrc ? SPLIT : "grid gap-5"}>
                {factuurSrc && factuurBestand && (
                  <DocumentViewer
                    src={factuurSrc}
                    mimeType={factuurBestand.mimeType}
                    originalName={factuurBestand.originalName}
                    titel="Zijn factuur"
                    hoogte={DOC_HOOGTE}
                  />
                )}

                <div className="rounded-md border border-ink-100 p-4">
                  <h3 className={cn("mb-3", KOPJE)}>Uitgelezen door AI — controleer de factuur</h3>

                  <div className={VELD_GRID}>
                    <Field label="Factuurnummer" htmlFor="nummerVeld">
                      <Input
                        id="nummerVeld"
                        value={factuur.number}
                        onChange={(e) => zetFactuur({ ...factuur, number: e.target.value })}
                      />
                    </Field>
                    <Field label="Factuurdatum" htmlFor="datumVeld">
                      <DateInput
                        id="datumVeld"
                        value={factuur.issueDate}
                        onValueChange={(v) => zetFactuur({ ...factuur, issueDate: v })}
                      />
                    </Field>
                    <Field label="Periode van" htmlFor="periodeStartVeld">
                      <DateInput
                        id="periodeStartVeld"
                        value={factuur.periodStart}
                        onValueChange={(v) => zetFactuur({ ...factuur, periodStart: v })}
                      />
                    </Field>
                    <Field label="Periode t/m" htmlFor="periodeEindVeld">
                      <DateInput
                        id="periodeEindVeld"
                        value={factuur.periodEnd}
                        onValueChange={(v) => zetFactuur({ ...factuur, periodEnd: v })}
                      />
                    </Field>
                    <Field
                      label="Totaalbedrag"
                      htmlFor="bedragVeld"
                      hint="Zoals op zijn factuur — inclusief btw als die berekend is."
                      required
                    >
                      <Input
                        id="bedragVeld"
                        inputMode="decimal"
                        className="tabular-nums"
                        placeholder="0,00"
                        value={factuur.amount}
                        onChange={(e) => zetFactuur({ ...factuur, amount: e.target.value })}
                      />
                    </Field>
                    <Field label="Btw-bedrag" htmlFor="btwVeld" hint="Leeg laten bij verlegde btw.">
                      <Input
                        id="btwVeld"
                        inputMode="decimal"
                        className="tabular-nums"
                        value={factuur.vatAmount}
                        onChange={(e) => zetFactuur({ ...factuur, vatAmount: e.target.value })}
                      />
                    </Field>
                    <Field label="Kilometers op de factuur" htmlFor="factuurKmVeld">
                      <Input
                        id="factuurKmVeld"
                        inputMode="decimal"
                        className="tabular-nums"
                        value={factuur.kilometers}
                        onChange={(e) => zetFactuur({ ...factuur, kilometers: e.target.value })}
                      />
                    </Field>
                    <Field
                      label="Notitie"
                      htmlFor="notitieVeld"
                      className="sm:col-span-2 xl:col-span-1 2xl:col-span-2"
                    >
                      <Textarea
                        id="notitieVeld"
                        rows={2}
                        value={factuur.notes}
                        onChange={(e) => zetFactuur({ ...factuur, notes: e.target.value })}
                      />
                    </Field>
                  </div>

                  <div className="mt-4">
                    <KV
                      k={`${formatHours(totaalUren)} uur × ${formatCurrency(plaatsing?.config.costRate ?? 0)} inkoop (verwacht)`}
                      v={geld ? formatCurrency(geld.buy.total) : "—"}
                    />
                    <KV
                      k="Zijn factuur (excl. btw)"
                      v={factuurExcl != null ? formatCurrency(factuurExcl) : "—"}
                      sterk
                    />
                  </div>

                  <div
                    className={cn(
                      "mt-3 flex items-start gap-2 rounded-md border p-3 text-sm font-medium",
                      match.status === "klopt"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                        : match.status === "afwijking"
                          ? "border-amber-200 bg-amber-50 text-amber-800"
                          : "border-ink-200 bg-ink-50 text-ink-600",
                    )}
                  >
                    {match.status === "klopt" ? (
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    )}
                    <span>{match.message}</span>
                  </div>

                  {parseHours(factuur.kilometers) > 0 && parseHours(kilometers) <= 0 && (
                    <p className="mt-2 text-xs text-ink-500">
                      Er staan {formatHours(parseHours(factuur.kilometers))} km op zijn factuur,
                      maar niet op de urenstaat. Vul ze in stap 1 in als ze doorbelast moeten
                      worden.
                    </p>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
              <Button type="button" variant="outline" onClick={() => ga(1)}>
                <ArrowLeft className="h-4 w-4" /> Terug
              </Button>
              <div className="flex items-center gap-2">
                {!factuur && (
                  <Button type="button" variant="ghost" onClick={() => ga(3)}>
                    Overslaan — factuur komt later
                  </Button>
                )}
                <Button type="button" onClick={() => ga(3)} disabled={!klaarVoorAkkoord}>
                  Volgende: controle <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ================= STAP 3 ================= */}
      {stap === 3 && (
        <Card>
          <CardContent className="space-y-5">
            <div>
              <h2 className="text-[15px] font-bold text-ink-900">Stap 3 · Controle &amp; akkoord</h2>
              <p className={INTRO}>
                Alles op een rij. Klopt het? Eén klik legt de uren vast, registreert zijn factuur als
                inkoop én maakt de verkoopfactuur naar de klant klaar.
              </p>
            </div>

            {/* Vier panelen: 2×2 op een gewoon scherm, in één rij als het past. */}
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Paneel titel="Uren">
                <KV k="Reguliere uren" v={formatHours(totaalUren)} />
                <KV k="Overuren" v={formatHours(parseHours(overuren))} />
                <KV k="Kilometers" v={formatHours(parseHours(kilometers))} />
                <div className="mt-2">
                  <Badge color="green">urenstaat wordt geaccepteerd</Badge>
                </div>
              </Paneel>

              <Paneel titel="Inkoop — zijn factuur">
                {factuur && factuurExcl != null ? (
                  <>
                    <KV
                      k={`Factuur ${factuur.number || "(zonder nummer)"}`}
                      v={formatCurrency(factuurExcl)}
                    />
                    <KV k="Status" v="gecontroleerd" />
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge color="green">→ komt bij Ontvangen facturen</Badge>
                      {match.status === "afwijking" && (
                        <Badge color="amber">wijkt af van de uren</Badge>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-ink-500">
                      Er is nog geen factuur van de freelancer aangeleverd. Je kunt gewoon door — de
                      inkoop registreer je later bij Ontvangen facturen.
                    </p>
                    <div className="mt-2">
                      <Badge color="amber">factuur ontbreekt nog</Badge>
                    </div>
                  </>
                )}
              </Paneel>

              <Paneel
                titel={`Verkoop — naar klant${plaatsing?.klantNaam ? ` (${plaatsing.klantNaam})` : ""}`}
              >
                {geld && plaatsing ? (
                  <>
                    <KV
                      k={`${formatHours(geld.hours)} uur × ${formatCurrency(plaatsing.config.chargeRate)}`}
                      v={formatCurrency(geld.sell.base)}
                    />
                    {geld.sell.weekend > 0 && (
                      <KV
                        k={`Weekendtoeslag ${formatPercent(plaatsing.config.weekendSurchargeSell)}`}
                        v={formatCurrency(geld.sell.weekend)}
                      />
                    )}
                    {geld.sell.overtime > 0 && (
                      <KV
                        k={`Overuren (${formatPercent(plaatsing.config.overtimeSurchargeSell)} toeslag)`}
                        v={formatCurrency(geld.sell.overtime)}
                      />
                    )}
                    {geld.sell.km > 0 && (
                      <KV
                        k={`${formatHours(geld.kilometers)} km × ${formatCurrency(plaatsing.config.kmRateSell)}`}
                        v={formatCurrency(geld.sell.km)}
                      />
                    )}
                    <KV k="Verkoopfactuur (excl.)" v={formatCurrency(geld.sell.total)} sterk />
                    <div className="mt-2">
                      <Badge color={plaatsing.klantId ? "blue" : "amber"}>
                        {plaatsing.klantId
                          ? "→ concept naar de klant"
                          : "geen klant gekoppeld — geen factuur"}
                      </Badge>
                    </div>
                    {/* Vóór het akkoord bestaat de factuurrij nog niet, dus er valt
                        ook nog geen PDF te tonen — wél alvast zeggen dat hij komt. */}
                    {plaatsing.klantId && (
                      <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-500">
                        <FileDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ink-400" />
                        <span>Na akkoord krijg je de Q4S-verkoopfactuur als PDF.</span>
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-ink-500">
                    Nog geen uren of plaatsing — ga terug naar stap 1.
                  </p>
                )}
              </Paneel>

              <Paneel titel="Jouw marge" accent>
                <KV
                  k="Verkoop − inkoop"
                  v={
                    geld && inkoop != null
                      ? `${formatCurrency(geld.sell.total)} − ${formatCurrency(inkoop)}`
                      : "—"
                  }
                />
                <KV
                  k="Marge deze week"
                  v={weekMarge != null ? formatCurrency(weekMarge) : "—"}
                  sterk
                />
                <div className="mt-2">
                  <Badge color={margeBadge.color}>{margeBadge.label}</Badge>
                </div>
              </Paneel>
            </div>

            {verwerkState.error && (
              <p className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
                {verwerkState.error}
              </p>
            )}

            {verwerkState.bestaand && <BestaandeWeekPaneel bestaand={verwerkState.bestaand} />}

            {/* Deze week is al verwerkt: hieronder vervalt het akkoord en wijst
                de knop naar de urenstaat die er al gereed staat. */}
            {gereed && <GereedNote naam={persoonNaam} gereed={gereed} />}

            <form action={verwerkAction}>
              {/* Alles wat de mens hierboven heeft goedgekeurd, mee de server op. */}
              <input type="hidden" name="inboxId" value={gekozen?.id ?? ""} />
              <input type="hidden" name="placementId" value={placementId} />
              {/* De canonieke maandag — wat het scherm toont, gaat ook de urenstaat
                  in (parseConfirmInput trekt 'm nog eens naar de maandag; dat mag
                  hier geen verschil meer maken). */}
              <input type="hidden" name="weekStart" value={canoniekeWeekStart} />
              {dagUren.map((h, i) => (
                <input key={i} type="hidden" name={`hours_${i}`} value={h} />
              ))}
              <input type="hidden" name="overtimeHours" value={overuren} />
              <input type="hidden" name="kilometers" value={kilometers} />
              <input
                type="hidden"
                name="inkoopBedrag"
                value={inkoop != null ? String(inkoop) : ""}
              />
              {factuur && factuurBedrag !== null && (
                <>
                  <input type="hidden" name="factuurAanwezig" value="on" />
                  <input type="hidden" name="factuurNummer" value={factuur.number} />
                  <input type="hidden" name="factuurDatum" value={factuur.issueDate} />
                  <input type="hidden" name="factuurPeriodeStart" value={factuur.periodStart} />
                  <input type="hidden" name="factuurPeriodeEind" value={factuur.periodEnd} />
                  <input type="hidden" name="factuurBedrag" value={factuur.amount} />
                  <input type="hidden" name="factuurBtw" value={factuur.vatAmount} />
                  <input type="hidden" name="factuurKilometers" value={factuur.kilometers} />
                  <input type="hidden" name="factuurNotities" value={factuur.notes} />
                  <input
                    type="hidden"
                    name="factuurBestand"
                    value={factuurBestand?.fileName ?? ""}
                  />
                  <input
                    type="hidden"
                    name="factuurBestandsnaam"
                    value={factuurBestand?.originalName ?? ""}
                  />
                  <input type="hidden" name="factuurMime" value={factuurBestand?.mimeType ?? ""} />
                  <input
                    type="hidden"
                    name="factuurGrootte"
                    value={String(factuurBestand?.size ?? "")}
                  />
                </>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-100 pt-4">
                <Button type="button" variant="outline" onClick={() => ga(2)}>
                  <ArrowLeft className="h-4 w-4" /> Terug
                </Button>
                {gereed ? (
                  // Al gedaan: geen tweede akkoord, alleen de weg ernaartoe.
                  <Link
                    href={`/uren/${gereed.id}`}
                    className={buttonVariants({ variant: "outline", size: "lg" })}
                  >
                    <FileText className="h-4 w-4" /> Al verwerkt — bekijk urenstaat
                  </Link>
                ) : (
                  <SubmitButton
                    variant="success"
                    size="lg"
                    disabled={!klaarVoorAkkoord}
                    pendingLabel="Verwerken…"
                  >
                    <CheckCircle2 className="h-4 w-4" /> Akkoord — verwerk deze week
                  </SubmitButton>
                )}
              </div>
            </form>

            <p className="flex items-start gap-2 rounded-md bg-ink-50 px-4 py-3 text-xs leading-relaxed text-ink-500">
              <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
              <span>
                Niets wordt automatisch verstuurd. De verkoopfactuur blijft een{" "}
                <strong>concept</strong> tot jij &apos;m verstuurt, en er wordt niets betaald. Q4S
                maakt géén eigen inkoopfactuur: de factuur die de freelancer zelf stuurt ís de
                inkoop.
              </span>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
