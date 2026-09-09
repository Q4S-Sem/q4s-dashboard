import { distributeDayHours, formatHours, parseHours, type DayHours } from "@/lib/utils";
import { CORRECTION_FIELDS, type CorrectionField } from "@/lib/timesheet-correction-core";
import type { SurchargeConfig } from "@/lib/toeslag";
import type { GereedPerPlaatsing } from "@/lib/urenstaat-gereed";
import type { WeekSlot } from "@/lib/week-koppeling";
import type { PersonenOverzicht, PersoonRij } from "@/lib/wizard-personen";
import { weekstaatWeekKey, type WeekKeuze } from "@/lib/wizard-weekfilter";

// ---------------------------------------------------------------------------
// De platte vorm waarin de wizard "Week verwerken" zijn gegevens rondstuurt:
// van de server-pagina naar het client-scherm, en van de client terug naar de
// server-actions. Bewust losse, serialiseerbare velden (strings/getallen) —
// Prisma-objecten en Date's gaan niet over de client-grens.
//
// PUUR: geen Prisma, geen "use server". Zowel de pagina (openstaande inbox-items)
// als de upload-actie (net binnengekomen bestand) mappen via dezelfde functie,
// zodat een gekozen en een geüploade timesheet in het scherm identiek zijn.
// ---------------------------------------------------------------------------

export const LEGE_DAGUREN: string[] = ["", "", "", "", "", "", ""];

/**
 * Het concept-vangnet: de uren zoals de mens ze in het controle-scherm had staan
 * toen hij wegklikte. Debounced weggeschreven door `bewaarConcept` (./actions.ts)
 * en bij terugkomst LEIDEND boven de kale AI-uitlezing — anders was elke
 * handmatige correctie kwijt na een refresh.
 */
export type WizardConcept = {
  dagUren: string[];
  overuren: string;
  kilometers: string;
  placementId: string;
  weekStart: string;
};

/**
 * Eén correctie die de scan op basis van eerdere weken van deze plaatsing al
 * heeft toegepast. Het scherm toont ze bovenaan het controle-paneel: geleerde
 * correcties gaan nooit stilzwijgend door.
 */
export type GeleerdeCorrectie = {
  field: CorrectionField;
  /** Wat de AI nu las. */
  from: number;
  /** Wat we op basis van eerdere correcties hebben ingevuld. */
  to: number;
  /** De Nederlandse uitleg erbij. */
  reason: string;
};

/** Eén openstaande weekstaat uit de timesheet-inbox, klaar voor stap 1. */
export type WizardTimesheet = {
  /** TimesheetInbox.id — waar confirmInboxItem straks mee werkt. */
  id: string;
  originalName: string;
  /** Content-type zoals opgeslagen — bepaalt hoe het voorbeeld getoond wordt. */
  mimeType: string;
  /** "Upload" of het e-mailadres van de afzender. */
  bron: string;
  /** Wanneer binnengekomen, als "YYYY-MM-DD" (leeg = onbekend). */
  ontvangen: string;
  /** NEW = nog niet uitgelezen, EXTRACTED = door de AI gelezen. */
  status: string;
  /** Zette het uitlees-vangnet er een vlag op? */
  needsReview: boolean;
  aiNotes: string | null;
  /** Naam zoals gematcht of uitgelezen. */
  naam: string;
  consultantId: string | null;
  /** Best-effort gematchte plaatsing (leeg = de mens kiest zelf). */
  placementId: string;
  /** Maandag als "YYYY-MM-DD" (leeg = niet gevonden). */
  weekStart: string;
  /**
   * Het weeknummer zoals het op de STUKKEN getypt staat (koptekst of
   * bestandsnaam), of null als er geen staat. Dit is nadrukkelijk NIET de
   * waarheid — die volgt uit `weekStart`/de gewerkte dagen (zie
   * src/lib/week-koppeling.ts). Alleen om een afwijking te kunnen melden.
   */
  getypteWeek: number | null;
  /** Uren per dag Ma..Zo als tekst ("" = die dag niets). */
  dagUren: string[];
  overuren: string;
  kilometers: string;
  /** Eerder handmatig gecorrigeerde uren van deze week; null = alleen de AI. */
  concept: WizardConcept | null;
  /** Wat de scan op basis van eerdere correcties al heeft bijgesteld. */
  geleerd: GeleerdeCorrectie[];
};

