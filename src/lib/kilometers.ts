import { round2 } from "./utils";

// ---------------------------------------------------------------------------
// Welke kilometers horen bij een week? Niet elke freelancer meldt km op dezelfde
// plek: de één zet ze op de URENSTAAT, de ander alleen op zijn EIGEN FACTUUR
// (ReceivedInvoice). Zonder terugval belandden die laatste km op 0 in de
// urenregistratie.
//
// Regel: de urenstaat is leidend; staat daar niets (0/leeg), dan nemen we de km
// van de factuur over. Km kennen GÉÉN marge — ze gaan 1-op-1 door (kmRateBuy /
// kmRateSell doen de rest in toeslag.ts).
//
// PUUR: geen Prisma, geen datum-van-nu — het opzoeken van de bijbehorende
// factuur gebeurt in received-invoices.ts (invoiceKilometersForWeek).
// ---------------------------------------------------------------------------

export type KilometerInput = {
  /** Km zoals op de urenstaat gemeld (null/0 = niet gemeld). */
  timesheetKm?: number | null;
  /** Km van de factuur van de medewerker over dezelfde week. */
  invoiceKm?: number | null;
};

/** Waar de gekozen km vandaan komen — voor de melding richting HR. */
export type KilometerSource = "timesheet" | "factuur" | "geen";

/** Bruikbaar km-getal, of 0: negatieve waarden en NaN/Infinity tellen niet mee. */
function usable(km: number | null | undefined): number {
  return typeof km === "number" && Number.isFinite(km) && km > 0 ? round2(km) : 0;
}

/** De km die op de urenstaat vastgezet worden: urenstaat als daar km staan,
 *  anders die van de factuur, anders 0. */
export function resolveKilometers(input: KilometerInput): number {
  return usable(input.timesheetKm) || usable(input.invoiceKm);
}

/** Uit welke bron komen de km van {@link resolveKilometers}? */
export function resolveKilometersSource(input: KilometerInput): KilometerSource {
  if (usable(input.timesheetKm) > 0) return "timesheet";
  if (usable(input.invoiceKm) > 0) return "factuur";
  return "geen";
}
