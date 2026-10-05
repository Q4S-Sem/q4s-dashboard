import { test } from "node:test";
import assert from "node:assert/strict";
import { encryptSecret, decryptSecret } from "../src/lib/vault";

test("vault: roundtrip, random IV, wrong key fails", () => {
  const a = encryptSecret("Geheim€123!", "s1");
  assert.notEqual(a, encryptSecret("Geheim€123!", "s1"));
  assert.ok(!a.includes("Geheim"));
  assert.equal(decryptSecret(a, "s1"), "Geheim€123!");
  assert.throws(() => decryptSecret(a, "s2"));
  assert.equal(encryptSecret("", "s1"), "");
  assert.equal(decryptSecret("", "s1"), "");
});
