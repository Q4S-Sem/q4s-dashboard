import type { GateFlag } from "./timesheet-auto-gate";
import { controleLabel, initialen } from "./weekverwerking";

// ---------------------------------------------------------------------------
// Weekverwerking — de pure hulpstukken onder de compacte controlelijst en de
// detailpagina per persoon (/verwerken/week + /verwerken/week/[id]).
//
//   1) magScanVerwijderen — mag de RUWE scan (het inbox-item + het bestand) weg?
//      Alleen als er nog geen urenstaat aan hangt: een goedgekeurde of
//      gefactureerde week raken we hier nooit aan.
//   2) veiligTerugPad     — waar je na het verwijderen terechtkomt; alleen een
//      pad binnen de app, nooit een adres van buiten.
//   3) bouwControleRegel  — één regel van de lijst "Te controleren": naam, week,
//      uren, verkoop en de badges, klaar om te tonen.
//
// PUUR en DETERMINISTISCH, net als src/lib/weekverwerking.ts: geen Prisma, geen
// datum-van-nu, geen I/O. Er wordt hier NIETS gerekend aan bedragen — die komen
// kant-en-klaar uit computeTimesheetMoney (src/lib/toeslag.ts) mee.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 1) Mag deze scan weg?
// ---------------------------------------------------------------------------

/** Inbox-statussen waarbij er nog niets geboekt is (zie INBOX_STATUSES). */
const VERWIJDERBARE_STATUS = new Set(["NEW", "EXTRACTED", "REJECTED"]);

export type ScanVerwijderInvoer = {
  /** TimesheetInbox.status — NEW | EXTRACTED | CONFIRMED | REJECTED. */
  status: string | null | undefined;
  /** De urenstaat die uit deze scan is ontstaan (null = nog geen). */
  timesheetId: string | null | undefined;
  /** Status van die urenstaat — DRAFT | SUBMITTED | APPROVED | INVOICED. */
  timesheetStatus: string | null | undefined;
};

export type ScanVerwijderOordeel = {
  mag: boolean;
  /** Waarom het wel of niet mag — precies de zin die het scherm toont. */
  reden: string;
};

/** Nette tekst als er al een urenstaat aan de scan hangt. */
function geboektReden(timesheetStatus: string): string {
  if (timesheetStatus === "INVOICED") {
    return "deze week staat al op een factuur — de scan hoort bij een geboekte factuurregel";
  }
  if (timesheetStatus === "APPROVED") {
    return "deze week is al goedgekeurd tot een urenstaat";
  }
  return "er hangt al een urenstaat aan deze scan";
}

/**
 * Mag deze binnengekomen scan verwijderd worden?
 *
 * Bewust behoudend: alleen een inbox-item dat nog nergens aan vastzit (NEW,
 * EXTRACTED of REJECTED, zonder gekoppelde urenstaat) mag weg. Alles wat al
 * bevestigd, goedgekeurd of gefactureerd is blijft staan — en een status die we
 * niet kennen ook, want dan weten we niet wat eraan hangt.
 */
export function magScanVerwijderen(invoer: ScanVerwijderInvoer): ScanVerwijderOordeel {
  const status = String(invoer?.status ?? "").trim().toUpperCase();
  const timesheetId = String(invoer?.timesheetId ?? "").trim();
  const timesheetStatus = String(invoer?.timesheetStatus ?? "").trim().toUpperCase();

  if (timesheetId || timesheetStatus) {
    return { mag: false, reden: geboektReden(timesheetStatus) };
  }
  if (status === "CONFIRMED") {
    return { mag: false, reden: "deze scan is al bevestigd tot een urenstaat" };
  }
  if (!VERWIJDERBARE_STATUS.has(status)) {
    return {
      mag: false,
      reden: "de status van deze scan is onbekend — voor de zekerheid blijft hij staan",
    };
  }
  return {
    mag: true,
    reden: "alleen het binnengekomen bestand verdwijnt; er is nog geen urenstaat of factuur van gemaakt",
  };
}

// ---------------------------------------------------------------------------
// 2) Waar je daarna heen gaat
// ---------------------------------------------------------------------------

/** Alles onder de spatie is een stuurteken en hoort niet in een pad. */
const LAAGSTE_TOEGESTANE_TEKEN = 32;

/**
 * Een terugkeer-pad dat door een formulier is meegestuurd, veilig maken: het
 * moet een pad BINNEN de app zijn. Alles wat naar buiten kan wijzen ("//host",
 * "https://…", een backslash) of wat witruimte of een regeleinde bevat valt
 * terug op de standaardbestemming.
 */
