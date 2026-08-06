import { cache } from "react";
import { db } from "@/lib/db";

// Gedeelde queries van het kandidaatdossier. De layout (kop + mappen-tabs) en
// het geopende mapje vragen dezelfde kandidaat op; `cache` dedupliceert dat
// binnen één request, dus het blijft één query.

export const getCandidate = cache(async (id: string) =>
  db.candidate.findUnique({
    where: { id },
    include: {
      applications: {
        include: { vacancy: true },
        orderBy: { createdAt: "desc" },
      },
      candidatePlacements: {
        orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
      },
      crmNotes: {
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
      cvProfile: { select: { id: true, updatedAt: true, anonymize: true } },
    },
  }),
);

/** Aantallen op de mapjes in de tabbalk — zo zie je meteen wat erin zit. */
export const getDossierCounts = cache(async (id: string) => {
  const c = await getCandidate(id);
  return {
    placements: c?.candidatePlacements.length ?? 0,
    notes: c?.crmNotes.length ?? 0,
    applications: c?.applications.length ?? 0,
  };
});

/** Bedrijfsnamen voor de plaatsing-invoer (bestaande klanten + opdrachtgevers). */
export const getCompanySuggestions = cache(async () => {
  const [clients, targets] = await Promise.all([
    db.client.findMany({ select: { companyName: true }, orderBy: { companyName: "asc" } }),
    db.targetClient.findMany({ select: { name: true }, orderBy: { name: "asc" } }),
  ]);
  return [
    ...new Set([...clients.map((c) => c.companyName), ...targets.map((t) => t.name)]),
  ].sort((a, b) => a.localeCompare(b));
});

/** Openstaande vacatures in dezelfde discipline — mogelijke matches. */
export const getMatches = cache(async (discipline: string | null) => {
  if (!discipline) return [];
  return db.vacancy.findMany({
    where: { discipline, status: { not: "CONCEPT" } },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
});
