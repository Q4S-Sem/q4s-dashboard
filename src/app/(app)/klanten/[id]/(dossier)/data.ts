import { cache } from "react";
import { db } from "@/lib/db";

// Gedeelde queries van het klantdossier. De layout (kop + mappen-tabs) en het
// geopende tabblad vragen dezelfde klant op; `cache` dedupliceert dat binnen
// één request, dus het blijft één query.

export const getClient = cache(async (id: string) =>
  db.client.findUnique({
    where: { id },
    include: { contacts: { orderBy: { createdAt: "asc" } } },
  }),
);

/** Aantallen op de mapjes in de tabbalk — zo zie je meteen wat erin zit. */
export const getDossierCounts = cache(async (id: string) => {
  const [placements, invoices, notes] = await Promise.all([
    db.placement.count({ where: { clientId: id } }),
    db.invoice.count({ where: { clientId: id } }),
    db.activity.count({ where: { entityType: "client", entityId: id } }),
  ]);
  return { placements, invoices, notes };
});