/**
 * De weekstrook per persoon: welke weken tonen we, en welke daarvan zijn voor
 * een plaatsing al verwerkt (er ligt een goedgekeurde/gefactureerde urenstaat).
 *
 * Bewust op de SERVER gevuld en als platte sleutels doorgegeven: zo hangt de
 * strook niet aan een `new Date()` in de browser (dat zou client en server uit
 * elkaar laten lopen) en blijft het één query voor alle plaatsingen samen.
 */
export type WizardWeekstrook = {
  /** De weken van de strook, oudste eerst. */
  weken: WeekSlot[];
  /** placementId → weeksleutels ("2026-W34") die al verwerkt zijn. */
  verwerktPerPlaatsing: Record<string, string[]>;
  /**
   * Dezelfde weken, maar mét de urenstaat die er al gereed staat: placementId →
   * weeksleutel → {@link GereedPerPlaatsing}. Daarmee kan het scherm vóór het
   * akkoord melden "Er staat al een urenstaat gereed voor … — week …" en er
   * meteen naartoe linken, in plaats van de week nog eens te verwerken.
   * Samengesteld door `bouwGereedPerPlaatsing` (src/lib/urenstaat-gereed.ts).
   */
  gereedPerPlaatsing: GereedPerPlaatsing;
};

/**
 * De weekfilter boven de personenlijst: uit welke weken kies je, welke loopt er
 * nu, en met welke week begint de eigenaar?
 *
 * Net als de weekstrook op de SERVER bepaald en als platte sleutels doorgegeven
 * — het scherm heeft dus geen eigen `new Date()` nodig. Het samenstellen zelf is
 * puur en getest: `bouwWeekKeuzes`/`standaardWeek` in src/lib/wizard-weekfilter.ts.
 */
export type WizardWeekkeuze = {
  /** De kiesbare weken, nieuwste eerst, met het aantal open staten per week. */
  weken: WeekKeuze[];
  /** De lopende week ("2026-W37"); "" als er geen weken zijn. */
  huidig: string;
  /** Voorgeselecteerd: de recentste week met open staten, anders de lopende. */
  standaard: string;
};

/** Eén actieve plaatsing + alles wat er aan tarieven/toeslagen bij hoort. */
export type WizardPlaatsing = {
  id: string;
  consultantId: string;
  consultantNaam: string;
  klantId: string | null;
  klantNaam: string | null;
  functie: string;
  /** Exact de config waarmee invoicing.ts de echte factuur rekent. */
  config: SurchargeConfig;
};

/**
 * Eén persoon in de keuzelijst van stap "Kies de persoon": zijn plaatsing(en) en
 * zijn openstaande weken bij elkaar. Het groeperen zelf is puur en getest —
 * `bouwPersoonRijen` in src/lib/wizard-personen.ts; dit zijn alleen de namen
 * waarmee de wizard eraan refereert.
 */
export type WizardPersoon = PersoonRij<WizardPlaatsing, WizardTimesheet>;
export type WizardPersonen = PersonenOverzicht<WizardPlaatsing, WizardTimesheet>;

/** Een opgeslagen upload, doorgegeven tot aan het akkoord. */
export type WizardBestand = {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
};

/** De bewerkbare factuurvelden van stap 2 (alles tekst — het formulier vult ze). */
export type FactuurVelden = {
  number: string;
  issueDate: string;
  periodStart: string;
  periodEnd: string;
  /** Bedrag zoals op zijn factuur (incl. btw als die berekend is). */
  amount: string;
  vatAmount: string;
  kilometers: string;
  notes: string;
};

export const LEGE_FACTUUR: FactuurVelden = {
  number: "",
  issueDate: "",
  periodStart: "",
  periodEnd: "",
  amount: "",
  vatAmount: "",
  kilometers: "",
  notes: "",
};

