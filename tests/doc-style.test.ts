import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_ACCENT, documentAccent } from "../src/lib/doc-style";

test("de oude Q4S-oranje instelling wordt automatisch als zwart behandeld", () => {
  assert.equal(documentAccent({ cvAccent: "#e8430a" }), DEFAULT_ACCENT);
  assert.equal(documentAccent({ cvAccent: "#E8430A" }), DEFAULT_ACCENT);
});

test("een bewust ingestelde andere geldige accentkleur blijft behouden", () => {
  assert.equal(documentAccent({ cvAccent: "#123456" }), "#123456");
});

test("een lege of ongeldige accentkleur valt terug op Q4S-zwart", () => {
  assert.equal(documentAccent({ cvAccent: null }), DEFAULT_ACCENT);
  assert.equal(documentAccent({ cvAccent: "oranje" }), DEFAULT_ACCENT);
});
