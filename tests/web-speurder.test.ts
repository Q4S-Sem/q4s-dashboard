import { test } from "node:test";
import assert from "node:assert/strict";
import { webFieldsFor } from "../src/lib/sync";

test("Web-speurder roteert per dag en heeft de hele niche binnen een paar dagen rond", () => {
  const velden = ["a", "b", "c", "d", "e", "f", "g"];
  assert.deepEqual(webFieldsFor(0, velden), ["a", "b", "c"]);
  assert.deepEqual(webFieldsFor(1, velden), ["d", "e", "f"]);
  assert.deepEqual(webFieldsFor(2, velden), ["g", "a", "b"]);
  const gezien = new Set([0, 1, 2].flatMap((d) => webFieldsFor(d, velden)));
  assert.equal(gezien.size, velden.length);
});
