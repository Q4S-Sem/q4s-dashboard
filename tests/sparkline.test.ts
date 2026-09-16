import { test } from "node:test";
import assert from "node:assert/strict";
import { sparklinePath, sparklineAreaPath } from "../src/lib/sparkline";

test("sparklinePath maps values to an SVG polyline path within the viewbox", () => {
  const p = sparklinePath([0, 10], 100, 30);
  // Two points: starts at left-bottom (M0,30), ends at right-top (L100,0)
  assert.equal(p, "M0,30 L100,0");
});

test("sparklinePath spreads intermediate points evenly on the x-axis", () => {
  const p = sparklinePath([0, 5, 10], 100, 30);
  assert.equal(p, "M0,30 L50,15 L100,0");
});

test("sparklinePath renders a flat midline when all values are equal", () => {
  const p = sparklinePath([7, 7, 7], 100, 30);
  assert.equal(p, "M0,15 L50,15 L100,15");
});

test("sparklinePath returns empty string for fewer than 2 points", () => {
  assert.equal(sparklinePath([], 100, 30), "");
  assert.equal(sparklinePath([5], 100, 30), "");
});

test("sparklinePath rounds coordinates to 1 decimal", () => {
  const p = sparklinePath([0, 1, 3], 100, 30);
  // max=3 -> y for 1 = 30 - (1/3)*30 = 20 ; x mid = 50
  assert.equal(p, "M0,30 L50,20 L100,0");
});

test("sparklineAreaPath closes the shape along the bottom", () => {
  const area = sparklineAreaPath([0, 10], 100, 30);
  assert.equal(area, "M0,30 L100,0 L100,30 L0,30 Z");
});

test("sparklineAreaPath is empty when the line is empty", () => {
  assert.equal(sparklineAreaPath([5], 100, 30), "");
});
