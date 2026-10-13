import { test } from "node:test";
import assert from "node:assert/strict";
import { computeTimesheetMoney } from "../src/lib/toeslag";

test("meeruren 'vanaf 0 uur' verdubbelt de verkoop niet (Richard: 44 u × €72 = €3.168)", () => {
  const ma = new Date(2026, 9, 5);
  const dag = (i: number, h: number) => ({ date: new Date(ma.getFullYear(), ma.getMonth(), ma.getDate() + i), hours: h });
  const m = computeTimesheetMoney(
    { entries: [dag(0, 8.5), dag(1, 9), dag(2, 9), dag(3, 9), dag(4, 8.5)], overtimeHours: 0, kilometers: 315 },
    {
      chargeRate: 72, costRate: 50, weekendSurchargeSell: 0, weekendSurchargeBuy: 0,
      overtimeSurchargeSell: 0, overtimeSurchargeBuy: 0, kmRateSell: 0, kmRateBuy: 0,
      otFromHours: 0, ot1Hours: 2, weekdaySurchargeSell: 100, weekday2SurchargeSell: 100,
    } as never,
  );
  assert.equal(m.sell.total, 3168);
});
