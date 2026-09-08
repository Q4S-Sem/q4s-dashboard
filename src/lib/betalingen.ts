import { db } from "./db";
import { getCompanySettings } from "./settings";
import { buildSepaCreditTransfer, type SepaPayment } from "./sepa";
import { round2 } from "./utils";
import { isOntvangenFactuurBetaalbaar } from "./facturatiebeleid";

// ---------------------------------------------------------------------------
// Uitgaande betalingen: door freelancers aangeleverde en door een mens
// goedgekeurde ReceivedInvoices → een SEPA-bestand voor ING. Vervaldatum/uitvoer =
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

/** Alle goedgekeurde ontvangen freelancerfacturen met nummer en factuurdatum. */
export async function payableReceivedInvoices(): Promise<PayableRow[]> {
  const rows = await db.receivedInvoice.findMany({
    where: { status: "APPROVED" },
    include: {
      consultant: { select: { firstName: true, lastName: true, companyName: true, iban: true } },
    },
    orderBy: { issueDate: "asc" },
  });
  return rows.flatMap((p) => {
    if (!isOntvangenFactuurBetaalbaar(p.status) || !p.issueDate || !p.number?.trim()) return [];
    const exec = new Date(p.issueDate);
    exec.setDate(exec.getDate() + ZZP_PAYMENT_TERM_DAYS);
    const name = p.consultant.companyName?.trim() || `${p.consultant.firstName} ${p.consultant.lastName}`;
    const iban = p.consultant.iban?.trim() || null;
    return {
      id: p.id,
      number: p.number.trim(),
      consultantName: name,
      iban,
      total: p.amount,
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
 * Bouw het SEPA-bestand voor goedgekeurde ontvangen freelancerfacturen (optioneel een subset
 * via `ids`). Slaat facturen zonder IBAN over (en meldt hoeveel). Een uitvoerdatum
 * in het verleden wordt naar vandaag getild (kan niet terug in de tijd).
 */
export async function buildSepaForPayables(ids?: string[]): Promise<SepaBuild> {
  const settings = await getCompanySettings();
  if (!settings.iban?.trim()) {
    return { ok: false, error: "Q4S-IBAN ontbreekt — vul die eerst in bij Instellingen." };
  }

  let payables = await payableReceivedInvoices();
  if (ids && ids.length) payables = payables.filter((p) => ids.includes(p.id));

  const eligible = payables.filter((p) => p.hasIban && p.total > 0);
  const skipped = payables.length - eligible.length;
  if (eligible.length === 0) {
    return { ok: false, error: "Geen goedgekeurde ontvangen facturen met IBAN gevonden.", skipped };
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
