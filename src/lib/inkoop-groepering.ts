// ---------------------------------------------------------------------------
// Welke net goedgekeurde weken mogen op een INKOOPfactuur (wat Q4S de medewerker
// betaalt), en welke horen bij elkaar? Eén inkoopfactuur gaat naar één
// medewerker, dus de weken worden per medewerker gebundeld — precies zoals
// consultantFlow() dat doet in src/lib/facturatie.ts, maar dan voor een losse set
// urenstaten (de groene weken uit de urencontrole).
//
// De tegenhanger van src/lib/verkoop-groepering.ts (die per klant bundelt).
//
// PUUR en DETERMINISTISCH: geen Prisma, geen datum-van-nu, geen I/O. Hier wordt
// NIETS gerekend aan bedragen — dat blijft volledig in createPurchaseInvoice
// (src/lib/invoicing.ts). Dit bestand beslist alleen wát er samen op één factuur
// hoort, en wie er géén inkoopfactuur krijgt.
// ---------------------------------------------------------------------------

/** Fallback als de naam van de medewerker nergens bekend is (alleen weergave). */
export const GEEN_NAAM = "— geen naam";

/** Een urenstaat, teruggebracht tot wat bepaalt of hij inkoop-factureerbaar is. */
export type InkoopbareWeek = {
  timesheetId: string;
  /** Timesheet.status — APPROVED én INVOICED mogen op een inkoopfactuur (de
   *  verkoopfactuur zet de week op INVOICED, de inkoop moet daarna nog kunnen). */
  status: string;
  /** Staat deze week al op een inkoopfactuur (purchaseLine)? */
  hasPurchase: boolean;
  /** Medewerker van de plaatsing; null = onbekend (niet te factureren). */
  consultantId: string | null;
  consultantName: string | null;
  /** Loondienst/eigen personeel → GÉÉN inkoopfactuur, dat is salaris. */
  loondienst: boolean;
};

/** Wat er samen op één conceptfactuur naar één medewerker gaat. */
export type InkoopGroep = {
  consultantId: string;
  consultantName: string;
  timesheetIds: string[];
};

export type InkoopGroepering = {
  /** Groepen in volgorde van binnenkomst (eerste week van die medewerker bepaalt de plek). */
  groups: InkoopGroep[];
  /** Weken die niet op een inkoopfactuur kunnen (al ingekocht, verkeerde status,
   *  geen medewerker, geen id). Dubbele ids tellen hier NIET in mee. */
  skipped: number;
  /** Loondienst-weken: bewust geen inkoopfactuur (salaris). Geen probleem, dus
   *  apart geteld en NIET als overgeslagen. */
  loondienst: number;
};

/** Alleen deze statussen mogen op een inkoopfactuur — zelfde filter als
 *  createPurchaseInvoice (src/lib/invoicing.ts) in de database gebruikt. */
const INKOOPBAAR = new Set(["APPROVED", "INVOICED"]);

function text(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Bundel de inkoop-factureerbare weken per medewerker.
 *
 * Overgeslagen wordt alles wat niet op een inkoopfactuur hoort: een week zonder
 * id, een week die niet APPROVED of INVOICED is, een week die al op een
 * inkoopfactuur staat, en een week zonder medewerker. Loondienst telt apart:
 * daar hoort per definitie geen inkoopfactuur bij (dat is salaris), dus dat is
 * geen overgeslagen week maar een normale uitkomst.
 *
 * Dezelfde urenstaat twee keer in de lijst levert één regel op — dubbel inkopen
 * mag nooit, maar het is ook geen "overgeslagen" week.
 *
 * De naam komt van de eerste week waar hij bekend is; ontbreekt hij overal, dan
 * {@link GEEN_NAAM}.
 */
export function groupInkoopByConsultant(weeks: InkoopbareWeek[]): InkoopGroepering {
  const groups = new Map<string, InkoopGroep>();
  const seen = new Set<string>();
  let skipped = 0;
  let loondienst = 0;

  for (const week of weeks) {
    const timesheetId = text(week?.timesheetId);
    const consultantId = text(week?.consultantId);

    if (timesheetId === "") {
      skipped++;
      continue;
    }
    if (week.loondienst) {
      // Eigen personeel: salaris, geen inkoopfactuur. Bewust geen "overgeslagen".
      loondienst++;
      continue;
    }
    if (!INKOOPBAAR.has(week.status) || week.hasPurchase || consultantId === "") {
      skipped++;
      continue;
    }
    if (seen.has(timesheetId)) continue; // dezelfde week, tweede keer: negeren
    seen.add(timesheetId);

    let group = groups.get(consultantId);
    if (!group) {
      group = {
        consultantId,
        consultantName: text(week.consultantName) || GEEN_NAAM,
        timesheetIds: [],
      };
      groups.set(consultantId, group);
    } else if (group.consultantName === GEEN_NAAM) {
      // Naam pas later bekend? Dan alsnog de echte naam gebruiken.
      group.consultantName = text(week.consultantName) || GEEN_NAAM;
    }
    group.timesheetIds.push(timesheetId);
  }

  return { groups: [...groups.values()], skipped, loondienst };
}
