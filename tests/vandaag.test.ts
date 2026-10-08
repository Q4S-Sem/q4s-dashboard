import assert from "node:assert/strict";
import test from "node:test";
import { startVandaagNL } from "../src/lib/vandaag";

test("vandaag begint om middernacht Nederlandse tijd (zomer- en wintertijd)", () => {
  // 8 okt 00:30 NL = 7 okt 22:30 UTC → hoort al bij 8 okt.
  assert.equal(startVandaagNL(new Date("2026-10-07T22:30:00Z")).toISOString(), "2026-10-07T22:00:00.000Z");
  assert.equal(startVandaagNL(new Date("2026-10-08T15:00:00Z")).toISOString(), "2026-10-07T22:00:00.000Z");
  assert.equal(startVandaagNL(new Date("2026-12-10T12:00:00Z")).toISOString(), "2026-12-09T23:00:00.000Z");
});
