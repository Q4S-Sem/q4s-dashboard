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
