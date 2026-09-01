// ---------------------------------------------------------------------------
// Welke net goedgekeurde weken mogen op een verkoopfactuur, en welke horen bij
// elkaar? Eén verkoopfactuur gaat naar één klant, dus de weken worden per klant
// gebundeld — precies zoals consultantFlow() dat doet in src/lib/facturatie.ts,
// maar dan voor een losse set urenstaten (de groene weken uit de urencontrole).
//
// PUUR en DETERMINISTISCH, net als src/lib/timesheet-auto-gate.ts: geen Prisma,
// geen datum-van-nu, geen I/O. Hier wordt NIETS gerekend aan bedragen — dat blijft
// volledig in createSalesInvoice (src/lib/invoicing.ts). Dit bestand beslist
// alleen wát er samen op één factuur hoort.
// ---------------------------------------------------------------------------

/** Zelfde tekst als facturatie.ts gebruikt voor een plaatsing zonder bedrijf. */
export const GEEN_BEDRIJF = "— geen bedrijf";

/** Een urenstaat, teruggebracht tot wat bepaalt of hij factureerbaar is. */
export type VerkoopbareWeek = {
  timesheetId: string;
  /** Timesheet.status — alleen APPROVED mag op een verkoopfactuur. */
  status: string;
  /** Staat deze week al op een verkoopfactuur (invoiceLine)? */
  hasSales: boolean;
  /** Klant van de plaatsing; null = plaatsing zonder gekoppeld bedrijf. */
  clientId: string | null;
  clientName: string | null;
};

/** Wat er samen op één conceptfactuur naar één klant gaat. */
export type VerkoopGroep = {
  clientId: string;
  clientName: string;
  timesheetIds: string[];
};

export type VerkoopGroepering = {
  /** Groepen in volgorde van binnenkomst (eerste week van die klant bepaalt de plek). */
  groups: VerkoopGroep[];
  /** Weken die niet gefactureerd kunnen worden (al gefactureerd, niet goedgekeurd,
   *  geen bedrijf, geen id). Dubbele ids tellen hier NIET in mee. */
  skipped: number;
};

function text(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Bundel de factureerbare weken per klant.
 *
 * Overgeslagen wordt alles wat niet op een verkoopfactuur hoort: een week zonder
 * id, een week die niet (meer) APPROVED is, een week die al op een verkoopfactuur
 * staat, en een plaatsing zonder gekoppeld bedrijf. Dezelfde urenstaat twee keer
 * in de lijst levert één regel op — dubbel factureren mag nooit, maar het is ook
 * geen "overgeslagen" week.
 *
 * De klantnaam komt van de eerste week waar hij bekend is; ontbreekt hij overal,
 * dan dezelfde neutrale tekst als de rest van de facturatie ({@link GEEN_BEDRIJF}).
 */
export function groupVerkoopByClient(weeks: VerkoopbareWeek[]): VerkoopGroepering {
  const groups = new Map<string, VerkoopGroep>();
  const seen = new Set<string>();
  let skipped = 0;

  for (const week of weeks) {
    const timesheetId = text(week?.timesheetId);
    const clientId = text(week?.clientId);

    if (timesheetId === "" || week.status !== "APPROVED" || week.hasSales || clientId === "") {
      skipped++;
      continue;
    }
    if (seen.has(timesheetId)) continue; // dezelfde week, tweede keer: negeren
    seen.add(timesheetId);

    let group = groups.get(clientId);
    if (!group) {
      group = { clientId, clientName: text(week.clientName) || GEEN_BEDRIJF, timesheetIds: [] };
      groups.set(clientId, group);
    } else if (group.clientName === GEEN_BEDRIJF) {
      // Naam pas later bekend? Dan alsnog de echte naam gebruiken.
      group.clientName = text(week.clientName) || GEEN_BEDRIJF;
    }
    group.timesheetIds.push(timesheetId);
  }

  return { groups: [...groups.values()], skipped };
}