// --- Antwoorden van de drie server-actions ---------------------------------

export type TimesheetLeesState = {
  error?: string;
  /** De AI kon (nog) niet lezen — het bestand staat er wel, vul zelf aan. */
  waarschuwing?: string;
  item?: WizardTimesheet;
};

export type FactuurLeesState = {
  error?: string;
  waarschuwing?: string;
  values?: FactuurVelden;
  bestand?: WizardBestand;
  /** Uren/tarief zoals ZIJN factuur ze noemt (alleen ter informatie). */
  factuurUren?: number;
  factuurTarief?: number;
  /** Weeknummer zoals op zijn factuur/bestandsnaam getypt; null = niet vermeld. */
  getypteWeek?: number | null;
  /** Id van de ReceivedInvoice die bij het uitlezen al is klaargezet (status NEW),
   *  zodat hij meteen in "Ontvangen facturen" staat en het akkoord dezelfde rij
   *  bijwerkt i.p.v. een dubbele te maken. Leeg = (nog) niet geregistreerd. */
  ontvangenId?: string;
};

export type VerwerkResultaat = {
  consultantNaam: string;
  klantNaam: string | null;
  weekLabel: string;
  uren: number;
  verkoop: number;
  inkoop: number | null;
  marge: number | null;
  urenstaatId: string;
  /** Nummer van de aangemaakte CONCEPT-verkoopfactuur (null = niet gemaakt). */
  verkoopFactuurNummer: string | null;
  verkoopFactuurId: string | null;
  ontvangenFactuurId: string | null;
  /** Wat er niet lukte of aandacht vraagt — 1-op-1 te tonen. */
  waarschuwingen: string[];
};

/**
 * Er lag al een urenstaat voor deze plaatsing + week (de @@unique sloeg toe).
 *
 * De wizard liep hier vroeger dood op een rode regel. Nu komt dit blokje mee
 * terug, zodat het scherm kan laten zien WELKE week er al lag en de eigenaar de
 * keuze kan geven: die bestaande urenstaat gebruiken, of hem weggooien en de
 * week opnieuw doen. Het oordeel zelf is puur en getest —
 * `beoordeelBestaandeUrenstaat` in src/lib/urenstaat-hergebruik.ts.
 */
export type BestaandeUrenstaat = {
  /** Timesheet.id van de urenstaat die er al lag. */
  id: string;
  weekLabel: string;
  consultantNaam: string;
  klantNaam: string | null;
  /** Reguliere uren van die bestaande week. */
  uren: number;
  /** DRAFT | SUBMITTED | APPROVED | INVOICED. */
  status: string;
  /** Staat hij al op een verkoopfactuur? Dan gebeurt er niets meer. */
  alGefactureerd: boolean;
  /** Nog op concept/ingediend — dan komt er nog geen verkoopfactuur uit. */
  eerstGoedkeuren: boolean;
  /** Mag de mens hem verwijderen (guard van deleteTimesheet)? */
  magVerwijderen: boolean;
  /** De verkoopfactuur waar deze week al op staat, om naartoe te linken. */
  factuurId: string | null;
  factuurNummer: string | null;
  /** De Nederlandse uitleg bij deze situatie. */
  reden: string;
};

export type VerwerkState = {
  error?: string;
  resultaat?: VerwerkResultaat;
  /** Gevuld zodra de week al een urenstaat had — zie {@link BestaandeUrenstaat}. */
  bestaand?: BestaandeUrenstaat;
};

// --- Mappers ---------------------------------------------------------------

/** Precies de TimesheetInbox-velden die de wizard nodig heeft. */
export type InboxRij = {
  id: string;
  originalName: string;
  mimeType: string;
  source: string;
  senderEmail: string | null;
  receivedAt: Date | null;
  createdAt: Date;
  status: string;
  needsReview: boolean;
  aiNotes: string | null;
  extractedName: string | null;
  extractedWeekStart: Date | null;
  extractedJson: string | null;
  extractedOvertimeHours: number | null;
  extractedKilometers: number | null;
  draftJson: string | null;
  learnedJson: string | null;
  consultantId: string | null;
  placementId: string | null;
  consultant: { firstName: string; lastName: string } | null;
};

