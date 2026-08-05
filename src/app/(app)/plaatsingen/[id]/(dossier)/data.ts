import { cache } from "react";
import { db } from "@/lib/db";

// Gedeelde queries van het plaatsing-dossier. De layout (kop + mappen) en het
// geopende tabblad vragen dezelfde plaatsing op; `cache` dedupliceert dat binnen
// één request.

export const getPlacement = cache(async (id: string) =>
  db.placement.findUnique({
    where: { id },
    include: {
      consultant: { include: { documents: { orderBy: { createdAt: "desc" } } } },
      client: true,
    },
  }),
);

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
  const [timesheets, notes] = await Promise.all([
    db.timesheet.count({ where: { placementId: id } }),
    db.activity.count({ where: { entityType: "placement", entityId: id } }),
  ]);
  return { timesheets, notes };
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
