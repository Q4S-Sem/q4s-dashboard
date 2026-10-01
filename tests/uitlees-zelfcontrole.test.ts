import assert from "node:assert/strict";
import test from "node:test";
import { twijfelUrenstaat } from "../src/lib/inbox-extract";
import { twijfelFactuur } from "../src/lib/invoice-extract";

// Deze zelfcontroles bepalen of het STERKE model een document nog eens leest.
const dag = (hours: number) => ({ date: "2026-09-28", hours });

test("urenstaat: dagtotalen moeten het weektotaal op de staat halen", () => {
  assert.equal(twijfelUrenstaat({ days: [dag(8), dag(8)], reportedTotalHours: 16, confidence: "high" }), null);
  assert.match(twijfelUrenstaat({ days: [dag(8), dag(0)], reportedTotalHours: 16, confidence: "high" })!, /16/);
  assert.match(twijfelUrenstaat({ days: [dag(8)], reportedTotalHours: 0, confidence: "low" })!, /onzeker/);
  assert.ok(twijfelUrenstaat({ days: [], reportedTotalHours: 0, confidence: "high" }));
  assert.ok(twijfelUrenstaat({ days: [dag(32)], reportedTotalHours: 0, confidence: "high" }));
  assert.ok(twijfelUrenstaat(null));
});

test("factuur: excl. + btw moet het totaal zijn, behalve bij btw verlegd", () => {
  const goed = { name: "Balder", amountExclVat: 1000, vatAmount: 210, totalAmount: 1210, confidence: 0.9, vatShifted: false };
  assert.equal(twijfelFactuur(goed), null);
  assert.match(twijfelFactuur({ ...goed, totalAmount: 1300 })!, /totaal/);
  assert.equal(twijfelFactuur({ ...goed, vatShifted: true, vatAmount: 0, totalAmount: 1000 }), null);
  assert.ok(twijfelFactuur({ ...goed, name: "" }));
  assert.ok(twijfelFactuur({ ...goed, confidence: 0.3 }));
  assert.ok(twijfelFactuur({ ...goed, amountExclVat: 0, totalAmount: 0 }));
});
