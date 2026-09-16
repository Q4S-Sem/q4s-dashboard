import { test } from "node:test";
import assert from "node:assert/strict";
import { marktconformTarief, withMarktconformFallback } from "../src/lib/markttarief";

test("marktconformTarief is always the plain label, never an invented price", () => {
  assert.equal(marktconformTarief("LASSEN"), "Marktconform");
  assert.equal(marktconformTarief("PROJECTMANAGEMENT"), "Marktconform");
  assert.equal(marktconformTarief(null), "Marktconform");
  assert.equal(marktconformTarief(undefined), "Marktconform");
  // Geen euro's of cijfers in de fallback.
  assert.doesNotMatch(marktconformTarief("QA_QC"), /[€\d]/);
});

test("withMarktconformFallback keeps a user-entered rate untouched", () => {
  assert.equal(withMarktconformFallback("3500 / 4500", "LASSEN"), "3500 / 4500");
  assert.equal(withMarktconformFallback("€ 65 p/u", null), "€ 65 p/u");
});

test("withMarktconformFallback fills 'Marktconform' when the rate is empty", () => {
  assert.equal(withMarktconformFallback("", "QA_QC"), "Marktconform");
  assert.equal(withMarktconformFallback("   ", "QA_QC"), "Marktconform");
  assert.equal(withMarktconformFallback(null, null), "Marktconform");
  assert.equal(withMarktconformFallback(undefined, undefined), "Marktconform");
});
