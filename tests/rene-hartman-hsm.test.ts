import assert from "node:assert/strict";
import test from "node:test";
import { computeTimesheetMoney, type SurchargeConfig } from "../src/lib/toeslag";
import { bewerkAfstand, naamOpStaatKlopt } from "../src/lib/facturatie-checks";

// Echte week 41 van René Hartman (HSM): staat = 8 u/dag + aparte overuren-rij
// (ma 3, di 1, wo 1, do 3, za 6). Zijn factuur: 40×70 + 6×80,50 + 2×87,50 + 6×105 = € 4.088.
const hsm: SurchargeConfig = {
  costRate: 70, chargeRate: 85,
  weekendSurchargeBuy: 0, weekendSurchargeSell: 0, overtimeSurchargeBuy: 0, overtimeSurchargeSell: 0,
  kmRateBuy: 0, kmRateSell: 0,
  otFromHours: 8, ot1Hours: 2,
  weekdaySurchargeBuy: 15, weekdaySurchargeSell: 15,
  weekday2SurchargeBuy: 25, weekday2SurchargeSell: 25,
  saturdaySurchargeBuy: 50, saturdaySurchargeSell: 50,
};
const d = (dag: number, hours: number) => ({ date: new Date(2026, 9, dag), hours });

test("overuren per dag opgeteld → inkoop = zijn factuur (€ 4.088)", () => {
  // Zoals de uitlezing het nu doet: overuren per dag bij de gewone uren.
  const week = [d(5, 11), d(6, 9), d(7, 9), d(8, 11), d(9, 8), d(10, 6)];
  const m = computeTimesheetMoney({ entries: week, overtimeHours: 0, kilometers: null }, hsm);
  assert.equal(m.buy.total, 4088);
});

test("R.Hartman op de staat = René Hartman; handschrift 'smuldees' = Smulders", () => {
  assert.ok(naamOpStaatKlopt({ firstName: "Rene", lastName: "Hartman" }, "R.Hartman"));
  assert.ok(!naamOpStaatKlopt({ firstName: "Rene", lastName: "Hartman" }, "J.Hartman"));
  assert.equal(bewerkAfstand("smuldees", "smulders"), 1);
});

test("factuurregel zonder omschrijving herkend aan het tarief: 6 u à € 105 = zaterdag +50%", async () => {
  const { toeslagOpTarief } = await import("../src/lib/facturatie-checks");
  const regels = [
    { label: "6 uur a €80,50", quantity: 6, unit: "uur", amount: 483 },
    { label: "6 uur a €105,00", quantity: 6, unit: "uur", amount: 630 },
  ];
  assert.equal(toeslagOpTarief(regels, 70, { value: 50, unit: "PCT" })?.amount, 630);
  assert.equal(toeslagOpTarief(regels, 70, { value: 15, unit: "PCT" })?.amount, 483);
  assert.equal(toeslagOpTarief(regels, 70, { value: 40, unit: "PCT" }), null);
});

test("factuur telt 40 + 6 + 2 + 6 = 54 gewerkte uren (toeslag-only regel telt niet mee)", async () => {
  const { factuurTotaalUren } = await import("../src/lib/facturatie-checks");
  const surchargeLines = [
    { label: "6 uur a €80,50", quantity: 6, unit: "uur", amount: 483 },
    { label: "2 uur a €87,50", quantity: 2, unit: "uur", amount: 175 },
    { label: "6 uur a €105,00", quantity: 6, unit: "uur", amount: 630 },
  ];
  assert.equal(factuurTotaalUren({ hours: 40, overtimeHours: 0, surchargeLines }, 70), 54);
  // Zelfde uren ook als "overuren 14" uitgelezen → niet dubbel tellen.
  assert.equal(factuurTotaalUren({ hours: 40, overtimeHours: 14, surchargeLines }, 70), 54);
  // Alleen toeslag over dezelfde uren (6 u × € 35) = geen extra gewerkte uren.
  assert.equal(factuurTotaalUren({ hours: 40, overtimeHours: 0, surchargeLines: [{ label: "zaterdagtoeslag", quantity: 6, unit: "uur", amount: 210 }] }, 70), 40);
});

test("verkoopfactuur splitst uit: 40 normaal + 6×115% + 2×125% + 6×150% (zelfde totaal)", async () => {
  const { buildTimesheetLines, sideSurcharges } = await import("../src/lib/toeslag");
  const p = { ...hsm, chargeRate: 77, saturdaySurchargeSell: 50, weekdaySurchargeSell: 15, weekday2SurchargeSell: 25 } as never;
  const lines = buildTimesheetLines({
    timesheetId: "t", placementId: "p", weekNumber: 41, location: "Schiedam", baseDescription: "Normal hours Rene Hartman",
    entries: [d(5, 11), d(6, 9), d(7, 9), d(8, 11), d(9, 8), d(10, 6)], overtimeHours: 0, kilometers: 0,
    rate: 77, weekendPct: 0, surcharges: sideSurcharges(p, "sell"), overtimePct: 0, kmRate: 0, otFromHours: 8, ot1Hours: 2, uitsplitsen: true,
  });
  assert.deepEqual(lines.map((l) => [l.quantity, l.unitPrice]), [[40, 77], [6, 88.55], [2, 96.25], [6, 115.5]]);
  assert.ok(lines.every((l) => l.weekNumber === 41 && l.location === "Schiedam"));
  assert.equal(Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100, 4496.8); // = 4158 + 69,30 + 38,50 + 231
});

test("weekdatums op de factuurregel", async () => {
  const { weekDatums } = await import("../src/lib/invoicing");
  assert.equal(weekDatums(new Date(2026, 9, 5)), "5–11 Oct 2026");
});
