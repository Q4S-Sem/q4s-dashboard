import { test } from "node:test";
import assert from "node:assert/strict";
import { hashMspSleutel, nieuweMspSleutel } from "../src/lib/msp-sleutel";

test("MSP-sleutel: uniek, hash klopt en de sleutel zelf wordt niet bewaard", () => {
  const a = nieuweMspSleutel();
  const b = nieuweMspSleutel();
  assert.match(a.sleutel, /^q4s_msp_[\w-]{32}$/);
  assert.notEqual(a.sleutel, b.sleutel);
  assert.equal(hashMspSleutel(a.sleutel), a.hash);
  assert.equal(hashMspSleutel(` ${a.sleutel}\n`), a.hash);
  assert.ok(!a.hash.includes(a.sleutel));
});
