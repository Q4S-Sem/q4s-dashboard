import { cache } from "react";
import { db } from "@/lib/db";

// Gedeelde cijfers van de vacaturehub. De kop (layout) en het geopende mapje
// vragen dezelfde tellingen op; `cache` dedupliceert dat binnen één request.

/** De pseudo-bron voor vacatures die niet via een VMS/MSP binnenkwamen. */
export const OVERIG_KEY = "overig";

export const getHubCounts = cache(async () => {
  const [total, unknown, relevant, irrelevant, published, toPublish] = await Promise.all([
    db.vacancy.count(),
    db.vacancy.count({ where: { relevance: "UNKNOWN" } }),
    db.vacancy.count({ where: { relevance: "RELEVANT" } }),
    db.vacancy.count({ where: { relevance: "IRRELEVANT" } }),
    db.vacancy.count({ where: { status: "PUBLISHED" } }),
    db.vacancy.count({ where: { relevance: "RELEVANT", status: { not: "PUBLISHED" } } }),
  ]);
  return { total, unknown, relevant, irrelevant, published, toPublish };
});

export type SourceStats = {
  key: string;
  id: string | null;
  name: string;
  status: string;
  priority: number;
  website: string | null;
  lastSyncAt: Date | null;
  total: number;
  unknown: number;
  relevant: number;
  irrelevant: number;
  published: number;
  lastIn: Date | null;
};

/**
 * Alle opdrachtgevers/platformen waar vacatures vandaan komen, met per bron hoe
 * de AI-filter erover oordeelde. Bronnen zonder koppeling (handmatig, CSV,
 * e-mail) worden gebundeld onder "Overige instroom".
 */
export const getSources = cache(async (): Promise<SourceStats[]> => {
  const [connectors, byRelevance, publishedRows, latest] = await Promise.all([
    db.vmsConnector.findMany({ orderBy: [{ priority: "desc" }, { name: "asc" }] }),
    db.vacancy.groupBy({ by: ["vmsConnectorId", "relevance"], _count: { _all: true } }),
    db.vacancy.groupBy({
      by: ["vmsConnectorId"],
      where: { status: "PUBLISHED" },
      _count: { _all: true },
    }),
    db.vacancy.groupBy({ by: ["vmsConnectorId"], _max: { createdAt: true } }),
  ]);

  const key = (id: string | null) => id ?? OVERIG_KEY;
  const stats = new Map<string, SourceStats>();

  const blank = (k: string, id: string | null, name: string): SourceStats => ({
    key: k,
    id,
    name,
    status: "MANUAL",
    priority: 0,
    website: null,
    lastSyncAt: null,
    total: 0,
    unknown: 0,
    relevant: 0,
    irrelevant: 0,
    published: 0,
    lastIn: null,
  });

  for (const c of connectors) {
    stats.set(c.id, {
      ...blank(c.id, c.id, c.name),
      status: c.status,
      priority: c.priority,
      website: c.website,
      lastSyncAt: c.lastSyncAt,
    });
  }

  for (const row of byRelevance) {
    const k = key(row.vmsConnectorId);
    if (!stats.has(k)) stats.set(k, blank(k, null, "Overige instroom"));
    const s = stats.get(k)!;
    const n = row._count._all;
    s.total += n;
    if (row.relevance === "RELEVANT") s.relevant += n;
    else if (row.relevance === "IRRELEVANT") s.irrelevant += n;
    else s.unknown += n;
  }

  for (const row of publishedRows) {
    const s = stats.get(key(row.vmsConnectorId));
    if (s) s.published += row._count._all;
  }
  for (const row of latest) {
    const s = stats.get(key(row.vmsConnectorId));
    if (s) s.lastIn = row._max.createdAt;
  }

  // Meeste instroom bovenaan; lege koppelingen daarna op prioriteit.
  return [...stats.values()].sort(
    (a, b) => b.total - a.total || b.priority - a.priority || a.name.localeCompare(b.name, "nl"),
  );
});

/** Eén bron opzoeken op key (connector-id of "overig"). */
export const getSource = cache(async (k: string): Promise<SourceStats | null> => {
  const all = await getSources();
  return all.find((s) => s.key === k) ?? null;
});

/** Where-clause die bij een bron-key hoort. */
export function sourceWhere(k: string) {
  return k === OVERIG_KEY ? { vmsConnectorId: null } : { vmsConnectorId: k };
}
