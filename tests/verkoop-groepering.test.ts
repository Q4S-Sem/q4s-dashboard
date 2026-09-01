import assert from "node:assert/strict";
import test from "node:test";
import {
  groupVerkoopByClient,
  type VerkoopbareWeek,
} from "../src/lib/verkoop-groepering";

/** Een net goedgekeurde week die nog op een verkoopfactuur moet. */
const WEEK: VerkoopbareWeek = {
  timesheetId: "ts-1",
  status: "APPROVED",
  hasSales: false,
  clientId: "kl-1",
  clientName: "Van Dijk Industrie",
};

const week = (patch: Partial<VerkoopbareWeek> = {}): VerkoopbareWeek => ({ ...WEEK, ...patch });

test("een lege lijst levert geen groepen en niets overgeslagen op", () => {
  assert.deepEqual(groupVerkoopByClient([]), { groups: [], skipped: 0 });
});

test("een goedgekeurde week zonder verkoopfactuur komt in een groep bij zijn klant", () => {
  assert.deepEqual(groupVerkoopByClient([week()]), {
    groups: [{ clientId: "kl-1", clientName: "Van Dijk Industrie", timesheetIds: ["ts-1"] }],
    skipped: 0,
  });
});

test("weken van dezelfde klant komen samen op één factuurgroep", () => {
  const result = groupVerkoopByClient([week(), week({ timesheetId: "ts-2" })]);
  assert.equal(result.groups.length, 1);
  assert.deepEqual(result.groups[0].timesheetIds, ["ts-1", "ts-2"]);
  assert.equal(result.skipped, 0);
});

test("elke klant krijgt een eigen groep, in volgorde van binnenkomst", () => {
  const result = groupVerkoopByClient([
    week({ timesheetId: "ts-1", clientId: "kl-2", clientName: "Bakker BV" }),
    week({ timesheetId: "ts-2", clientId: "kl-1", clientName: "Van Dijk Industrie" }),
    week({ timesheetId: "ts-3", clientId: "kl-2", clientName: "Bakker BV" }),
  ]);
  assert.deepEqual(result.groups, [
    { clientId: "kl-2", clientName: "Bakker BV", timesheetIds: ["ts-1", "ts-3"] },
    { clientId: "kl-1", clientName: "Van Dijk Industrie", timesheetIds: ["ts-2"] },
  ]);
});

test("een week die al op een verkoopfactuur staat wordt overgeslagen", () => {
  assert.deepEqual(groupVerkoopByClient([week({ hasSales: true })]), { groups: [], skipped: 1 });
});

test("een week die niet goedgekeurd is wordt overgeslagen", () => {
  assert.deepEqual(groupVerkoopByClient([week({ status: "INVOICED" })]), { groups: [], skipped: 1 });
  assert.deepEqual(groupVerkoopByClient([week({ status: "SUBMITTED" })]), { groups: [], skipped: 1 });
});

test("een week zonder gekoppeld bedrijf wordt overgeslagen", () => {
  assert.deepEqual(groupVerkoopByClient([week({ clientId: null })]), { groups: [], skipped: 1 });
  assert.deepEqual(groupVerkoopByClient([week({ clientId: "  " })]), { groups: [], skipped: 1 });
});

test("een week zonder urenstaat-id wordt overgeslagen", () => {
  assert.deepEqual(groupVerkoopByClient([week({ timesheetId: "" })]), { groups: [], skipped: 1 });
});

test("dezelfde urenstaat twee keer levert één regel op, zonder als overgeslagen te tellen", () => {
  assert.deepEqual(groupVerkoopByClient([week(), week()]), {
    groups: [{ clientId: "kl-1", clientName: "Van Dijk Industrie", timesheetIds: ["ts-1"] }],
    skipped: 0,
  });
});

test("een ontbrekende klantnaam valt terug op dezelfde tekst als de rest van facturatie", () => {
  const result = groupVerkoopByClient([week({ clientName: null })]);
  assert.deepEqual(result.groups[0].clientName, "— geen bedrijf");
});

test("de klantnaam komt van de eerste week waar hij wél bekend is", () => {
  const result = groupVerkoopByClient([
    week({ timesheetId: "ts-1", clientName: null }),
    week({ timesheetId: "ts-2", clientName: "Van Dijk Industrie" }),
  ]);
  assert.equal(result.groups[0].clientName, "Van Dijk Industrie");
});

test("overgeslagen weken laten de rest gewoon doorgaan", () => {
  const result = groupVerkoopByClient([
    week({ timesheetId: "ts-1", hasSales: true }),
    week({ timesheetId: "ts-2" }),
    week({ timesheetId: "ts-3", clientId: null }),
  ]);
  assert.deepEqual(result.groups, [
    { clientId: "kl-1", clientName: "Van Dijk Industrie", timesheetIds: ["ts-2"] },
  ]);
  assert.equal(result.skipped, 2);
});
