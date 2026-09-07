import { distributeDayHours, formatHours, type DayHours } from "@/lib/utils";
import type { SurchargeConfig } from "@/lib/toeslag";

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

/** Eén openstaande weekstaat uit de timesheet-inbox, klaar voor stap 1. */
export type WizardTimesheet = {
  /** TimesheetInbox.id — waar confirmInboxItem straks mee werkt. */
  id: string;
  originalName: string;
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
  /** Uren per dag Ma..Zo als tekst ("" = die dag niets). */
  dagUren: string[];
  overuren: string;
  kilometers: string;
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

export type VerwerkState = {
  error?: string;
  resultaat?: VerwerkResultaat;
};

// --- Mappers ---------------------------------------------------------------

/** Precies de TimesheetInbox-velden die de wizard nodig heeft. */
export type InboxRij = {
  id: string;
  originalName: string;
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

/** Eén inbox-item naar de vorm die het wizard-scherm toont en bewerkt. */
export function naarWizardTimesheet(item: InboxRij): WizardTimesheet {
  const maandag = item.extractedWeekStart ? new Date(item.extractedWeekStart) : null;
  return {
    id: item.id,
    originalName: item.originalName,
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
    dagUren: dagUrenVan(item.extractedJson, maandag),
    overuren: getalVeld(item.extractedOvertimeHours),
    kilometers: getalVeld(item.extractedKilometers),
  };
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
