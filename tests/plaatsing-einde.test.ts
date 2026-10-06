import { test } from "node:test";
import assert from "node:assert/strict";
import { eindeStatus } from "../src/lib/plaatsing-einde";

const d = (s: string) => new Date(`${s}T10:00:00`);

test("eindeStatus: melding in de laatste kalendermaand, verlopen daarna", () => {
  assert.equal(eindeStatus(null, d("2026-10-06")), null);
  assert.equal(eindeStatus(d("2026-12-31"), d("2026-10-06")), null);
  assert.equal(eindeStatus(d("2026-11-07"), d("2026-10-06")), null); // 1 dag vóór de laatste maand
  assert.deepEqual(eindeStatus(d("2026-11-06"), d("2026-10-06")), { status: "laatste-maand", dagen: 31 });
  assert.deepEqual(eindeStatus(d("2026-10-06"), d("2026-10-06")), { status: "laatste-maand", dagen: 0 });
  assert.deepEqual(eindeStatus(d("2026-10-01"), d("2026-10-06")), { status: "verlopen", dagen: -5 });
});
