import assert from "node:assert/strict";
import test from "node:test";
import {
  groupInkoopByConsultant,
  type InkoopbareWeek,
} from "../src/lib/inkoop-groepering";

/** Een net goedgekeurde week die nog op een inkoopfactuur moet. */
const WEEK: InkoopbareWeek = {
  timesheetId: "ts-1",
  status: "APPROVED",
  hasPurchase: false,
  consultantId: "mw-1",
  consultantName: "Jan de Vries",
  loondienst: false,
};

const week = (patch: Partial<InkoopbareWeek> = {}): InkoopbareWeek => ({ ...WEEK, ...patch });

test("een lege lijst levert geen groepen, niets overgeslagen en geen loondienst op", () => {
  assert.deepEqual(groupInkoopByConsultant([]), { groups: [], skipped: 0, loondienst: 0 });
});

test("een goedgekeurde week zonder inkoopfactuur komt in een groep bij zijn medewerker", () => {
  assert.deepEqual(groupInkoopByConsultant([week()]), {
    groups: [{ consultantId: "mw-1", consultantName: "Jan de Vries", timesheetIds: ["ts-1"] }],
    skipped: 0,
    loondienst: 0,
  });
});

test("weken van dezelfde medewerker komen samen op één inkoopgroep", () => {
  const result = groupInkoopByConsultant([week(), week({ timesheetId: "ts-2" })]);
  assert.equal(result.groups.length, 1);
  assert.deepEqual(result.groups[0].timesheetIds, ["ts-1", "ts-2"]);
  assert.equal(result.skipped, 0);
});

test("elke medewerker krijgt een eigen groep, in volgorde van binnenkomst", () => {
  const result = groupInkoopByConsultant([
    week({ timesheetId: "ts-1", consultantId: "mw-2", consultantName: "Piet Bakker" }),
    week({ timesheetId: "ts-2", consultantId: "mw-1", consultantName: "Jan de Vries" }),
    week({ timesheetId: "ts-3", consultantId: "mw-2", consultantName: "Piet Bakker" }),
  ]);
  assert.deepEqual(result.groups, [
    { consultantId: "mw-2", consultantName: "Piet Bakker", timesheetIds: ["ts-1", "ts-3"] },
    { consultantId: "mw-1", consultantName: "Jan de Vries", timesheetIds: ["ts-2"] },
  ]);
});

test("een week die al op een inkoopfactuur staat wordt overgeslagen", () => {
  assert.deepEqual(groupInkoopByConsultant([week({ hasPurchase: true })]), {
    groups: [],
    skipped: 1,
    loondienst: 0,
  });
});

test("een week die al verkocht is (INVOICED) mag nog wél op een inkoopfactuur", () => {
  const result = groupInkoopByConsultant([week({ status: "INVOICED" })]);
  assert.deepEqual(result.groups, [
    { consultantId: "mw-1", consultantName: "Jan de Vries", timesheetIds: ["ts-1"] },
  ]);
  assert.equal(result.skipped, 0);
});

test("een week die nog niet goedgekeurd is wordt overgeslagen", () => {
  assert.deepEqual(groupInkoopByConsultant([week({ status: "SUBMITTED" })]), {
    groups: [],
    skipped: 1,
    loondienst: 0,
  });
  assert.deepEqual(groupInkoopByConsultant([week({ status: "REJECTED" })]), {
    groups: [],
    skipped: 1,
    loondienst: 0,
  });
});

test("loondienst krijgt geen inkoopfactuur en telt apart, niet als overgeslagen", () => {
  assert.deepEqual(groupInkoopByConsultant([week({ loondienst: true })]), {
    groups: [],
    skipped: 0,
    loondienst: 1,
  });
});

test("een week zonder medewerker wordt overgeslagen", () => {
  assert.deepEqual(groupInkoopByConsultant([week({ consultantId: null })]), {
    groups: [],
    skipped: 1,
    loondienst: 0,
  });
  assert.deepEqual(groupInkoopByConsultant([week({ consultantId: "  " })]), {
    groups: [],
    skipped: 1,
    loondienst: 0,
  });
});

test("een week zonder urenstaat-id wordt overgeslagen", () => {
  assert.deepEqual(groupInkoopByConsultant([week({ timesheetId: "" })]), {
    groups: [],
    skipped: 1,
    loondienst: 0,
  });
});

test("dezelfde urenstaat twee keer levert één regel op, zonder als overgeslagen te tellen", () => {
  assert.deepEqual(groupInkoopByConsultant([week(), week()]), {
    groups: [{ consultantId: "mw-1", consultantName: "Jan de Vries", timesheetIds: ["ts-1"] }],
    skipped: 0,
    loondienst: 0,
  });
});

test("een ontbrekende naam valt terug op een neutrale tekst", () => {
  const result = groupInkoopByConsultant([week({ consultantName: null })]);
  assert.equal(result.groups[0].consultantName, "— geen naam");
});

test("de naam komt van de eerste week waar hij wél bekend is", () => {
  const result = groupInkoopByConsultant([
    week({ timesheetId: "ts-1", consultantName: null }),
    week({ timesheetId: "ts-2", consultantName: "Jan de Vries" }),
  ]);
  assert.equal(result.groups[0].consultantName, "Jan de Vries");
});

test("overgeslagen en loondienst-weken laten de rest gewoon doorgaan", () => {
  const result = groupInkoopByConsultant([
    week({ timesheetId: "ts-1", hasPurchase: true }),
    week({ timesheetId: "ts-2" }),
    week({ timesheetId: "ts-3", consultantId: null }),
    week({ timesheetId: "ts-4", consultantId: "mw-9", loondienst: true }),
  ]);
  assert.deepEqual(result.groups, [
    { consultantId: "mw-1", consultantName: "Jan de Vries", timesheetIds: ["ts-2"] },
  ]);
  assert.equal(result.skipped, 2);
  assert.equal(result.loondienst, 1);
});
