/**
 * De guards onder de selectie op /facturen (aanvinken → Openen / Verwijderen /
 * Verzenden). PUUR — geen database, geen React — zodat de knoppenbalk in de
 * client en de server-actions bewijsbaar hetzelfde predicaat draaien: wat je
 * aanvinkt is precies wat er gebeurt.
 */

export type BulkInvoice = { id: string; status: string };

/**
 * Alleen een concept of een geannuleerde factuur mag weg. Een verstuurde of
 * betaalde factuur is administratie — die verwijder je niet, die crediteer je.
 * (Zelfde grens als de losse verwijderknop op de factuurpagina.)
 */
export function isDeletableInvoice(status: string): boolean {
  return status === "DRAFT" || status === "CANCELLED";
}

/**
 * Verzenden kan alleen vanuit concept — exact de selectie van de verzendmap
 * (`getOutbox` haalt `status: "DRAFT"` op). Zo kan de bulkknop nooit iets
 * versturen dat de verzendmap zelf niet zou versturen.
 */
export function isSendableInvoice(status: string): boolean {
  return status === "DRAFT";
}

/** De aangevinkte ids uit het verborgen formulierveld: opschonen + ontdubbelen. */
export function parseBulkIds(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/**
 * Splits de selectie in "mag door" en "overgeslagen". Onbekende ids (intussen
 * verwijderd) tellen als overgeslagen — geen foutmelding, wel eerlijk gemeld.
 * De volgorde van de selectie blijft staan.
 */
export function partitionBulk(
  requestedIds: string[],
  rows: BulkInvoice[],
  allow: (status: string) => boolean,
): { ids: string[]; skipped: number } {
  const byId = new Map(rows.map((r) => [r.id, r]));
  const seen = new Set<string>();
  const ids: string[] = [];
  let requested = 0;
  for (const id of requestedIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    requested++;
    const row = byId.get(id);
    if (row && allow(row.status)) ids.push(id);
  }
  return { ids, skipped: requested - ids.length };
}

/** De bestaande PDF-route van de verzendmap — één plek, ook voor "Openen". */
export function invoicePdfHref(id: string): string {
  return `/verzenden/verkoop/${id}/pdf`;
}

/** Browsers blokkeren een regen van tabbladen; hierboven stoppen we netjes. */
export const MAX_OPEN_TABS = 10;

/** Hoeveel PDF's er open mogen en hoeveel er zijn afgetopt. */
export function capOpen(ids: string[], max: number = MAX_OPEN_TABS): {
  open: string[];
  capped: number;
} {
  const open = ids.slice(0, Math.max(0, max));
  return { open, capped: ids.length - open.length };
}
