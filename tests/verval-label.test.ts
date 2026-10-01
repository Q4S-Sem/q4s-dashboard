import { test } from "node:test";
import assert from "node:assert/strict";
import { inkoopVervaldatum, vervalLabel } from "../src/lib/facturatie-lijsten";

const NU = new Date(2026, 9, 8, 15, 30); // do 8 okt 2026, middag

test("vervalLabel telt in kalenderdagen, los van het tijdstip", () => {
  assert.deepEqual(vervalLabel(new Date(2026, 9, 8, 0, 0), false, NU), { tekst: "vandaag", toon: "oranje" });
  assert.deepEqual(vervalLabel(new Date(2026, 9, 9), false, NU), { tekst: "morgen", toon: "oranje" });
  assert.deepEqual(vervalLabel(new Date(2026, 9, 11), false, NU), { tekst: "over 3 dagen", toon: "oranje" });
  assert.deepEqual(vervalLabel(new Date(2026, 9, 13), false, NU), { tekst: "over 5 dagen", toon: "grijs" });
  assert.deepEqual(vervalLabel(new Date(2026, 9, 7), false, NU), { tekst: "1 dag te laat", toon: "rood" });
  assert.deepEqual(vervalLabel(new Date(2026, 8, 28), false, NU), { tekst: "10 dagen te laat", toon: "rood" });
});

test("betaald wint altijd, ook als de datum voorbij is", () => {
  assert.equal(vervalLabel(new Date(2026, 8, 1), true, NU).tekst, "betaald");
});

test("inkoopvervaldatum = factuurdatum + termijn", () => {
  const d = inkoopVervaldatum(new Date(2026, 9, 1), 30)!;
  assert.equal(d.getDate(), 31);
  assert.equal(inkoopVervaldatum(null, 30), null);
});