/** Date → "YYYY-MM-DD" (het formaat van een date-input). Null → "". */
export function toDateInput(d: Date | null | undefined): string {
  if (!d) return "";
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return "";
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
}

/** De uitgelezen dag-uren over Ma..Zo verdelen (robuustheid zit in
 *  distributeDayHours) en als tekst teruggeven voor de invoervelden. */
function dagUrenVan(extractedJson: string | null, maandag: Date | null): string[] {
  if (!extractedJson) return [...LEGE_DAGUREN];
  try {
    const days = (JSON.parse(extractedJson) as { days?: DayHours[] }).days ?? [];
    return distributeDayHours(days, maandag).map((h) => (h === "" ? "" : String(h)));
  } catch {
    return [...LEGE_DAGUREN];
  }
}

/** Getal → invoerwaarde; 0 en null blijven leeg ("niet gemeld", niet "nul"). */
function getalVeld(value: number | null | undefined): string {
  return typeof value === "number" && value > 0 ? String(value) : "";
}

/**
 * Het bewaarde concept uitpakken. Onleesbaar of zonder complete week aan dagen →
 * null: dan blijft de AI-uitlezing gewoon de basis (een half concept is erger dan
 * geen concept).
 */
function conceptVan(draftJson: string | null): WizardConcept | null {
  if (!draftJson) return null;
  try {
    const d = JSON.parse(draftJson) as Partial<Record<keyof WizardConcept, unknown>>;
    if (!Array.isArray(d.dagUren) || d.dagUren.length !== 7) return null;
    return {
      dagUren: d.dagUren.map((h) => (h === null || h === undefined ? "" : String(h))),
      overuren: typeof d.overuren === "string" ? d.overuren : "",
      kilometers: typeof d.kilometers === "string" ? d.kilometers : "",
      placementId: typeof d.placementId === "string" ? d.placementId : "",
      weekStart: typeof d.weekStart === "string" ? d.weekStart : "",
    };
  } catch {
    return null;
  }
}

/** De toegepaste geleerde correcties uitpakken; onleesbare regels vallen weg. */
function geleerdVan(learnedJson: string | null): GeleerdeCorrectie[] {
  if (!learnedJson) return [];
  try {
    const rows = JSON.parse(learnedJson);
    if (!Array.isArray(rows)) return [];
    return rows.flatMap((r: unknown) => {
      const c = r as Partial<GeleerdeCorrectie>;
      if (!CORRECTION_FIELDS.includes(c?.field as CorrectionField)) return [];
      if (typeof c.from !== "number" || typeof c.to !== "number") return [];
      return [
        {
          field: c.field as CorrectionField,
          from: c.from,
          to: c.to,
          reason: typeof c.reason === "string" ? c.reason : "",
        },
      ];
    });
  } catch {
    return [];
  }
}

/**
 * Het RUWE weeknummer-veld uit de AI-uitlezing ("35", "week 35"), of "" als de
 * staat er geen noemde. Bewust alleen uitpakken, niet parsen: het parsen gebeurt
 * server-side met `parseWeekNumber` (src/lib/invoice-extract.ts) — die module
 * trekt Prisma en de AI-clients mee en hoort dus niet in de wizard-bundel.
 */
export function getypteWeekVeld(item: { extractedJson: string | null }): string {
  if (!item.extractedJson) return "";
  try {
    const week = (JSON.parse(item.extractedJson) as { weekNumber?: unknown }).weekNumber;
    if (typeof week === "string") return week.trim();
    if (typeof week === "number") return String(week);
    return "";
  } catch {
    return "";
  }
}

/**
 * Eén inbox-item naar de vorm die het wizard-scherm toont en bewerkt.
 *
 * @param getypteWeek Het weeknummer zoals op de stukken getypt (kop of
 *   bestandsnaam), door de server-aanroeper bepaald. Puur informatief — de week
 *   zelf blijft uit `weekStart` (de gewerkte dagen) komen.
 */
