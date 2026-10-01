// ---------------------------------------------------------------------------
// Het facturatiebeleid van Q4S als uitvoerbare afspraak — één plek, zodat de
// regel niet alleen in documentatie staat maar ook in een test te vangen is.
//
// Optie A: de factuur die de ZZP'er zélf stuurt ÍS de inkoop (ReceivedInvoice).
// Q4S maakt dus NOOIT een self-billing inkoopfactuur, niet automatisch en niet
// met een knop. Richting de klant gaat uitsluitend de eigen verkoopfactuur.
// ---------------------------------------------------------------------------

export const FACTUURSTROOM = {
  freelancerDocument: "RECEIVED_INVOICE",
  customerDocument: "SALES_INVOICE",
  selfBillingEnabled: false,
} as const;

/** Alleen gecontroleerde freelancerfacturen mogen in een betaalbatch belanden. */
export function isOntvangenFactuurBetaalbaar(status: string): boolean {
  return status === "APPROVED";
}
