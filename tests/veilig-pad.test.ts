import assert from "node:assert/strict";
import test from "node:test";
import { veiligPad } from "../src/lib/onedrive";

test("veiligPad: nooit buiten de drive, geen rare tekens", () => {
  assert.equal(veiligPad("Contracten Q4S/2026"), "Contracten Q4S/2026");
  assert.equal(veiligPad("../../etc"), "etc");
  assert.equal(veiligPad("/a//b/./c/"), "a/b/c");
  assert.equal(veiligPad('CV\'s/<x>|"y'), "CV's/xy");
  assert.equal(veiligPad(null), "");
});