export function veiligTerugPad(pad: unknown, standaard: string): string {
  const tekst = typeof pad === "string" ? pad.trim() : "";
  if (!tekst.startsWith("/")) return standaard;
  if (tekst.startsWith("//") || tekst.startsWith("/\\")) return standaard;
  if (/\s/.test(tekst)) return standaard;
  if (Array.from(tekst).some((teken) => teken.charCodeAt(0) < LAAGSTE_TOEGESTANE_TEKEN)) {
    return standaard;
  }
  return tekst;
}

// ---------------------------------------------------------------------------
// 3) Eén compacte regel in de lijst "Te controleren"
// ---------------------------------------------------------------------------

/** De vaste badge-teksten, zodat lijst en detailpagina dezelfde woorden gebruiken. */
export const DUBBELE_WEEKSTAAT_LABEL = "dubbele weekstaat";
export const DUBBELE_FACTUUR_LABEL = "mogelijk dubbele factuur";
export const EERST_CORRIGEREN_LABEL = "eerst corrigeren";
export const WACHT_OP_MENS_LABEL = "wacht op mens";

/** Wat er onder de naam staat als de scan nog aan geen enkele klant hangt. */
const GEEN_KOPPELING = "— nog niet gekoppeld aan een klant";

/** Wat er in de weekkolom staat als de week niet uitgelezen is. */
const GEEN_WEEK = "week onbekend";

export type ControleBadge = { label: string; level: GateFlag["level"] };

/** Precies de velden van een GateReviewRow die de lijst nodig heeft. */
export type ControleRijInvoer = {
  id: string;
  name: string;
  placementTitle: string | null;
  clientName: string | null;
  weekLabel: string | null;
  totalHours: number | null;
  placementId: string | null;
  charge: number;
  flags: GateFlag[];
  duplicateExists: boolean;
  canApprove: boolean;
};

/** De twee detecties die naast de gate-vlaggen op de regel horen. */
export type ControleExtra = {
  /** "3e keer uren wijken af" — uit summarizeRecurringFaults. */
  herhalingLabel?: string | null;
  /** De medewerker stuurde mogelijk twee keer dezelfde factuur. */
  dubbeleFactuur?: boolean;
};

export type ControleRegel = {
  id: string;
  /** De detailpagina waar de hele regel naartoe linkt. */
  href: string;
  naam: string;
  initialen: string;
  /** "plaatsing · klant", of duidelijk: nog niet gekoppeld. */
  rol: string;
  weekLabel: string;
  uren: number | null;
  /** Verkoopbedrag van de week; null = geen tarief bekend. */
  verkoop: number | null;
  hardeFout: boolean;
  badges: ControleBadge[];
};

/**
 * Zet één te controleren week om in de regel zoals de lijst hem toont.
 *
 * De badges vertellen in vaste volgorde wat er aan de hand is: eerst het korte
 * fouttype van de gate (dezelfde badge als voorheen boven het uitgeklapte blok),
 * dan de dubbele weekstaat/factuur, dan de terugkerende fout, en tot slot of er
 * eerst iets gecorrigeerd moet worden. Blijft alles leeg, dan staat er in elk
 * geval dát er een mens naar moet kijken — een regel zonder badge zou suggereren
 * dat er niets te doen is.
 */
export function bouwControleRegel(
  rij: ControleRijInvoer,
  extra: ControleExtra = {},
): ControleRegel {
  const kop = controleLabel(rij.flags);
  const badges: ControleBadge[] = [];
  const voegToe = (label: string | null | undefined, level: GateFlag["level"]) => {
    const tekst = String(label ?? "").trim();
    if (!tekst) return;
    if (badges.some((b) => b.label === tekst)) return; // nooit twee keer hetzelfde
    badges.push({ label: tekst, level });
  };

  if (kop) voegToe(kop.label, kop.level);
  if (rij.duplicateExists) voegToe(DUBBELE_WEEKSTAAT_LABEL, "error");
  if (extra.dubbeleFactuur) voegToe(DUBBELE_FACTUUR_LABEL, "warn");
  voegToe(extra.herhalingLabel, "error");
  if (!rij.canApprove) voegToe(EERST_CORRIGEREN_LABEL, "error");
  if (badges.length === 0) voegToe(WACHT_OP_MENS_LABEL, "warn");

  return {
    id: rij.id,
    href: `/verwerken/week/${rij.id}`,
    naam: rij.name,
    initialen: initialen(rij.name),
    rol: [rij.placementTitle, rij.clientName].filter(Boolean).join(" · ") || GEEN_KOPPELING,
    weekLabel: rij.weekLabel ?? GEEN_WEEK,
    uren: rij.totalHours,
    verkoop: rij.placementId ? rij.charge : null,
    hardeFout: (Array.isArray(rij.flags) ? rij.flags : []).some((f) => f?.level === "error"),
    badges,
  };
}
