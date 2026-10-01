import assert from "node:assert/strict";
import test from "node:test";
import { buildTimesheetLines, computeTimesheetMoney, type SurchargeConfig } from "../src/lib/toeslag";

const basis: SurchargeConfig = {
  costRate: 400,
  chargeRate: 520,
  rateUnit: "DAY",
  weekendSurchargeBuy: 0,
  weekendSurchargeSell: 0,
  overtimeSurchargeBuy: 0,
  overtimeSurchargeSell: 0,
  kmRateBuy: 0,
  kmRateSell: 0,
};
// ma-vr 10 u, za 6 u, zo 0 u (week 40, 2026)
const entries = [28, 29, 30, 1, 2, 3, 4].map((d, i) => ({
  date: new Date(2026, d > 20 ? 8 : 9, d),
  hours: i < 5 ? 10 : i === 5 ? 6 : 0,
}));

test("dagtarief: elke gewerkte dag telt 1, ongeacht de uren", () => {
  const m = computeTimesheetMoney({ entries, overtimeHours: null, kilometers: null }, basis);
  assert.equal(m.days, 6);
  assert.equal(m.hours, 56); // weergave blijft in uren
  assert.equal(m.buy.base, 2400);
  assert.equal(m.sell.base, 3120);
  assert.equal(m.margin, 720);
});

test("dagtarief: zaterdagtoeslag rekent per dag; overuur = dag/8", () => {
  const m = computeTimesheetMoney(
    { entries, overtimeHours: 2, kilometers: null },
    { ...basis, saturdaySurchargeBuy: 50, saturdaySurchargeUnit: "PCT" },
  );
  assert.equal(m.buy.surchargeTotal, 200); // 1 zaterdag × 50% van 400
  assert.equal(m.buy.overtime, 100); // 2 × 400/8
});

test("dagtarief: factuurregel = dagen × dagtarief", () => {
  const [hoofd] = buildTimesheetLines({
    timesheetId: "t", placementId: "p", weekNumber: 40, location: null, baseDescription: "x",
    entries, overtimeHours: null, kilometers: null, rate: 520, rateUnit: "DAY",
    weekendPct: 0, overtimePct: 0, kmRate: 0,
  });
  assert.deepEqual([hoofd.quantity, hoofd.unitPrice, hoofd.amount], [6, 520, 3120]);
});

test("uurtarief blijft ongewijzigd", () => {
  const m = computeTimesheetMoney({ entries, overtimeHours: null, kilometers: null }, { ...basis, rateUnit: "HOUR", costRate: 50, chargeRate: 65 });
  assert.equal(m.days, null);
  assert.equal(m.buy.base, 2800);
});
