import assert from "node:assert/strict";
import test from "node:test";
import { autoUitleesSleutel } from "../src/lib/auto-uitlezen";

const factuur = {
  name: "Factuur 26.2026 week 35.pdf",
  size: 123_456,
  lastModified: 1_788_000_000_000,
};

test("één gekozen bestand start automatisch met uitlezen", () => {
  assert.equal(
    autoUitleesSleutel([factuur], { bezig: false, laatstGestart: null }),
    "Factuur 26.2026 week 35.pdf:123456:1788000000000",
  );
});

test("leegmaken of meerdere bestanden start de wizard-uitlezing niet", () => {
  assert.equal(autoUitleesSleutel([], { bezig: false, laatstGestart: null }), null);
  assert.equal(
    autoUitleesSleutel([factuur, { ...factuur, name: "tweede.pdf" }], {
      bezig: false,
      laatstGestart: null,
    }),
    null,
  );
});

test("dezelfde bestandsevent wordt niet dubbel gestart", () => {
  const sleutel = "Factuur 26.2026 week 35.pdf:123456:1788000000000";
  assert.equal(autoUitleesSleutel([factuur], { bezig: false, laatstGestart: sleutel }), null);
});

test("tijdens een lopende AI-run start geen tweede bestand", () => {
  assert.equal(autoUitleesSleutel([factuur], { bezig: true, laatstGestart: null }), null);
});
