import { test } from "node:test";
import assert from "node:assert/strict";
import { schoneDuur } from "../src/lib/linkedin-card";

test("LinkedIn Duration: alleen projectduur, nooit de vergoeding", () => {
  assert.equal(schoneDuur("6 maanden + optie"), "6 maanden + optie");
  assert.equal(schoneDuur("12+ months"), "12+ months");
  assert.equal(schoneDuur("Marktconform"), "");
  assert.equal(schoneDuur("Market-rate"), "");
  assert.equal(schoneDuur("€ 75 p/u"), "");
  assert.equal(schoneDuur("Competitive hourly rate"), "");
  assert.equal(schoneDuur(null), "");
});
