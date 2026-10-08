import type { Prisma } from "@prisma/client";

/** Afgeronde deals (Geplaatst / Verloren) gaan na zoveel dagen van het bord naar het Archief. */
export const CRM_ARCHIEF_DAGEN = 3;

/**
 * Deals die in het Archief horen: Verloren meteen (na de bevestiging op het
 * bord), Geplaatst pas na CRM_ARCHIEF_DAGEN. Alleen een weergave-filter — er
 * wordt niets gewist; terug naar een open fase = weer op het bord.
 */
export function crmArchiefWhere(now = new Date()): Prisma.DealWhereInput {
  const grens = new Date(now.getTime() - CRM_ARCHIEF_DAGEN * 24 * 60 * 60 * 1000);
  return {
    OR: [
      { status: "LOST" },
      // Oude deals zonder closedAt: val terug op de laatste wijziging.
      { status: "WON", OR: [{ closedAt: { lt: grens } }, { closedAt: null, updatedAt: { lt: grens } }] },
    ],
  };
}
