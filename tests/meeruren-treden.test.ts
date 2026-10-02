import assert from "node:assert/strict";
import test from "node:test";
import { computeTimesheetMoney, toeslagUren, type SurchargeConfig } from "../src/lib/toeslag";

// Contract HSM: € 70/u, ma–vr 9e & 10e uur +15%, overige meeruren +25%,
// zaterdag +50%, zon/feestdag +50%.
const hsm: SurchargeConfig = {
  costRate: 70,
  chargeRate: 85,
  weekendSurchargeBuy: 0,
  weekendSurchargeSell: 0,
  overtimeSurchargeBuy: 0,
  overtimeSurchargeSell: 0,
  kmRateBuy: 0,
  kmRateSell: 0,
  otFromHours: 8,
  ot1Hours: 2,
  weekdaySurchargeBuy: 15,
  weekdaySurchargeSell: 15,
  weekday2SurchargeBuy: 25,
  weekday2SurchargeSell: 0, // niet doorrekenen: wij betalen het
  saturdaySurchargeBuy: 50,
  saturdaySurchargeSell: 50,
};
// week 41 2026: ma 12 u, di 9 u, wo 8 u, do–vr 0, za 6 u
const d = (dag: number, hours: number) => ({ date: new Date(2026, 9, dag), hours });
const week = [d(5, 12), d(6, 9), d(7, 8), d(10, 6)];

test("meeruren worden per dag in treden verdeeld", () => {
  const tu = toeslagUren(week, hsm);
  assert.equal(tu.weekdayHours, 3); // ma 2 + di 1
  assert.equal(tu.weekday2Hours, 2); // ma uur 11–12
  assert.equal(tu.saturdayHours, 6);
});

test("niet doorgerekende toeslag: wij betalen, klant niet → marge lager", () => {
  const m = computeTimesheetMoney({ entries: week, overtimeHours: null, kilometers: null }, hsm);
  // inkoop toeslagen: 3×10,50 + 2×17,50 + 6×35 = 31,5 + 35 + 210
  assert.equal(m.buy.surchargeTotal, 276.5);
  // verkoop: 3×12,75 + 0 + 6×42,50 = 38,25 + 255
  assert.equal(m.sell.surchargeTotal, 293.25);
  assert.ok(m.sell.surcharges.every((r) => r.type !== "weekday2"));
});

test("feestdag op een werkdag telt als zondag", () => {
  // 25 dec 2026 = vrijdag (1e Kerstdag)
  const tu = toeslagUren([{ date: new Date(2026, 11, 25), hours: 10 }], hsm);
  assert.equal(tu.sundayHours, 10);
  assert.equal(tu.weekdayHours, 0);
});

test("zonder 'meeruren vanaf' blijft het oude gedrag", () => {
  const tu = toeslagUren(week, {});
  assert.equal(tu.weekdayHours, 29);
  assert.equal(tu.weekday2Hours, 0);
});
