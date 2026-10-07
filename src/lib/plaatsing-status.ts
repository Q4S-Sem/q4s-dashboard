import { db } from "./db";
import { ontbrekendVoorActief } from "./ontbrekende-gegevens";

/**
 * Pas de status van plaatsingen aan op hun volledigheid: ACTIVE met iets
 * ontbrekends → INCOMPLETE (niet in de facturatie), INCOMPLETE en nu compleet →
 * ACTIVE. Beëindigd/gearchiveerd blijft altijd ongemoeid.
 * Aanroepen na elke wijziging aan een plaatsing óf aan de werknemer.
 */
/** Plakt `getekendContract` aan elke plaatsing: getekend contract op de plaatsing óf op de persoon. */
export async function metContract<T extends { id: string; consultantId: string }>(
  ps: T[],
): Promise<(T & { getekendContract: boolean })[]> {
  const getekend = ps.length
    ? await db.contract.findMany({
        where: {
          status: "SIGNED",
          OR: [{ placementId: { in: ps.map((p) => p.id) } }, { consultantId: { in: ps.map((p) => p.consultantId) } }],
        },
        select: { consultantId: true, placementId: true },
      })
    : [];
  return ps.map((p) => ({
    ...p,
    getekendContract: getekend.some((c) => c.placementId === p.id || c.consultantId === p.consultantId),
  }));
}

export async function syncPlaatsingStatus(where: { id: string } | { consultantId: string }): Promise<void> {
  const plaatsingen = await db.placement.findMany({
    where: { ...where, status: { in: ["ACTIVE", "INCOMPLETE"] } },
    select: { id: true, status: true, forceActive: true, clientId: true, costRate: true, chargeRate: true, consultant: true },
  });
  for (const p of plaatsingen) {
    const compleet = ontbrekendVoorActief({ heeftKlant: Boolean(p.clientId), ...p }, p.consultant).length === 0;
    const status = compleet || p.forceActive ? "ACTIVE" : "INCOMPLETE";
    if (status !== p.status) await db.placement.update({ where: { id: p.id }, data: { status } });
  }
}
