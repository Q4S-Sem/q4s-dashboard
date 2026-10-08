import assert from "node:assert/strict";
import test from "node:test";
import { buildTimesheetLines, computeTimesheetMoney, sideSurcharges, type SurchargeConfig } from "../src/lib/toeslag";

// Wat je bij Week verwerken ziet (computeTimesheetMoney) moet exact gelijk zijn aan
// wat er op de facturen komt (buildTimesheetLines) — per zijde, voor %/€ en dag/uur.
const basis: SurchargeConfig = {
  costRate: 62.5, chargeRate: 84, weekendSurchargeBuy: 0, weekendSurchargeSell: 0,
  overtimeSurchargeBuy: 25, overtimeSurchargeSell: 30, overtimeChargeRate: 120, overtimeCostRate: null,
  otFromHours: 8, ot1Hours: 2,
  weekdaySurchargeBuy: 25, weekdaySurchargeSell: 12.5, weekdaySurchargeUnit: "PCT", weekdaySurchargeSellUnit: "FIXED",
  weekday2SurchargeBuy: 50, weekday2SurchargeSell: 60, weekday2SurchargeUnit: "PCT", weekday2SurchargeSellUnit: "PCT",
  saturdaySurchargeBuy: 10, saturdaySurchargeSell: 15, saturdaySurchargeUnit: "FIXED", saturdaySurchargeSellUnit: "FIXED",
  sundaySurchargeBuy: 100, sundaySurchargeSell: 100, sundaySurchargeUnit: "PCT",
  shiftEnabled: true, shiftSurchargeBuy: 3, shiftSurchargeSell: 4.25, shiftSurchargeUnit: "FIXED",
  kmRateBuy: 0.23, kmRateSell: 0.4,
};
const week = {
  entries: [11, 9.5, 8, 12, 7, 6, 4].map((hours, i) => ({ date: new Date(Date.UTC(2026, 8, 7 + i)), hours })),
  overtimeHours: 3, kilometers: 412,
};

for (const rateUnit of ["HOUR", "DAY"]) {
  test(`preview = factuur (${rateUnit})`, () => {
    const p = { ...basis, rateUnit };
    const m = computeTimesheetMoney(week, p);
    for (const kant of ["sell", "buy"] as const) {
      const sell = kant === "sell";
      const lines = buildTimesheetLines({
        timesheetId: "t", placementId: "p", weekNumber: 37, location: null, baseDescription: "Uren",
        entries: week.entries, overtimeHours: week.overtimeHours, kilometers: week.kilometers,
        rate: sell ? p.chargeRate : p.costRate,
        weekendPct: sell ? p.weekendSurchargeSell : p.weekendSurchargeBuy,
        surcharges: sideSurcharges(p, kant),
        overtimePct: sell ? p.overtimeSurchargeSell : p.overtimeSurchargeBuy,
        overtimeRate: sell ? p.overtimeChargeRate : p.overtimeCostRate,
        kmRate: sell ? p.kmRateSell : p.kmRateBuy,
        rateUnit, otFromHours: p.otFromHours, ot1Hours: p.ot1Hours,
      });
      const som = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;
      assert.equal(som, m[kant].total, `${kant}: factuur ${som} ≠ preview ${m[kant].total}`);
    }
  });
}
