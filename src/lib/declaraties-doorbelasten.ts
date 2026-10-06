import { getISOWeek } from "date-fns";
import type { Prisma } from "@prisma/client";
import { round2 } from "./utils";

// ---------------------------------------------------------------------------
// Declaraties doorbelasten: een goedgekeurde bon van een freelancer met
// "doorbelasten" aan gaat als eigen regel (ex btw) op zijn verkoopfactuur. Wij
// rekenen daar onze eigen btw over, net als over de uren. Elke bon kan maar
// één keer op een factuurregel staan (Expense.invoiceLineId is uniek).
// ---------------------------------------------------------------------------

type Tx = Prisma.TransactionClient;

export type Bon = {
  id: string;
  date: Date | null;
  createdAt: Date;
  vendor: string | null;
  description: string | null;
  amount: number; // incl. btw
  vatAmount: number | null;
};

/** Bedrag ex btw — onbekende btw (null) telt als 0 btw. */
export function bonExBtw(b: Pick<Bon, "amount" | "vatAmount">): number {
  return round2(b.amount - (b.vatAmount ?? 0));
}

/** De factuurregel (Engels, net als de rest van de verkoopfactuur). */
export function declaratieRegel(b: Bon, naam: string) {
  const ex = bonExBtw(b);
  const wat = [b.vendor, b.description].filter(Boolean).join(" — ") || "receipt";
  return {
    description: `Expenses ${naam}: ${wat}`,
    quantity: 1,
    unitPrice: ex,
    amount: ex,
    weekNumber: getISOWeek(b.date ?? b.createdAt),
    lineKind: "EXPENSE",
  };
}

/** Open (nog niet doorbelaste, goedgekeurde) bonnen van deze personen. */
export function openBonnen(tx: Tx, consultantIds: string[]) {
  return tx.expense.findMany({
    where: {
      consultantId: { in: consultantIds },
      rebill: true,
      status: { in: ["APPROVED", "PAID"] },
      invoiceLineId: null,
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
}

/**
 * Zet de open bonnen van deze personen als regels op de factuur en koppel ze.
 * `plaatsingVan` = consultantId → placementId op deze factuur. Geeft het
 * toegevoegde bedrag ex btw terug.
 */
export async function voegBonnenToe(
  tx: Tx,
  invoiceId: string,
  plaatsingVan: Map<string, { placementId: string; naam: string; location: string | null }>,
): Promise<number> {
  const bonnen = await openBonnen(tx, [...plaatsingVan.keys()]);
  let erbij = 0;
  for (const b of bonnen) {
    const p = plaatsingVan.get(b.consultantId!)!;
    const regel = await tx.invoiceLine.create({
      data: { invoiceId, placementId: p.placementId, location: p.location, ...declaratieRegel(b, p.naam) },
    });
    // updateMany met invoiceLineId: null = atomair claimen: nooit twee keer doorbelast.
    const geclaimd = await tx.expense.updateMany({ where: { id: b.id, invoiceLineId: null }, data: { invoiceLineId: regel.id } });
    if (geclaimd.count === 0) await tx.invoiceLine.delete({ where: { id: regel.id } });
    else erbij += regel.amount;
  }
  return round2(erbij);
}
