import { test } from "node:test";
import assert from "node:assert/strict";
import { magVersturen } from "../src/lib/email";

test("magVersturen: extern alleen handmatig, intern altijd", () => {
  assert.equal(magVersturen({ to: "klant@bedrijf.nl" }), false);
  assert.equal(magVersturen({ to: "zzp@gmail.com" }), false);
  assert.equal(magVersturen({ to: "klant@bedrijf.nl", handmatig: true }), true);
  assert.equal(magVersturen({ to: "semdesnoo@q4s.nl" }), true);
  assert.equal(magVersturen({ to: "x@q4s.nl.evil.com" }), false);
});
