import assert from "node:assert/strict";
import test from "node:test";
import { buildDossierIncompleteTasks } from "../src/lib/automation-defs";
import type { DossierPerson } from "../src/lib/dossier-check";

const NOW = new Date("2026-10-01T09:00:00.000Z");
const TEMPLATE =
  "{status}: dossier van {name} mist {count} stuk(ken) — {missing} (bron: {sourceKey}).";

function person(overrides: Partial<DossierPerson> = {}): DossierPerson {
  return {
    id: "p1",
    kind: "consultant",
    name: "Ava Jansen",
    employmentType: "LOONDIENST",
    documentCategories: ["ID", "CONTRACT"],
    certificates: [],
    lastEvaluationAt: new Date("2026-09-01T00:00:00.000Z"),
    ...overrides,
  };
}

test("alleen onvolledige dossiers krijgen een review-taak, op het juiste record", () => {
  const tasks = buildDossierIncompleteTasks({
    now: NOW,
    template: TEMPLATE,
    people: [
      // Volledig -> geen taak.
      person({ id: "ok-1", name: "Zoë Groen" }),
      // ZZP zonder KvK -> rood.
      person({ id: "zzp-1", name: "Bram Smit", employmentType: "ZZP" }),
      // Eigen medewerker zonder identiteitsbewijs -> rood op /medewerkers.
      person({ id: "emp-1", name: "Chloë Vries", kind: "employee", documentCategories: ["CONTRACT"] }),
      // Alleen een te oude evaluatie -> oranje.
      person({ id: "soft-1", name: "Daan Bakker", lastEvaluationAt: new Date("2026-01-20T00:00:00.000Z") }),
    ],
  });

  assert.deepEqual(tasks, [
    {
      entityType: "consultant",
      entityId: "zzp-1",
      sourceKey: "dossier:zzp-1:KVK",
      body: "DOSSIER NIET AUDITPROOF: dossier van Bram Smit mist 1 stuk(ken) — KvK-uittreksel (bron: dossier:zzp-1:KVK).",
    },
    {
      entityType: "employee",
      entityId: "emp-1",
      sourceKey: "dossier:emp-1:ID",
      body: "DOSSIER NIET AUDITPROOF: dossier van Chloë Vries mist 1 stuk(ken) — Identiteitsbewijs (vastlegging conform AVG) (bron: dossier:emp-1:ID).",
    },
    {
      entityType: "consultant",
      entityId: "soft-1",
      sourceKey: "dossier:soft-1:EVALUATION",
      body: "DOSSIER VRAAGT AANDACHT: dossier van Daan Bakker mist 1 stuk(ken) — Evaluatie in de laatste 6 maanden (bron: dossier:soft-1:EVALUATION).",
    },
  ]);
});

test("de bronsleutel volgt de gesorteerde set ontbrekende stukken, dus een afgehandeld stuk geeft een nieuwe taak", () => {
  const incomplete = person({
    id: "p-9",
    employmentType: "ZZP",
    documentCategories: [],
    certificates: [{ name: "VCA VOL", expiryDate: new Date("2026-08-15T00:00:00.000Z") }],
    lastEvaluationAt: null,
  });
  const [full] = buildDossierIncompleteTasks({ now: NOW, template: "{missing}", people: [incomplete] });
  const [repeat] = buildDossierIncompleteTasks({ now: NOW, template: "{missing}", people: [incomplete] });
  const [afterKvk] = buildDossierIncompleteTasks({
    now: NOW,
    template: "{missing}",
    people: [{ ...incomplete, documentCategories: ["KVK"] }],
  });

  assert.equal(full.sourceKey, "dossier:p-9:CERTIFICATES+CONTRACT+EVALUATION+ID+KVK");
  assert.equal(repeat.sourceKey, full.sourceKey);
  assert.equal(afterKvk.sourceKey, "dossier:p-9:CERTIFICATES+CONTRACT+EVALUATION+ID");
  assert.equal(
    full.body,
    "Identiteitsbewijs (vastlegging conform AVG), Contract / overeenkomst van opdracht, KvK-uittreksel, Geldige certificaten (niets verlopen), Evaluatie in de laatste 6 maanden",
  );
});
