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
