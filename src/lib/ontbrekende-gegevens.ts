/**
 * Welke gegevens van een werknemer ontbreken nog? Voor de melding op een
 * plaatsing. ZZP'ers hebben bedrijfsgegevens nodig voor de inkoopfactuur en
 * de betaling; eigen loondienst-personeel alleen de persoonsgegevens.
 */
export type WerknemerGegevens = {
  employmentType: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  postalCode?: string | null;
  city?: string | null;
  dateOfBirth?: Date | null;
  nationality?: string | null;
  bsn?: string | null;
  companyName?: string | null;
  kvkNumber?: string | null;
  vatNumber?: string | null;
  iban?: string | null;
};

const leeg = (v: unknown) => v == null || (typeof v === "string" && v.trim() === "");

export function ontbrekendeGegevens(c: WerknemerGegevens): string[] {
  const zzp = c.employmentType === "ZZP";
  const checks: [string, unknown][] = [
    ["Telefoon", c.phone],
    ["E-mail", c.email],
    ["Adres", c.address],
    ["Postcode & plaats", c.postalCode && c.city ? "ok" : null],
    ["Geboortedatum", c.dateOfBirth],
    ["Nationaliteit", c.nationality],
    ["IBAN", c.iban],
    ...(zzp
      ? ([
          ["Bedrijfsnaam", c.companyName],
          ["KvK-nummer", c.kvkNumber],
          ["BTW-nummer", c.vatNumber],
        ] as [string, unknown][])
      : ([["BSN", c.bsn]] as [string, unknown][])),
  ];
  return checks.filter(([, v]) => leeg(v)).map(([k]) => k);
}

/**
 * Wat ontbreekt er nog voordat een plaatsing ACTIEF mag (en door de facturatie
 * mag)? De werknemergegevens hierboven + een klant om te factureren + beide
 * tarieven. Leeg = compleet.
 */
export function ontbrekendVoorActief(
  p: { heeftKlant: boolean; costRate?: number | null; chargeRate?: number | null},
  c: WerknemerGegevens,
): string[] {
  const plaatsing: string[] = [];
  if (!p.heeftKlant) plaatsing.push("Klant");
  if (!(Number(p.costRate) > 0)) plaatsing.push("Inkooptarief");
  if (!(Number(p.chargeRate) > 0)) plaatsing.push("Verkooptarief");
  return [...plaatsing, ...ontbrekendeGegevens(c)];
}

/**
 * Staat de plaatsing in de map "Actief"? Dé regel voor zowel Plaatsingen als de
 * facturatie: alleen wie hier staat, komt in Week verwerken.
 */
export function inMapActief(p: { status: string; forceActive?: boolean | null }, ontbreekt: string[]): boolean {
  return p.status === "ACTIVE" && (ontbreekt.length === 0 || Boolean(p.forceActive));
}

/** Status om te tonen: ACTIVE buiten de map Actief heet "Nog niet actief". */
export function getoondeStatus(p: { status: string; forceActive?: boolean | null }, ontbreekt: string[]): string {
  return p.status === "ACTIVE" && !inMapActief(p, ontbreekt) ? "INCOMPLETE" : p.status;
}
