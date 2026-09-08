import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ontleedWeekKey,
  mondayVanIsoWeek,
  weekSlotVanKey,
  vorigeWeek,
  volgendeWeek,
  weekKeyVanDatum,
  weekBereikLabel,
  weekVanLabel,
} from "../src/lib/wizard-weeknav";

test("ontleedWeekKey leest jaar en weeknummer", () => {
  assert.deepEqual(ontleedWeekKey("2026-W37"), { year: 2026, isoWeek: 37 });
  assert.equal(ontleedWeekKey("rommel"), null);
  assert.equal(ontleedWeekKey(""), null);
  assert.equal(ontleedWeekKey("2026-W99"), null);
});

test("mondayVanIsoWeek geeft de juiste maandag (week 37 van 2026 = 7 sep)", () => {
  const d = mondayVanIsoWeek(2026, 37);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 8); // september (0-based)
  assert.equal(d.getDate(), 7);
  assert.equal(d.getDay(), 1); // maandag
});

test("weekSlotVanKey rondtript met de sleutel", () => {
  const slot = weekSlotVanKey("2026-W37");
  assert.ok(slot);
  assert.equal(slot!.key, "2026-W37");
  assert.equal(slot!.isoWeek, 37);
  assert.equal(slot!.year, 2026);
  assert.equal(slot!.monday, "2026-09-07");
});

test("vorige/volgende week stappen precies één week", () => {
  const slot = weekSlotVanKey("2026-W37")!;
  assert.equal(vorigeWeek(slot)!.key, "2026-W36");
  assert.equal(volgendeWeek(slot)!.key, "2026-W38");
  assert.equal(vorigeWeek(slot)!.monday, "2026-08-31");
  assert.equal(volgendeWeek(slot)!.monday, "2026-09-14");
});

test("week-navigatie loopt correct over de jaargrens", () => {
  // Week 1 van 2026 begint op maandag 29-12-2025.
  const w1 = weekSlotVanKey("2026-W01")!;
  assert.equal(w1.monday, "2025-12-29");
  const vorig = vorigeWeek(w1)!;
  assert.equal(vorig.year, 2025);
  // 2025 heeft ISO-week 52 als laatste.
  assert.equal(vorig.isoWeek, 52);
});

test("weekKeyVanDatum trekt een losse dag naar zijn ISO-week", () => {
  // Woensdag 9 sep 2026 valt in week 37.
  assert.equal(weekKeyVanDatum("2026-09-09"), "2026-W37");
  // Zondag 13 sep 2026 hoort óók nog bij week 37.
  assert.equal(weekKeyVanDatum("2026-09-13"), "2026-W37");
  // Maandag 14 sep is week 38.
  assert.equal(weekKeyVanDatum("2026-09-14"), "2026-W38");
  assert.equal(weekKeyVanDatum(""), null);
});

test("weekBereikLabel toont maandag t/m zondag met het jaar achteraan", () => {
  const slot = weekSlotVanKey("2026-W37")!;
  assert.equal(weekBereikLabel(slot), "7 sep – 13 sep 2026");
});

test("weekVanLabel toont de maandag als dd-mm-jjjj", () => {
  const slot = weekSlotVanKey("2026-W37")!;
  assert.equal(weekVanLabel(slot), "week van 07-09-2026");
});
