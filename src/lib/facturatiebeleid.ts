export const FACTUURSTROOM = {
  freelancerDocument: "RECEIVED_INVOICE",
  customerDocument: "SALES_INVOICE",
  selfBillingEnabled: false,
} as const;

/** Alleen gecontroleerde freelancerfacturen mogen in een betaalbatch belanden. */
export function isOntvangenFactuurBetaalbaar(status: string): boolean {
  return status === "APPROVED";
}

/** Q4S verstuurt uitsluitend eigen verkoopfacturen naar klanten. */
export function isVerzendtypeToegestaan(type: string): type is "verkoop" {
  return type === "verkoop";
}
