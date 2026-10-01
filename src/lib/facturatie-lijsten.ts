/**
 * De indeling van de twee lijstschermen van de facturatie: Verkoopfacturen
 * (/facturatie/verkoop) en Inkoop & betalingen (/facturatie/inkoop).
 *
 * PUUR — geen database, geen React. De tabbladen, hun tellers en de bulkacties
 * op de server draaien exact dezelfde predicaten, zodat "wat je ziet" en "wat er
 * gebeurt" nooit uit elkaar kunnen lopen.
 *
 * Er wordt hier NIETS besloten over geld of status: dit bestand sorteert alleen
 * bestaande rijen in bakjes.
 */

// ===========================================================================
// Verkoopfacturen
// ===========================================================================

export type VerkoopTab =
  | "alles"
  | "concept"
  | "klaar"
  | "verzonden"
  | "telaat"
  | "betaald"
  | "geannuleerd";

/** De tabbladen in schermvolgorde, met hun Nederlandse label. */
export const VERKOOP_TABS: { key: VerkoopTab; label: string }[] = [
  { key: "alles", label: "Alles" },
  { key: "concept", label: "Concept" },
  { key: "klaar", label: "Klaar om te verzenden" },
  { key: "verzonden", label: "Verzonden" },
  { key: "telaat", label: "Te laat" },
  { key: "betaald", label: "Betaald" },
  { key: "geannuleerd", label: "Geannuleerd" },
];

/** Alleen de ruwe status en de vervaldatum bepalen in welk bakje een factuur valt. */
export type VerkoopRij = {
  /** De RUWE status uit de database: DRAFT | READY | SENT | PAID | CANCELLED. */
  status: string;
  dueDate: Date | string;
};

function tijd(value: Date | string): number {
  const t = value instanceof Date ? value.getTime() : new Date(value).getTime();
  return Number.isFinite(t) ? t : 0;
}

/**
 * Te laat = verstuurd naar de klant én de vervaldatum is gepasseerd. Een concept
 * of een betaalde factuur is nooit te laat: daar valt niets te innen.
 */
export function isVerkoopTeLaat(row: VerkoopRij, now: Date): boolean {
  return row.status === "SENT" && tijd(row.dueDate) < now.getTime();
}

/**
 * De status zoals hij op het scherm hoort te staan: een verstuurde factuur over
 * de vervaldatum leest als "OVERDUE". Voor de badge, nooit voor een actie — die
 * kijken altijd naar de ruwe status.
 */
export function verkoopWeergaveStatus(row: VerkoopRij, now: Date): string {
  return isVerkoopTeLaat(row, now) ? "OVERDUE" : row.status;
}

/**
 * Hoort deze factuur bij dit tabblad? "Te laat" is bewust een DOORSNEDE van
 * "Verzonden" (dezelfde factuur staat in allebei) — zo mis je een te late
 * factuur niet doordat je op Verzonden klikt, en zie je hem apart als je er
 * achteraan wilt.
 */
export function hoortBijVerkoopTab(row: VerkoopRij, tab: VerkoopTab, now: Date): boolean {
  switch (tab) {
    case "alles":
      return true;
    case "concept":
      return row.status === "DRAFT";
    case "klaar":
      return row.status === "READY";
    case "verzonden":
      return row.status === "SENT";
    case "telaat":
      return isVerkoopTeLaat(row, now);
    case "betaald":
      return row.status === "PAID";
    case "geannuleerd":
      return row.status === "CANCELLED";
  }
}

/** Het aantal per tabblad — precies wat `hoortBijVerkoopTab` zou tonen. */
export function verkoopTellingen<T extends VerkoopRij>(
  rows: T[],
  now: Date,
): Record<VerkoopTab, number> {
  const out = {} as Record<VerkoopTab, number>;
  for (const tab of VERKOOP_TABS) {
    out[tab.key] = rows.filter((r) => hoortBijVerkoopTab(r, tab.key, now)).length;
  }
  return out;
}

// ===========================================================================
// Inkoop (de facturen die ZZP'ers zelf sturen)
// ===========================================================================

export type InkoopBucket = "controleren" | "tebetalen" | "betaald" | "afwijking";
export type InkoopTab = "alles" | InkoopBucket | "declaraties";

export const INKOOP_TABS: { key: InkoopTab; label: string }[] = [
  { key: "controleren", label: "Te controleren" },
  { key: "tebetalen", label: "Te betalen" },
  { key: "betaald", label: "Betaald" },
  { key: "afwijking", label: "Afwijking" },
  { key: "alles", label: "Alle facturen" },
  { key: "declaraties", label: "Declaraties" },
];

export type InkoopRij = {
  /** NEW | APPROVED | PAID | DISPUTED. */
  status: string;
  /** Klopt het bedrag met de urenstaat? null = (nog) niet te vergelijken. */
  matched: boolean | null;
};

/**
 * Elke ontvangen factuur zit in PRECIES ÉÉN bakje. De live vergelijking met de
 * urenstaat (`matched`, berekend in src/lib/received-invoices.ts) is leidend
 * bóven de opgeslagen status: een factuur die weer klopt schuift vanzelf naar
 * "te betalen", en een betaalde factuur valt nooit terug naar een afwijking.
 *
 *   PAID                           → betaald      (eindstation)
 *   DISPUTED, of matched === false → afwijking    (wacht op een nieuwe factuur)
 *   APPROVED                       → tebetalen    (goedgekeurd, mag naar SEPA)
 *   anders (NEW / geen periode)    → controleren  (eerst nakijken)
 */
export function inkoopBucket(row: InkoopRij): InkoopBucket {
  if (row.status === "PAID") return "betaald";
  if (row.status === "DISPUTED" || row.matched === false) return "afwijking";
  if (row.status === "APPROVED") return "tebetalen";
  return "controleren";
}

export function hoortBijInkoopTab(row: InkoopRij, tab: InkoopTab): boolean {
  if (tab === "declaraties") return false;
  if (tab === "alles") return true;
  return inkoopBucket(row) === tab;
}

/** Het aantal per tabblad. Declaraties tellen hier niet mee (andere bron). */
export function inkoopTellingen<T extends InkoopRij>(rows: T[]): Record<InkoopBucket | "alles", number> {
  return {
    alles: rows.length,
    controleren: rows.filter((r) => inkoopBucket(r) === "controleren").length,
    tebetalen: rows.filter((r) => inkoopBucket(r) === "tebetalen").length,
    betaald: rows.filter((r) => inkoopBucket(r) === "betaald").length,
    afwijking: rows.filter((r) => inkoopBucket(r) === "afwijking").length,
  };
}

/**
 * Mag deze ontvangen factuur mee in het SEPA-bestand? Alleen een goedgekeurde
 * factuur die ook écht klopt — een afwijking los je eerst op. Dit spiegelt wat
 * `buildSepaForPayables` (betalingen.ts) ophaalt, zodat de knop nooit meer belooft
 * dan er daadwerkelijk in het bestand komt.
 */
export function isInkoopBetaalbaar(row: InkoopRij): boolean {
  return inkoopBucket(row) === "tebetalen";
}
