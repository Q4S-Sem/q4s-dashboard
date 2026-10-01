import assert from "node:assert/strict";
import test from "node:test";
import {
  DOSSIER_REQUIREMENTS,
  EVALUATION_MAX_AGE_MONTHS,
  checkDossier,
  checkDossiers,
  dossierHref,
  type DossierPerson,
} from "../src/lib/dossier-check";

const NOW = new Date("2026-10-01T09:00:00.000Z");

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

test("de verplichte set staat in één aanpasbare lijst, met de ernst per stuk", () => {
  assert.deepEqual(
    DOSSIER_REQUIREMENTS.map((r) => [r.key, r.severity]),
    [
      ["ID", "hard"],
      ["CONTRACT", "hard"],
      ["KVK", "hard"],
      ["CERTIFICATES", "hard"],
      ["EVALUATION", "soft"],
    ],
  );
  assert.equal(EVALUATION_MAX_AGE_MONTHS, 6);
});

test("een volledig dossier is groen en meldt niets", () => {
  const check = checkDossier(person(), NOW);

  assert.equal(check.status, "green");
  assert.deepEqual(check.issues, []);
  assert.deepEqual(check.missingKeys, []);
  // KvK geldt alleen voor ZZP — die eis hoort hier niet in de lijst te staan.
  assert.deepEqual(
    check.items.map((i) => i.key),
    ["ID", "CONTRACT", "CERTIFICATES", "EVALUATION"],
  );
  assert.deepEqual(Object.keys(check.items[0]).sort(), ["detail", "key", "label", "severity", "status"]);
});

test("ZZP zonder KvK, met een verlopen certificaat en zonder evaluatie is rood", () => {
  const check = checkDossier(
    person({
      employmentType: "ZZP",
      certificates: [
        { name: "VCA VOL", expiryDate: new Date("2026-08-15T00:00:00.000Z") },
        { name: "NEN 1090", expiryDate: new Date("2027-01-01T00:00:00.000Z") },
        { name: "Heftruck", expiryDate: null },
      ],
      lastEvaluationAt: null,
    }),
    NOW,
  );

  assert.equal(check.status, "red");
  assert.deepEqual(check.missingKeys, ["CERTIFICATES", "EVALUATION", "KVK"]);
  assert.deepEqual(
    check.issues.map((i) => [i.key, i.status, i.detail]),
    [
      ["KVK", "missing", "verplicht bij ZZP/freelance (ketenaansprakelijkheid)"],
      ["CERTIFICATES", "expired", "verlopen: VCA VOL (15-08-2026)"],
      ["EVALUATION", "missing", "nog geen evaluatie vastgelegd"],
    ],
  );
});

test("alleen een te oude evaluatie geeft oranje, niet rood", () => {
  const check = checkDossier(person({ lastEvaluationAt: new Date("2026-03-15T00:00:00.000Z") }), NOW);

  assert.equal(check.status, "amber");
  assert.deepEqual(
    check.issues.map((i) => [i.key, i.status, i.detail]),
    [["EVALUATION", "expired", "laatste evaluatie 15-03-2026"]],
  );
});

test("de evaluatiegrens van zes maanden ligt precies op de dag", () => {
  const onTheEdge = checkDossier(person({ lastEvaluationAt: new Date("2026-04-01T00:00:00.000Z") }), NOW);
  const justOver = checkDossier(person({ lastEvaluationAt: new Date("2026-03-31T00:00:00.000Z") }), NOW);

  assert.equal(onTheEdge.status, "green");
  assert.equal(justOver.status, "amber");
});

test("een certificaat dat vandaag verloopt is nog geldig", () => {
  const check = checkDossier(
    person({ certificates: [{ name: "VCA VOL", expiryDate: new Date("2026-10-01T00:00:00.000Z") }] }),
    NOW,
  );

  assert.equal(check.status, "green");
});

test("een Contract-record vervangt een geüpload contractdocument", () => {
  const withRecord = checkDossier(person({ documentCategories: ["ID"], hasContractRecord: true }), NOW);
  const without = checkDossier(person({ documentCategories: ["ID"] }), NOW);

  assert.deepEqual(withRecord.missingKeys, []);
  assert.deepEqual(without.missingKeys, ["CONTRACT"]);
});

test("eigen medewerkers hebben geen kwartaalevaluatie-eis, ZZP'ers wel een KvK-eis", () => {
  const staff = checkDossier(
    person({ id: "e1", kind: "employee", lastEvaluationAt: null }),
    NOW,
  );
  const freelanceStaff = checkDossier(
    person({ id: "e2", kind: "employee", employmentType: "ZZP", lastEvaluationAt: null }),
    NOW,
  );

  assert.deepEqual(
    staff.items.map((i) => i.key),
    ["ID", "CONTRACT", "CERTIFICATES"],
  );
  assert.equal(staff.status, "green");
  assert.deepEqual(freelanceStaff.missingKeys, ["KVK"]);
});

test("de lijst zet de slechtste dossiers bovenaan en is verder alfabetisch", () => {
  const checks = checkDossiers(
    [
      person({ id: "a", name: "Zoë Groen" }),
      person({ id: "b", name: "Bram Oranje", lastEvaluationAt: null }),
      person({ id: "c", name: "Chloë Rood", documentCategories: [] }),
      person({ id: "d", name: "Ava Oranje", lastEvaluationAt: null }),
    ],
    NOW,
  );

  assert.deepEqual(
    checks.map((c) => [c.name, c.status]),
    [
      ["Chloë Rood", "red"],
      ["Ava Oranje", "amber"],
      ["Bram Oranje", "amber"],
      ["Zoë Groen", "green"],
    ],
  );
});

test("de dossierlink wijst naar het juiste hub-dossier", () => {
  assert.equal(dossierHref({ kind: "consultant", id: "c1" }), "/werknemers/c1");
  assert.equal(dossierHref({ kind: "employee", id: "e1" }), "/medewerkers/e1");
});
