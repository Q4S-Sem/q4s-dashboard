import { cache } from "react";
import { db } from "@/lib/db";
import { getoondeStatus, ontbrekendVoorActief } from "@/lib/ontbrekende-gegevens";

// Gedeelde queries van het plaatsing-dossier. De layout (kop + mappen) en het
// geopende tabblad vragen dezelfde plaatsing op; `cache` dedupliceert dat binnen
// één request.

export const getPlacement = cache(async (id: string) => {
  const p = await db.placement.findUnique({
    where: { id },
    include: {
      consultant: { include: { documents: { orderBy: { createdAt: "desc" } } } },
      client: true,
    },
  });
  if (!p) return null;
  // Zelfde regel als de lijst en de facturatie (inMapActief).
  const ontbreekt = ontbrekendVoorActief({ heeftKlant: Boolean(p.clientId), ...p }, p.consultant);
  return { ...p, ontbreekt, getoondeStatus: getoondeStatus(p, ontbreekt) };
});

/** Urenstaten met dag-uren — voor het mapje Uren én de gerealiseerde marge. */
export const getTimesheets = cache(async (id: string) =>
  db.timesheet.findMany({
    where: { placementId: id },
    include: { entries: true },
    orderBy: { weekStart: "desc" },
  }),
);

/** Aantallen op de mapjes in de tabbalk. */
export const getDossierCounts = cache(async (id: string) => {
  const [timesheets, notes, contracts] = await Promise.all([
    db.timesheet.count({ where: { placementId: id } }),
    db.activity.count({ where: { entityType: "placement", entityId: id } }),
    db.contract.count({ where: { placementId: id } }),
  ]);
  return { timesheets, notes, contracts };
});

/** Totaal geregistreerde uren over alle urenstaten van deze plaatsing. */
export function totalHours(
  timesheets: { entries: { hours: number }[] }[],
): number {
  return timesheets.reduce(
    (sum, ts) => sum + ts.entries.reduce((a, e) => a + e.hours, 0),
    0,
  );
}
