import { test } from "node:test";
import assert from "node:assert/strict";
import { deltaPct, periodeUit } from "../src/lib/analytics-periode";

test("analytics-periode: lopend kwartaal vergelijkt met even lang stuk vorig kwartaal", () => {
  const now = new Date(2026, 9, 5, 14); // 5 okt 2026
  const p = periodeUit({}, now);
  assert.equal(p.label, "Q4 2026");
  assert.equal(p.lopend, true);
  assert.deepEqual(p.prevStart, new Date(2026, 6, 1));
  assert.deepEqual(p.prevEnd, new Date(2026, 6, 6)); // 1 t/m 5 juli
  assert.equal(p.prevLabel, "Q3 2026 t/m zelfde dag");

  const q1 = periodeUit({ q: "1", year: "2026" }, now); // afgelopen kwartaal
  assert.equal(q1.lopend, false);
  assert.deepEqual(q1.prevStart, new Date(2025, 9, 1));
  assert.deepEqual(q1.prevEnd, new Date(2026, 0, 1));
  assert.equal(q1.prevLabel, "Q4 2025");

  const jaar = periodeUit({ q: "all", year: "2030" }, now); // jaar wordt begrensd
  assert.equal(jaar.year, 2026);
  assert.equal(jaar.label, "2026");
  assert.equal(deltaPct(150, 100), 50);
  assert.equal(deltaPct(5, 0), null);
});
