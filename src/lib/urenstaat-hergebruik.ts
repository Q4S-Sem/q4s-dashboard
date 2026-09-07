// ---------------------------------------------------------------------------
// ER LAG AL EEN URENSTAAT — wat mag er dan nog?
//
// De wizard "Week verwerken" (/verwerken/nieuw, stap 3) liep hier vroeger dood.
// confirmInboxItem botst op de @@unique(placementId, weekStart) van Timesheet,
// geeft "exists" terug, en de eigenaar kreeg een rode regel te zien waar niets
// meer op volgde: de inkoop bleef liggen, de verkoopfactuur kwam er niet, en de
// bestaande urenstaat was vanuit de wizard niet op te ruimen.
//
// Deze module beslist — puur, op de vier velden van de bestaande urenstaat — wat
// er wél kan:
//
//   • hergebruiken   — er is nog niets naar de klant gefactureerd, dus de inkoop
//                      en de verkoopfactuur mogen tegen de BESTAANDE urenstaat;
//   • al gefactureerd— hij staat al op een verkoopfactuur: dan gebeurt er niets,
//                      want dubbel factureren is het enige wat écht niet mag;
//   • verwijderen    — dezelfde guard als deleteTimesheet (src/app/(app)/uren/
//                      actions.ts): geen INVOICED, geen verkoop- én geen
//                      inkoopfactuurregel. Verwijderen blijft mensenwerk: deze
//                      module zegt alleen of de knop mág, nooit dat hij moet.
//
// PUUR, net als src/lib/week-detail.ts: geen Prisma, geen `new Date()`, geen
// I/O — zodat de server-action en de tests (tests/urenstaat-hergebruik.test.ts)
// exact hetzelfde uitrekenen. Er wordt hier niets gerekend aan bedragen en
// niets geschreven.
// ---------------------------------------------------------------------------

/** De enige status waarin createSalesInvoice een urenstaat accepteert. */
const GOEDGEKEURD = "APPROVED";
/** De status waarin de week al op een verkoopfactuur staat. */
const GEFACTUREERD = "INVOICED";

/** Precies de velden van de bestaande urenstaat die het oordeel aangaan. */
export type BestaandeUrenstaatInvoer = {
  /** Timesheet.status — DRAFT | SUBMITTED | APPROVED | INVOICED. */
  status: string | null | undefined;
  /** De verkoopfactuurregel die eraan hangt (leeg = nog niet gefactureerd). */
  verkoopRegelId?: string | null;
  /** De inkoopfactuurregel (self-billing) die eraan hangt (leeg = geen). */
  inkoopRegelId?: string | null;
};

export type BestaandeUrenstaatOordeel = {
  /** Staat deze week al op een verkoopfactuur? Dan nooit nog een keer. */
  alGefactureerd: boolean;
  /** Mag de wizard hem gebruiken voor de inkoop en de verkoopfactuur? */
  hergebruik: boolean;
  /** Staat hij nog op concept/ingediend? Dan komt er nog geen verkoopfactuur uit. */
  eerstGoedkeuren: boolean;
  /** Mag de mens hem verwijderen — exact de guard van deleteTimesheet. */
  magVerwijderen: boolean;
  /** Waarom; precies de zin die het scherm toont. */
  reden: string;
};

/** Leeg, spaties of null → "niets"; anders de opgeschoonde waarde. */
function gevuld(waarde: string | null | undefined): boolean {
  return String(waarde ?? "").trim() !== "";
}

/**
 * Beoordeel de urenstaat die er al lag voor deze plaatsing + week.
 *
 * Bewust behoudend aan de factuurkant en ruim aan de kant van de mens: alles wat
 * nog niet naar de klant gefactureerd is mag hergebruikt worden, en alles waar
 * nog geen enkele factuurregel aan hangt mag de eigenaar zelf weggooien.
 */
export function beoordeelBestaandeUrenstaat(
  invoer: BestaandeUrenstaatInvoer,
): BestaandeUrenstaatOordeel {
  const status = String(invoer?.status ?? "").trim().toUpperCase();
  const heeftVerkoopRegel = gevuld(invoer?.verkoopRegelId);
  const heeftInkoopRegel = gevuld(invoer?.inkoopRegelId);

  const alGefactureerd = status === GEFACTUREERD || heeftVerkoopRegel;
  const eerstGoedkeuren = !alGefactureerd && status !== GOEDGEKEURD;

  if (alGefactureerd) {
    return {
      alGefactureerd: true,
      hergebruik: false,
      eerstGoedkeuren: false,
      magVerwijderen: false,
      reden:
        "deze week staat al op een verkoopfactuur — er wordt niets dubbel gefactureerd en de urenstaat blijft staan",
    };
  }

  return {
    alGefactureerd: false,
    hergebruik: true,
    eerstGoedkeuren,
    magVerwijderen: !heeftInkoopRegel,
    reden: eerstGoedkeuren
      ? "er ligt al een urenstaat voor deze week, maar die is nog niet goedgekeurd — keur 'm eerst goed of verwijder 'm"
      : "er ligt al een goedgekeurde urenstaat voor deze week; die kan gewoon gebruikt worden",
  };
}

/** De notitie die bij een hergebruikte week in de waarschuwingen komt. */
export const BESTAANDE_URENSTAAT_NOTITIE =
  "Er bestond al een urenstaat voor deze week; die is gebruikt.";
