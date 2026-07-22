import { db } from "./db";
import { round2 } from "./utils";

/**
 * Boekhoud-/BTW-overzicht: geldstroom in-uit en een BTW-aangifte-indicatie
 * (verschuldigd − voorbelasting = saldo) per periode.
 *
 * ⚠️ DIT IS EEN MANAGEMENT-OVERZICHT, GEEN OFFICIËLE BTW-AANGIFTE. De echte
 * aangifte gaat via de boekhouder/Belastingdienst. Verlegde BTW, intracommunautaire
 * leveringen, buitenlandse leveranciers en privégebruik vallen buiten dit model.
 *
 * BEWUSTE KEUZES (met de gebruiker afgestemd):
 * - Normaal BTW-plichtig (geen KOR) → voorbelasting is aftrekbaar.
 * - Periode telt op FACTUURDATUM (issueDate), niet betaaldatum — zo hoort een
 *   BTW-aangifte. Concepten (DRAFT) en geannuleerde tellen NIET mee.
 * - Voorbelasting-bronnen: self-billing PurchaseInvoice (betrouwbaar) + declaraties
 *   (Expense) die aftrekbaar zijn. Ontvangen ZZP-facturen tellen ALLEEN mee als ze
 *   expliciet `countForVat` aan hebben — anders zou dezelfde ZZP-betaling die al via
 *   een self-billing inkoopfactuur loopt, dubbel geteld worden. Waar tóch beide
 *   bestaan voor dezelfde consultant in de periode, geven we een waarschuwing.
 * - `vatAmount` is nullable op Expense/ReceivedInvoice: null = ONBEKEND, niet €0.
 *   Onbekende BTW telt niet stilzwijgend als 0 mee maar wordt apart gemeld.
 * - Aftrekbaarheid per bon via `vatDeductible` (horeca/eten = niet aftrekbaar).
 */

// Welke statussen tellen mee (factuurdatum-basis).
const SALES_VAT_STATUSES = ["SENT", "PAID", "OVERDUE"]; // Invoice: excl. DRAFT/CANCELLED
const PURCHASE_VAT_STATUSES = ["APPROVED", "PAID"]; // PurchaseInvoice: excl. DRAFT/CANCELLED
const RECEIVED_VAT_STATUSES = ["NEW", "APPROVED", "PAID"]; // excl. DISPUTED
const EXPENSE_VAT_STATUSES = ["NEW", "APPROVED", "PAID"]; // Expense: excl. REJECTED

export type BtwPeriod = { year: number; quarter: number | null };

export type PeriodRange = { start: Date; end: Date; label: string };

/** Bouw een datum-range uit jaar + kwartaal (null = heel jaar). */
export function periodToRange({ year, quarter }: BtwPeriod): PeriodRange {
  if (quarter == null) {
    return { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1), label: `Heel ${year}` };
  }
  const startMonth = (quarter - 1) * 3;
  return {
    start: new Date(year, startMonth, 1),
    end: new Date(year, startMonth + 3, 1),
    label: `Q${quarter} ${year}`,
  };
}

/** Één post in de geldstroom of BTW-uitsplitsing. */
export type BtwSource = {
  key: string;
  label: string;
  /** Bedrag excl. BTW (grondslag). */
  net: number;
  /** BTW-bedrag. */
  vat: number;
  /** Bedrag incl. BTW. */
  gross: number;
  count: number;
  /** Aantal posten waarvan de BTW onbekend is (vatAmount = null). */
  unknownVatCount: number;
};

export type BtwOverview = {
  period: PeriodRange;
  // --- BTW-aangifte-indicatie ---
  /** Verschuldigde BTW over de omzet (verkoop). */
  verschuldigd: number;
  /** Terug te vorderen voorbelasting (inkoop + aftrekbare kosten). */
  voorbelasting: number;
  /** verschuldigd − voorbelasting. Positief = te betalen aan de Belastingdienst;
   *  negatief = terug te vorderen. */
  saldo: number;
  /** Uitsplitsing van de voorbelasting per bron. */
  voorbelastingBronnen: BtwSource[];
  /** De verkoop-kant (verschuldigd). */
  verkoop: BtwSource;
  // --- Geldstroom (incl. BTW, op document-/factuurdatum) ---
  geldIn: number;
  geldUit: number;
  geldNetto: number;
  // --- Signalen die de gebruiker moet zien ---
  /** Posten met onbekende BTW (bon/ontvangen factuur zonder BTW-bedrag). */
  onbekendeBtw: { count: number; grossTotal: number };
  /** Consultants met ZOWEL een inkoopfactuur ALS een meetellende ontvangen factuur
   *  in deze periode → risico op dubbeltelling van voorbelasting. */
  mogelijkeDubbeltelling: { consultantId: string; name: string }[];
  /** Niet-aftrekbare bonnen (vatDeductible=false) — hun BTW telt NIET mee. */
  nietAftrekbaar: { count: number; vatExcluded: number };
  /** Concept-facturen (DRAFT) in deze periode die nog NIET meetellen in de BTW —
   *  pas als ze verstuurd/goedgekeurd zijn tellen ze mee. Voorkomt verwarring dat
   *  de verschuldigde BTW laag lijkt naast een grote omzet-pijplijn. */
  concepten: { salesCount: number; salesVat: number; purchaseCount: number; purchaseVat: number };
};

