import { db } from "./db";
import { getCompanySettings } from "./settings";
import { buildSepaCreditTransfer, type SepaPayment } from "./sepa";
import { round2 } from "./utils";

// ---------------------------------------------------------------------------
// Uitgaande betalingen: de inkoopfacturen (self-billing, wat Q4S de ZZP'er
// betaalt) die nog openstaan → een SEPA-bestand voor ING. Vervaldatum/uitvoer =
// factuurdatum + ZZP_PAYMENT_TERM_DAYS ("30 dagen na factuurdatum").
// ---------------------------------------------------------------------------

/** Betaaltermijn richting ZZP'ers (dagen na factuurdatum). */
export const ZZP_PAYMENT_TERM_DAYS = 30;

export type PayableRow = {
  id: string;
  number: string;
  consultantName: string;
  iban: string | null;
  total: number;
  issueDate: Date;
  executionDate: Date; // factuurdatum + termijn
  status: string;
  hasIban: boolean;
};

/** Alle inkoopfacturen die nog betaald moeten worden (niet betaald/geannuleerd). */
export async function payablePurchaseInvoices(): Promise<PayableRow[]> {
  const rows = await db.purchaseInvoice.findMany({
    where: { status: { in: ["DRAFT", "APPROVED"] } },
    include: {
      consultant: { select: { firstName: true, lastName: true, companyName: true, iban: true } },
    },
    orderBy: { issueDate: "asc" },
  });
  return rows.map((p) => {
    const exec = new Date(p.issueDate);
    exec.setDate(exec.getDate() + ZZP_PAYMENT_TERM_DAYS);
    const name = p.consultant.companyName?.trim() || `${p.consultant.firstName} ${p.consultant.lastName}`;
    const iban = p.consultant.iban?.trim() || null;
    return {
      id: p.id,
      number: p.number,
      consultantName: name,
      iban,
      total: p.total,
      issueDate: p.issueDate,
      executionDate: exec,
      status: p.status,
      hasIban: Boolean(iban),
    };
  });
}

export type SepaBuild = {
  ok: boolean;
  error?: string;
  xml?: string;
  count?: number;
  total?: number;
  /** Aantal overgeslagen inkoopfacturen (geen IBAN of €0). */
  skipped?: number;
};

/**
 * Bouw het SEPA-bestand voor de betaalbare inkoopfacturen (optioneel een subset
 * via `ids`). Slaat facturen zonder IBAN over (en meldt hoeveel). Een uitvoerdatum
 * in het verleden wordt naar vandaag getild (kan niet terug in de tijd).
 */
export async function buildSepaForPayables(ids?: string[]): Promise<SepaBuild> {
  const settings = await getCompanySettings();
  if (!settings.iban?.trim()) {
    return { ok: false, error: "Q4S-IBAN ontbreekt — vul die eerst in bij Instellingen." };
  }

  let payables = await payablePurchaseInvoices();
  if (ids && ids.length) payables = payables.filter((p) => ids.includes(p.id));

  const eligible = payables.filter((p) => p.hasIban && p.total > 0);
  const skipped = payables.length - eligible.length;
  if (eligible.length === 0) {
    return { ok: false, error: "Geen betaalbare inkoopfacturen met IBAN gevonden.", skipped };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const payments: SepaPayment[] = eligible.map((p) => ({
    creditorName: p.consultantName,
    creditorIban: p.iban as string,
    amount: round2(p.total),
    reference: p.number,
    remittance: `Factuur ${p.number}`,
    executionDate: p.executionDate < today ? today : p.executionDate,
  }));

  const res = buildSepaCreditTransfer({
    debtorName: settings.companyName || "Q4S",
    debtorIban: settings.iban,
    payments,
    createdAt: new Date(),
  });

  return { ok: true, xml: res.xml, count: res.count, total: res.total, skipped };
}
