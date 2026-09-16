import { test } from "node:test";
import assert from "node:assert/strict";
import { marktconformTarief, withMarktconformFallback } from "../src/lib/markttarief";

test("marktconformTarief gives a per-discipline hourly range with the marktconform label", () => {
  const t = marktconformTarief("LASSEN");
  assert.ok(t !== null);
  assert.match(t!, /€ \d+-\d+ p\/u/);
  assert.match(t!, /marktconform/);
});

test("marktconformTarief differs between disciplines", () => {
  assert.notEqual(marktconformTarief("LASSEN"), marktconformTarief("PROJECTMANAGEMENT"));
});

test("marktconformTarief falls back to a general range for unknown/missing discipline", () => {
  assert.ok(marktconformTarief(null)!.includes("marktconform"));
  assert.ok(marktconformTarief("BESTAAT_NIET")!.includes("marktconform"));
});

test("withMarktconformFallback keeps a user-entered rate untouched", () => {
  assert.equal(withMarktconformFallback("3500 / 4500", "LASSEN"), "3500 / 4500");
  assert.equal(withMarktconformFallback("€ 65 p/u", null), "€ 65 p/u");
});

test("withMarktconformFallback fills the market rate when the rate is empty", () => {
  const filled = withMarktconformFallback("", "QA_QC");
  assert.match(filled!, /marktconform/);
  assert.equal(withMarktconformFallback("   ", "QA_QC"), filled);
  assert.equal(withMarktconformFallback(null, "QA_QC"), filled);
});