const inRangeOf = (d: Date | null | undefined, r: PeriodRange, fallback?: Date | null) => {
  const date = d ?? fallback ?? null;
  if (!date) return false;
  const t = new Date(date);
  return t >= r.start && t < r.end;
};

export async function btwOverview(period: BtwPeriod): Promise<BtwOverview> {
  const range = periodToRange(period);

  const [invoices, purchases, received, expenses] = await Promise.all([
    db.invoice.findMany({ select: { status: true, issueDate: true, subtotal: true, vatAmount: true, total: true } }),
    db.purchaseInvoice.findMany({
      select: { status: true, issueDate: true, subtotal: true, vatAmount: true, total: true, consultantId: true },
    }),
    db.receivedInvoice.findMany({
      select: {
        status: true, issueDate: true, createdAt: true, amount: true, vatAmount: true,
        countForVat: true, consultantId: true,
        consultant: { select: { firstName: true, lastName: true } },
      },
    }),
    db.expense.findMany({
      select: { status: true, date: true, createdAt: true, amount: true, vatAmount: true, vatDeductible: true },
    }),
  ]);

  // ---- Verkoop: verschuldigde BTW ----
  const salesRows = invoices.filter(
    (i) => SALES_VAT_STATUSES.includes(i.status) && inRangeOf(i.issueDate, range),
  );
  const verkoop: BtwSource = {
    key: "verkoop",
    label: "Verkoopfacturen",
    net: round2(salesRows.reduce((s, i) => s + i.subtotal, 0)),
    vat: round2(salesRows.reduce((s, i) => s + i.vatAmount, 0)),
    gross: round2(salesRows.reduce((s, i) => s + i.total, 0)),
    count: salesRows.length,
    unknownVatCount: 0,
  };
  const verschuldigd = verkoop.vat;

  // ---- Voorbelasting bron 1: self-billing inkoopfacturen ----
  const purchRows = purchases.filter(
    (p) => PURCHASE_VAT_STATUSES.includes(p.status) && inRangeOf(p.issueDate, range),
  );
  const inkoopBron: BtwSource = {
    key: "inkoop",
    label: "Inkoopfacturen (self-billing)",
    net: round2(purchRows.reduce((s, p) => s + p.subtotal, 0)),
    vat: round2(purchRows.reduce((s, p) => s + p.vatAmount, 0)),
    gross: round2(purchRows.reduce((s, p) => s + p.total, 0)),
    count: purchRows.length,
    unknownVatCount: 0,
  };

  // ---- Voorbelasting bron 2: ontvangen ZZP-facturen die meetellen ----
  const recvRows = received.filter(
    (r) =>
      r.countForVat &&
      RECEIVED_VAT_STATUSES.includes(r.status) &&
      inRangeOf(r.issueDate, range, r.createdAt),
  );
  const recvVat = round2(recvRows.reduce((s, r) => s + (r.vatAmount ?? 0), 0));
  const recvUnknown = recvRows.filter((r) => r.vatAmount == null);
  const ontvangenBron: BtwSource = {
    key: "ontvangen",
    label: "Ontvangen facturen (meetellend)",
    net: round2(recvRows.reduce((s, r) => s + (r.amount - (r.vatAmount ?? 0)), 0)),
    vat: recvVat,
    gross: round2(recvRows.reduce((s, r) => s + r.amount, 0)),
    count: recvRows.length,
    unknownVatCount: recvUnknown.length,
  };

  // ---- Voorbelasting bron 3: aftrekbare declaraties/bonnetjes ----
  const expEligible = expenses.filter(
    (e) => EXPENSE_VAT_STATUSES.includes(e.status) && inRangeOf(e.date, range, e.createdAt),
  );
  const expDeductible = expEligible.filter((e) => e.vatDeductible);
  const expVat = round2(expDeductible.reduce((s, e) => s + (e.vatAmount ?? 0), 0));
  const expUnknown = expDeductible.filter((e) => e.vatAmount == null);
  const bonnenBron: BtwSource = {
    key: "bonnen",
    label: "Bonnetjes / declaraties",
    net: round2(expDeductible.reduce((s, e) => s + (e.amount - (e.vatAmount ?? 0)), 0)),
    vat: expVat,
    gross: round2(expDeductible.reduce((s, e) => s + e.amount, 0)),
    count: expDeductible.length,
    unknownVatCount: expUnknown.length,
  };

  const voorbelastingBronnen = [inkoopBron, ontvangenBron, bonnenBron].filter((b) => b.count > 0);
  const voorbelasting = round2(inkoopBron.vat + ontvangenBron.vat + bonnenBron.vat);
  const saldo = round2(verschuldigd - voorbelasting);

  // ---- Geldstroom (incl. BTW, op factuur-/bondatum). UIT gebruikt dezelfde dedup
  //      als de BTW voor de ZZP-facturen: inkoop (self-billing) + alleen meetellende
  //      ontvangen facturen, zodat één ZZP-betaling niet dubbel telt. ----
  //
  // Voor de bonnen gebruikt de geldstroom bewust ALLE meetellende bonnen (expEligible),
  // óók de niet-aftrekbare (horeca): `vatDeductible` gaat over BTW-aftrek, niet over of
  // het geld is uitgegeven. Zou de kasstroom `bonnenBron.gross` (alleen aftrekbaar)
  // gebruiken, dan verdween een horeca-bon uit "eruit" terwijl het echt uitgegeven geld
  // is → geldUit te laag, netto te hoog. De BTW-som (voorbelasting) blijft wél op
  // uitsluitend de aftrekbare bonnen.
  const bonnenGrossKas = round2(expEligible.reduce((s, e) => s + e.amount, 0));
  const geldIn = verkoop.gross;
  const geldUit = round2(inkoopBron.gross + ontvangenBron.gross + bonnenGrossKas);
  const geldNetto = round2(geldIn - geldUit);

  // ---- Signaal: onbekende BTW ----
  const onbekendeRows = [
    ...recvUnknown.map((r) => r.amount),
    ...expUnknown.map((e) => e.amount),
  ];
  const onbekendeBtw = {
    count: onbekendeRows.length,
    grossTotal: round2(onbekendeRows.reduce((s, a) => s + a, 0)),
  };

  // ---- Signaal: mogelijke dubbeltelling (zelfde consultant in inkoop én meetellende
  //      ontvangen factuur binnen de periode) ----
  const purchConsultants = new Set(purchRows.map((p) => p.consultantId));
  const dubbelMap = new Map<string, string>();
  for (const r of recvRows) {
    if (purchConsultants.has(r.consultantId)) {
      dubbelMap.set(
        r.consultantId,
        `${r.consultant.firstName} ${r.consultant.lastName}`.trim(),
      );
    }
  }
  const mogelijkeDubbeltelling = [...dubbelMap.entries()].map(([consultantId, name]) => ({ consultantId, name }));

  // ---- Signaal: niet-aftrekbare bonnen (BTW bewust NIET meegeteld) ----
  const expNonDeductible = expEligible.filter((e) => !e.vatDeductible);
  const nietAftrekbaar = {
    count: expNonDeductible.length,
    vatExcluded: round2(expNonDeductible.reduce((s, e) => s + (e.vatAmount ?? 0), 0)),
  };

  // ---- Signaal: concept-facturen die nog niet meetellen ----
  const draftSales = invoices.filter((i) => i.status === "DRAFT" && inRangeOf(i.issueDate, range));
  const draftPurch = purchases.filter((p) => p.status === "DRAFT" && inRangeOf(p.issueDate, range));
  const concepten = {
    salesCount: draftSales.length,
    salesVat: round2(draftSales.reduce((s, i) => s + i.vatAmount, 0)),
    purchaseCount: draftPurch.length,
    purchaseVat: round2(draftPurch.reduce((s, p) => s + p.vatAmount, 0)),
  };

  return {
    period: range,
    verschuldigd,
    voorbelasting,
    saldo,
    voorbelastingBronnen,
    verkoop,
    geldIn,
    geldUit,
    geldNetto,
    onbekendeBtw,
    mogelijkeDubbeltelling,
    nietAftrekbaar,
    concepten,
  };
}
