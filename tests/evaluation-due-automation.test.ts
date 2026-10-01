import assert from "node:assert/strict";
import test from "node:test";
import { buildEvaluationDueTasks, currentEvaluationPeriod } from "../src/lib/automation-defs";

// Midden in Q4 2026, zodat het kwartaal nooit van de tijdzone afhangt.
const NOW = new Date("2026-11-16T10:00:00.000Z");
const TEMPLATE =
  "{status}: Kwartaalevaluatie {quarter} ontbreekt voor {name} bij {client} (bron: {sourceKey}).";

function placement(overrides: {
  id: string;
  consultantId: string;
  clientId?: string | null;
  company?: string | null;
  startDate?: Date;
  name?: string;
}) {
  const [firstName, lastName] = (overrides.name ?? "Ava Jansen").split(" ");
  return {
    id: overrides.id,
    consultantId: overrides.consultantId,
    clientId: overrides.clientId ?? null,
    startDate: overrides.startDate ?? new Date("2026-01-05T00:00:00.000Z"),
    consultant: { firstName, lastName },
    client: overrides.company ? { companyName: overrides.company } : null,
  };
}

test("het huidige evaluatieperiode-venster volgt UTC, los van de servertijdzone", () => {
  assert.deepEqual(currentEvaluationPeriod(NOW), { year: 2026, quarter: 4 });
  assert.deepEqual(currentEvaluationPeriod(new Date("2026-01-01T00:00:00.000Z")), {
    year: 2026,
    quarter: 1,
  });
  assert.deepEqual(currentEvaluationPeriod(new Date("2026-09-30T23:59:59.000Z")), {
    year: 2026,
    quarter: 3,
  });
});

test("per actieve plaatsing zonder kwartaalevaluatie komt er één review-taak", () => {
  const tasks = buildEvaluationDueTasks({
    now: NOW,
    thresholdDays: 14,
    template: TEMPLATE,
    placements: [
      // Geen enkele evaluatie dit kwartaal -> taak.
      placement({ id: "pl-open", consultantId: "c1", clientId: "cl1", company: "Sif Group", name: "Ava Jansen" }),
      // Evaluatie dit kwartaal bij dezelfde inlener -> geen taak.
      placement({ id: "pl-done", consultantId: "c2", clientId: "cl2", company: "Heerema", name: "Bram Smit" }),
      // Zelfde persoon, ándere inlener: die inlener is nog niet geëvalueerd -> taak.
      placement({ id: "pl-other-client", consultantId: "c2", clientId: "cl3", company: "Huisman", name: "Bram Smit" }),
      // Evaluatie uit een vorig kwartaal dekt dit kwartaal niet -> taak.
      placement({ id: "pl-stale", consultantId: "c3", clientId: "cl1", company: "Sif Group", name: "Chloë Vries" }),
      // Plaatsing loopt pas 6 dagen -> binnen de respijtdrempel, geen taak.
      placement({
        id: "pl-fresh",
        consultantId: "c4",
        clientId: "cl1",
        company: "Sif Group",
        startDate: new Date("2026-11-10T00:00:00.000Z"),
        name: "Daan Bakker",
      }),
      // Plaatsing zonder gekoppeld bedrijf -> taak, met leesbare vervangtekst.
      placement({ id: "pl-no-client", consultantId: "c5", name: "Eva Mulder" }),
      // Evaluatie met vrij ingevulde inlenernaam (geen clientId) -> dekt al zijn plaatsingen.
      placement({ id: "pl-freetext", consultantId: "c6", clientId: "cl1", company: "Sif Group", name: "Finn Dekker" }),
    ],
    evaluations: [
      { consultantId: "c2", clientId: "cl2", type: "VCU", year: 2026, quarter: 4 },
      { consultantId: "c3", clientId: "cl1", type: "VCU", year: 2026, quarter: 3 },
      { consultantId: "c6", clientId: null, type: "UITZENDKRACHT", year: 2026, quarter: 4 },
    ],
  });

  assert.deepEqual(tasks, [
    {
      entityType: "placement",
      entityId: "pl-open",
      sourceKey: "evaluation:pl-open:2026Q4",
      body: "KWARTAALEVALUATIE ONTBREEKT: Kwartaalevaluatie Q4 2026 ontbreekt voor Ava Jansen bij Sif Group (bron: evaluation:pl-open:2026Q4).",
    },
    {
      entityType: "placement",
      entityId: "pl-other-client",
      sourceKey: "evaluation:pl-other-client:2026Q4",
      body: "KWARTAALEVALUATIE ONTBREEKT: Kwartaalevaluatie Q4 2026 ontbreekt voor Bram Smit bij Huisman (bron: evaluation:pl-other-client:2026Q4).",
    },
    {
      entityType: "placement",
      entityId: "pl-stale",
      sourceKey: "evaluation:pl-stale:2026Q4",
      body: "KWARTAALEVALUATIE ONTBREEKT: Kwartaalevaluatie Q4 2026 ontbreekt voor Chloë Vries bij Sif Group (bron: evaluation:pl-stale:2026Q4).",
    },
    {
      entityType: "placement",
      entityId: "pl-no-client",
      sourceKey: "evaluation:pl-no-client:2026Q4",
      body: "KWARTAALEVALUATIE ONTBREEKT: Kwartaalevaluatie Q4 2026 ontbreekt voor Eva Mulder bij geen bedrijf gekoppeld (bron: evaluation:pl-no-client:2026Q4).",
    },
  ]);
});

test("de bronsleutel is per plaatsing én kwartaal stabiel, en de taak doet niets buiten de review", () => {
  const args = {
    thresholdDays: 0,
    template: "Evaluatie {quarter} openstaand voor {name} (start {date}).",
    placements: [placement({ id: "pl-1", consultantId: "c1", clientId: "cl1", company: "Sif Group" })],
    evaluations: [],
  };
  const q4 = buildEvaluationDueTasks({ ...args, now: NOW });
  const q4Again = buildEvaluationDueTasks({ ...args, now: new Date("2026-12-24T18:00:00.000Z") });
  const q1 = buildEvaluationDueTasks({ ...args, now: new Date("2027-02-02T08:00:00.000Z") });

  assert.deepEqual(q4, q4Again);
  assert.equal(q4[0].sourceKey, "evaluation:pl-1:2026Q4");
  assert.equal(q1[0].sourceKey, "evaluation:pl-1:2027Q1");
  assert.equal(q4[0].body, "Evaluatie Q4 2026 openstaand voor Ava Jansen (start 05-01-2026).");
  assert.deepEqual(Object.keys(q4[0]).sort(), ["body", "entityId", "entityType", "sourceKey"]);
});
