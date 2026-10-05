import { test } from "node:test";
import assert from "node:assert/strict";
import { fromRateText, toRateText } from "../src/lib/contract-tarief";

test("contract-tarief: € en % heen en terug", () => {
  assert.equal(toRateText("78", "€"), "€ 78,-");
  assert.equal(toRateText("78,50", "€"), "€ 78,50");
  assert.equal(toRateText("10", "%"), "10 %");
  assert.equal(toRateText("+ 25", "%"), "+ 25 %");
  assert.equal(toRateText("  ", "€"), "");
  assert.deepEqual(fromRateText("€ 78,-"), { unit: "€", value: "78" });
  assert.deepEqual(fromRateText("+ 0 %"), { unit: "%", value: "+ 0" });
  assert.deepEqual(fromRateText(""), { unit: "€", value: "" });
  for (const [v, u] of [["78", "€"], ["12,5", "%"], ["80,25", "€"]] as const) {
    assert.deepEqual(fromRateText(toRateText(v, u)), { unit: u, value: v });
  }
});
