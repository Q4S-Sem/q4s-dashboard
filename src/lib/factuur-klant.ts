// ---------------------------------------------------------------------------
// Wie staat er op de factuur aan klantkant (t.a.v., projectmanager, e-mail(s),
// referentie)? Per plaatsing kan het afwijken van het bedrijf. Regel per veld:
// zijn alle plaatsingen op de factuur het eens over een ingevulde waarde, dan
// die; anders wat bij het bedrijf staat.
// ---------------------------------------------------------------------------

export type FactuurPlaatsing = {
  poNumber?: string | null;
  invoiceAttention?: string | null;
  projectManager?: string | null;
  invoiceEmail?: string | null;
  invoiceEmail2?: string | null;
};
export type FactuurBedrijf = {
  contactName?: string | null;
  invoiceEmail?: string | null;
  invoiceEmail2?: string | null;
  email?: string | null;
};

const schoon = (v?: string | null) => (v && v.trim() ? v.trim() : null);

/** Eén gedeelde waarde over alle plaatsingen, of null bij leeg/oneens. */
function gedeeld(waarden: (string | null)[]): string | null {
  const set = new Set(waarden.filter((v): v is string => v != null));
  return set.size === 1 ? [...set][0] : null;
}

export function factuurKlantInfo(bedrijf: FactuurBedrijf, plaatsingen: FactuurPlaatsing[]) {
  const mails = (a?: string | null, b?: string | null) =>
    [...new Set([schoon(a), schoon(b)].filter((v): v is string => v != null))].join(", ") || null;
  return {
    purchaseOrder: gedeeld(plaatsingen.map((p) => schoon(p.poNumber))),
    attention: gedeeld(plaatsingen.map((p) => schoon(p.invoiceAttention))) ?? schoon(bedrijf.contactName),
    projectManager: gedeeld(plaatsingen.map((p) => schoon(p.projectManager))),
    emailTo:
      gedeeld(plaatsingen.map((p) => mails(p.invoiceEmail, p.invoiceEmail2))) ??
      mails(bedrijf.invoiceEmail, bedrijf.invoiceEmail2) ??
      schoon(bedrijf.email),
  };
}
