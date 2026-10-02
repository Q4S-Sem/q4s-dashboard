import type { Prisma } from "@prisma/client";

/** Afgeronde deals (Geplaatst / Verloren) gaan na zoveel dagen van het bord naar het Archief. */
export const CRM_ARCHIEF_DAGEN = 3;

/**
 * Deals die in het Archief horen: gewonnen of verloren, langer dan
 * CRM_ARCHIEF_DAGEN geleden afgerond. Alleen een weergave-filter — er wordt
 * niets gewist of gewijzigd; terug naar een open fase = weer op het bord.
 */
export function crmArchiefWhere(now = new Date()): Prisma.DealWhereInput {
  const grens = new Date(now.getTime() - CRM_ARCHIEF_DAGEN * 24 * 60 * 60 * 1000);
  return {
    status: { in: ["WON", "LOST"] },
    // Oude deals zonder closedAt: val terug op de laatste wijziging.
    OR: [{ closedAt: { lt: grens } }, { closedAt: null, updatedAt: { lt: grens } }],
  };
}
