import assert from "node:assert/strict";
import test from "node:test";
import { periodeStand, periodeVan } from "../src/lib/factuur-periode";

const d = (s: string) => new Date(`${s}T00:00:00Z`);
const ma = (p: { weken: Date[] }) => p.weken.map((w) => w.toISOString().slice(0, 10));

test("maand = weken waarvan de donderdag in die maand valt", () => {
  // Week van ma 29-09-2026: donderdag 1 okt → oktober.
  const okt = periodeVan(d("2026-09-30"), "MONTH");
  assert.equal(okt.key, "2026-M10");
  assert.equal(okt.label, "oktober 2026");
  assert.deepEqual(ma(okt), ["2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26"]);
  assert.equal(periodeVan(d("2026-10-29"), "MONTH").key, "2026-M10");
});

test("4 weken = ISO-weken 1–4, 5–8, …", () => {
  const p = periodeVan(d("2026-10-07"), "FOUR_WEEKS"); // week 41
  assert.equal(p.key, "2026-P11");
  assert.equal(p.weken.length, 4);
  assert.equal(ma(p)[0], "2026-10-05"); // week 41 = eerste van blok 41–44
  assert.equal(periodeVan(d("2026-10-26"), "FOUR_WEEKS").key, "2026-P11"); // week 44
  assert.equal(periodeVan(d("2026-11-02"), "FOUR_WEEKS").key, "2026-P12"); // week 45
  // 2026 heeft 53 weken: week 53 hoort bij het laatste blok (49–53).
  const laatst = periodeVan(d("2026-12-30"), "FOUR_WEEKS");
  assert.equal(laatst.key, "2026-P13");
  assert.equal(laatst.weken.length, 5);
});

test("compleet pas als elke gelopen week goedgekeurd is", () => {
  const p = periodeVan(d("2026-10-07"), "FOUR_WEEKS"); // 5, 12, 19, 26 okt
  const pl = { startDate: d("2026-10-14"), endDate: null, goedgekeurd: new Set(["2026-10-12", "2026-10-19"]) };
  assert.deepEqual(periodeStand(p, [pl]), { binnen: 2, nodig: 3, compleet: false });
  pl.goedgekeurd.add("2026-10-26");
  assert.deepEqual(periodeStand(p, [pl]), { binnen: 3, nodig: 3, compleet: true });
  // Tweede plaatsing bij dezelfde klant die eerder stopte: alleen zijn weken tellen.
  const gestopt = { startDate: d("2026-01-01"), endDate: d("2026-10-11"), goedgekeurd: new Set(["2026-10-05"]) };
  assert.equal(periodeStand(p, [pl, gestopt]).compleet, true);
});
