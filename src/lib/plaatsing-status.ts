import { db } from "./db";
import { ontbrekendVoorActief } from "./ontbrekende-gegevens";

/**
 * Pas de status van plaatsingen aan op hun volledigheid: ACTIVE met iets
 * ontbrekends → INCOMPLETE (niet in de facturatie), INCOMPLETE en nu compleet →
 * ACTIVE. Beëindigd/gearchiveerd blijft altijd ongemoeid.
 * Aanroepen na elke wijziging aan een plaatsing óf aan de werknemer.
 */
export async function syncPlaatsingStatus(where: { id: string } | { consultantId: string }): Promise<void> {
  const plaatsingen = await db.placement.findMany({
    where: { ...where, status: { in: ["ACTIVE", "INCOMPLETE"] } },
    select: { id: true, status: true, clientId: true, costRate: true, chargeRate: true, consultant: true },
  });
  for (const p of plaatsingen) {
    const compleet = ontbrekendVoorActief({ heeftKlant: Boolean(p.clientId), ...p }, p.consultant).length === 0;
    const status = compleet ? "ACTIVE" : "INCOMPLETE";
    if (status !== p.status) await db.placement.update({ where: { id: p.id }, data: { status } });
  }
}
