// Kiwa/SNA-steekproef (zzp/inleen): bij een controle vraagt de auditor per
// ZZP'er + inkoopfactuurnummer een vaste set stukken op. Deze module bevat de
// PURE logica (testbaar, geen IO): welke verkoopfacturen horen bij een
// ontvangen inkoopfactuur, en welke van de zeven stukken zijn aanwezig.
//
// De zeven stukken uit de standaard-opvraag:
//  1. Opdrachtverstrekking opdrachtgever -> Q4S      (dossier: CONTRACT)
//  2. Overeenkomst van Opdracht                      (dossier: CONTRACT)
//  3. KvK-uittreksel < 3 mnd                         (dossier: KVK)
//  4. Vastlegging ID conform AVG                     (dossier: ID)
//  5. Inkoopfactuur (de factuur van de ZZP'er)       (ReceivedInvoice-upload)
//  6. Betaalbewijs van die inkoopfactuur             (dossier: BETAALBEWIJS)
//  7. Verkoopfactuur die erop betrekking heeft       (gegenereerde Invoice-PDF)

export type SalesCandidate = {
  id: string;
  issueDate: Date;
  /** weekStart van elke timesheet-regel op de factuur. */
  weekStarts: Date[];
};

export type PurchaseRef = {
  id: string;
  issueDate: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
};

const DAY = 24 * 60 * 60 * 1000;

/**
 * Welke verkoopfacturen horen bij deze inkoopfactuur? Primair: een
 * timesheet-week op de verkoopfactuur valt binnen de periode van de
 * inkoopfactuur (ruim genomen: week overlapt de periode). Fallback zonder
 * periode: verkoopfacturen met een factuurdatum binnen 45 dagen.
 */
export function matchSalesInvoices<T extends SalesCandidate>(
  purchase: PurchaseRef,
  sales: T[],
): T[] {
  const { periodStart, periodEnd } = purchase;
  if (periodStart && periodEnd) {
    const from = periodStart.getTime() - 6 * DAY; // week begint vóór de periode
    const to = periodEnd.getTime() + DAY;
    return sales.filter((s) =>
      s.weekStarts.some((w) => {
        const t = w.getTime();
        return t >= from && t <= to;
      }),
    );
  }
  const anchor = purchase.issueDate?.getTime();
  if (!anchor) return [];
  return sales.filter((s) => Math.abs(s.issueDate.getTime() - anchor) <= 45 * DAY);
}

export type ChecklistItem = {
  key: string;
  label: string;
  ok: boolean;
};

/** De zeven stukken, met per stuk of er iets voor gevonden is. */
export function steekproefChecklist(input: {
  contractDocs: number;
  kvkDocs: number;
  idDocs: number;
  purchaseFile: boolean;
  paymentDocs: number;
  salesMatches: number;
}): ChecklistItem[] {
  return [
    { key: "contract", label: "Opdracht & Overeenkomst van Opdracht", ok: input.contractDocs > 0 },
    { key: "kvk", label: "KvK-uittreksel (< 3 mnd bij ondertekening)", ok: input.kvkDocs > 0 },
    { key: "id", label: "Vastlegging ID (AVG)", ok: input.idDocs > 0 },
    { key: "inkoopfactuur", label: "Inkoopfactuur (van de ZZP'er)", ok: input.purchaseFile },
    { key: "betaalbewijs", label: "Betaalbewijs inkoopfactuur", ok: input.paymentDocs > 0 },
    { key: "verkoopfactuur", label: "Bijbehorende verkoopfactuur", ok: input.salesMatches > 0 },
  ];
}
