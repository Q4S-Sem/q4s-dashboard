import { db } from "./db";
import { startOfISOWeek } from "./utils";
import { controleLabel } from "./weekverwerking";
import type { GateFlag } from "./timesheet-auto-gate";
import type { GateReviewRow } from "./timesheet-gate-review";
import {
  detectDuplicates,
  evaluateMargin,
  summarizeRecurringFaults,
  type DuplicateResult,
  type MarginResult,
  type PastFault,
  type PriorInvoiceRef,
  type RecurringFaultResult,
} from "./facturatie-detecties";

// ---------------------------------------------------------------------------
// De drie extra detecties bij een te controleren week — één keer opgehaald,
// gedeeld door de lijst (/verwerken/week) en de detailpagina per persoon
// (/verwerken/week/[id]).
//
//   #2 margebewaking      — wat houden we per gewerkt uur over?
//   #1 terugkerende fout  — is dit dezelfde fout als vorige week(en)?
//   #8 dubbele factuur    — stuurde de medewerker deze factuur al eerder?
//
// ALLEEN LEZEN. Dit bestand haalt op en geeft door aan de bestaande PURE
// functies (src/lib/facturatie-detecties.ts). Er wordt hier geen enkel bedrag
// zelf uitgerekend — dat blijft in toeslag.ts / invoicing.ts — en er wordt niets
// goedgekeurd, gefactureerd of verstuurd.
// ---------------------------------------------------------------------------

export type WeekControleDetail = {
  row: GateReviewRow;
  /** De ene badge boven de week (harde fout wint van een waarschuwing). */
  kop: ReturnType<typeof controleLabel>;
  marge: MarginResult;
  herhaling: RecurringFaultResult;
  dubbel: DuplicateResult;
  /** Nummer van de factuur die deze week beslaat (null = geen factuur gevonden). */
  factuurNummer: string | null;
};

/** De bewaarde AI-controlevlaggen (JSON) veilig inlezen. */
function parseFlags(reviewFlags: string | null): GateFlag[] {
  if (!reviewFlags) return [];
  try {
    const parsed = JSON.parse(reviewFlags);
    return Array.isArray(parsed) ? (parsed as GateFlag[]) : [];
  } catch {
    return [];
  }
}

const weekOf = (d: Date | null) => (d ? startOfISOWeek(d) : null);

/**
 * Vul de te controleren weken aan met de drie detecties. De gegevens die daarvoor
 * nodig zijn (de bewaarde vlaggen van eerdere weken en de facturen die deze
 * mensen zelf stuurden) worden in twee queries voor de héle stapel opgehaald,
 * zodat één regel evenveel kost als vijftig.
 */
export async function weekControleDetails(
  rows: GateReviewRow[],
): Promise<WeekControleDetail[]> {
  if (rows.length === 0) return [];

  const consultantIds = [
    ...new Set(rows.map((r) => r.consultantId).filter((id): id is string => !!id)),
  ];

  const [eerdereItems, ontvangen] = await Promise.all([
    // Voor #1: de bewaarde controlevlaggen van eerdere weekstaten van dezelfde mensen.
    consultantIds.length > 0
      ? db.timesheetInbox.findMany({
          where: { consultantId: { in: consultantIds }, reviewFlags: { not: null } },
          select: {
            id: true,
            consultantId: true,
            reviewFlags: true,
            extractedWeekStart: true,
          },
        })
      : Promise.resolve([]),
    // Voor #8: de facturen die deze mensen zelf stuurden.
    consultantIds.length > 0
      ? db.receivedInvoice.findMany({
          where: { consultantId: { in: consultantIds } },
          select: {
            id: true,
            consultantId: true,
            number: true,
            amount: true,
            periodStart: true,
          },
          orderBy: [{ createdAt: "asc" }],
        })
      : Promise.resolve([]),
  ]);

  return rows.map((row) => {
    const kop = controleLabel(row.flags);

    // #2 Margebewaking. Zonder uren/bedrag op de factuur valt evaluateMargin terug
    // op het afgesproken inkooptarief en zegt dat er zelf bij — er wordt hier dus
    // niets aan de factuur gerekend wat er niet staat.
    const marge = evaluateMargin({
      hoursOnInvoice: null,
      invoiceAmount: null,
      costRate: row.costRate,
      chargeRate: row.chargeRate,
      expectedMarginPerHour: null,
    });

    // #1 Terugkerende fout — geteld over de BEWAARDE vlaggen van eerdere weken.
    const huidigType = controleLabel(row.aiFlags)?.label ?? "";
    const eerder: PastFault[] = eerdereItems
      .filter(
        (i) =>
          i.consultantId === row.consultantId &&
          i.id !== row.id &&
          !!i.extractedWeekStart &&
          !!row.weekStart &&
          i.extractedWeekStart.getTime() < row.weekStart.getTime(),
      )
      .flatMap((i) => {
        const type = controleLabel(parseFlags(i.reviewFlags))?.label;
        return type ? [{ type }] : [];
      });
    const herhaling = summarizeRecurringFaults(eerder, huidigType);

    // #8 Dubbele factuur — de factuur die deze week beslaat, tegen alle eerdere.
    const vanPersoon = ontvangen.filter((inv) => inv.consultantId === row.consultantId);
    const huidigeFactuur = row.weekStart
      ? (vanPersoon.find((inv) => weekOf(inv.periodStart)?.getTime() === row.weekStart!.getTime()) ??
        null)
      : null;
    const eerdereFacturen: PriorInvoiceRef[] = huidigeFactuur
      ? vanPersoon
          .filter((inv) => inv.id !== huidigeFactuur.id)
          .map((inv) => ({
            number: inv.number,
            amount: inv.amount,
            weekStart: weekOf(inv.periodStart),
          }))
      : [];
    const dubbel = huidigeFactuur
      ? detectDuplicates({
          invoiceNumber: huidigeFactuur.number,
          invoiceAmount: huidigeFactuur.amount,
          weekStart: row.weekStart,
          priorInvoices: eerdereFacturen,
        })
      : { flags: [] };

    return { row, kop, marge, herhaling, dubbel, factuurNummer: huidigeFactuur?.number ?? null };
  });
}
