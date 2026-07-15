import { db } from "./db";

const uniqSorted = (arr: (string | null | undefined)[]): string[] =>
  Array.from(
    new Set(
      arr.filter((x): x is string => Boolean(x && x.trim())).map((x) => x.trim()),
    ),
  ).sort((a, b) => a.localeCompare(b, "nl"));

/** Type-ahead suggestions for the evaluation header fields, from existing data. */
export async function getEvalSuggestions(): Promise<Record<string, string[]>> {
  const [clients, placements, evals] = await Promise.all([
    db.client.findMany({ select: { companyName: true } }),
    db.placement.findMany({ select: { title: true } }),
    db.evaluation.findMany({
      select: {
        clientName: true,
        clientAddress: true,
        functionTitle: true,
        workLocation: true,
        department: true,
        periodText: true,
      },
    }),
  ]);

  return {
    clientName: uniqSorted([
      ...clients.map((c) => c.companyName),
      ...evals.map((e) => e.clientName),
    ]),
    clientAddress: uniqSorted(evals.map((e) => e.clientAddress)),
    functionTitle: uniqSorted([
      ...placements.map((p) => p.title),
      ...evals.map((e) => e.functionTitle),
    ]),
    workLocation: uniqSorted(evals.map((e) => e.workLocation)),
    department: uniqSorted(evals.map((e) => e.department)),
    periodText: uniqSorted(evals.map((e) => e.periodText)),
  };
}