export function naarWizardTimesheet(
  item: InboxRij,
  getypteWeek: number | null = null,
): WizardTimesheet {
  const maandag = item.extractedWeekStart ? new Date(item.extractedWeekStart) : null;
  return {
    id: item.id,
    originalName: item.originalName,
    mimeType: item.mimeType,
    bron: item.source === "EMAIL" ? (item.senderEmail ?? "e-mail") : "upload",
    ontvangen: toDateInput(item.receivedAt ?? item.createdAt),
    status: item.status,
    needsReview: item.needsReview,
    aiNotes: item.aiNotes,
    naam: item.consultant
      ? `${item.consultant.firstName} ${item.consultant.lastName}`
      : (item.extractedName?.trim() || item.originalName),
    consultantId: item.consultantId,
    placementId: item.placementId ?? "",
    weekStart: toDateInput(maandag),
    getypteWeek,
    dagUren: dagUrenVan(item.extractedJson, maandag),
    overuren: getalVeld(item.extractedOvertimeHours),
    kilometers: getalVeld(item.extractedKilometers),
    concept: conceptVan(item.draftJson),
    geleerd: geleerdVan(item.learnedJson),
  };
}

// --- vanzelf openzetten ----------------------------------------------------

/**
 * Het minimum dat {@link autoSelectTimesheet} van een weekstaat nodig heeft:
 * welke week het is, of hij al uitgelezen is, en of er uren in staan.
 */
export type AutoKiesBasis = {
  /** NEW = nog niet uitgelezen; al het andere is door de AI gelezen. */
  status: string;
  /** Maandag als "YYYY-MM-DD" (leeg = geen week bekend). */
  weekStart?: string | null;
  /** Uren per dag Ma..Zo als tekst ("" = die dag niets). */
  dagUren?: readonly string[] | null;
};

/** Is deze staat uitgelezen én staan er ook echt uren in? */
function isUitgelezen(item: AutoKiesBasis): boolean {
  if (item.status === "NEW") return false;
  return (item.dagUren ?? []).some((uren) => parseHours(uren) > 0);
}

/**
 * De weekstaat die stap 1 vanzelf mag openzetten. Ligt er voor de week die de
 * eigenaar bovenaan koos precies ÉÉN staat klaar en is die al uitgelezen, dan
 * hoeft hij die regel niet eerst nog eens aan te klikken: de uren staan er al,
 * dus hij kan meteen door naar de factuur.
 *
 * Bewust terughoudend — vanzelf openen mag nooit een keuze wegnemen:
 * - geen gekozen week, of niets in die week → null;
 * - MEER dan één staat in die week → null (welke zou het moeten zijn?);
 * - nog niet uitgelezen (NEW) of zonder uren → null (daar moet de mens bij).
 *
 * De week wordt hier alleen AFGELEZEN (weekstaatWeekKey → weekSlotVanDatum);
 * wat er vastgelegd wordt blijft uit de gewerkte dagen komen. Puur en getest:
 * tests/wizard-autokies.test.ts.
 */
export function autoSelectTimesheet<T extends AutoKiesBasis>(
  items: readonly T[] | null | undefined,
  week: string | null | undefined,
): T | null {
  if (!week) return null;
  const vanDeWeek = (items ?? []).filter((item) => item && weekstaatWeekKey(item) === week);
  if (vanDeWeek.length !== 1) return null;
  return isUitgelezen(vanDeWeek[0]) ? vanDeWeek[0] : null;
}

/** Korte samenvatting onder een inbox-regel: "32 u · week van 24-08-2026". */
export function inboxSamenvatting(item: WizardTimesheet): string {
  const uren = item.dagUren.reduce((som, h) => som + (Number(h) || 0), 0);
  const delen: string[] = [];
  if (uren > 0) delen.push(`${formatHours(uren)} u`);
  if (item.weekStart) delen.push(`week van ${item.weekStart.split("-").reverse().join("-")}`);
  delen.push(item.bron);
  return delen.join(" · ");
}
