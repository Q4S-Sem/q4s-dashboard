/**
 * Wat moet er minimaal in een Overeenkomst van opdracht staan voordat hij de
 * deur uit mag (printen, Definitief of Getekend)? Pure functie: werkt op het
 * opgeslagen contract én op de formulierwaarden.
 */
export type ContractVelden = {
  number?: string | null;
  contractorName?: string | null;
  contractorAddress?: string | null;
  contractorKvk?: string | null;
  contractorVat?: string | null;
  contractorIban?: string | null;
  workDescription?: string | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  projectDuration?: string | null;
  rateDay?: string | null;
  rateDayFixed?: string | null;
  signerContractor?: string | null;
  signPlaceContractor?: string | null;
};

const leeg = (v: unknown) => v == null || String(v).trim() === "";

/** Lijst met leesbare namen van wat nog ontbreekt (leeg = compleet). */
export function ontbrekendeContractVelden(c: ContractVelden): string[] {
  const mist: string[] = [];
  if (leeg(c.number)) mist.push("Contractnummer");
  if (leeg(c.contractorName)) mist.push("Naam opdrachtnemer");
  if (leeg(c.contractorAddress)) mist.push("Adres opdrachtnemer (gevestigd te)");
  if (leeg(c.contractorKvk)) mist.push("KvK-nummer");
  if (leeg(c.contractorVat)) mist.push("BTW-nummer");
  if (leeg(c.contractorIban)) mist.push("IBAN opdrachtnemer");
  if (leeg(c.workDescription)) mist.push("Werkzaamheden (artikel 1.1)");
  if (leeg(c.startDate)) mist.push("Aanvangsdatum");
  if (leeg(c.endDate) && leeg(c.projectDuration)) mist.push("Einddatum of contractduur");
  if (leeg(c.rateDay) && leeg(c.rateDayFixed)) mist.push("Uurtarief of dagtarief");
  if (leeg(c.signerContractor)) mist.push("Ondertekenaar opdrachtnemer");
  if (leeg(c.signPlaceContractor)) mist.push("Plaats ondertekening opdrachtnemer");
  return mist;
}
