import { test } from "node:test";
import assert from "node:assert/strict";
import { arbeidsWaarschuwingen, duurInMaanden } from "../src/lib/arbeidsovereenkomst";

test("arbeidsovereenkomst: wettelijke grenzen", () => {
  assert.equal(duurInMaanden("12 maanden"), 12);
  assert.equal(duurInMaanden("1 jaar"), 12);
  // 12 maanden bepaalde tijd met 2 maanden proef (zoals het oude contract) = fout
  assert.match(arbeidsWaarschuwingen({ soort: "bepaalde tijd", duur: "12 maanden", proeftijd: "2 maanden" })[0], /maximaal 1 maand/);
  assert.match(arbeidsWaarschuwingen({ soort: "bepaalde tijd", duur: "6 maanden", proeftijd: "1 maand" })[0], /geen proeftijd/);
  assert.deepEqual(arbeidsWaarschuwingen({ soort: "bepaalde tijd", duur: "12 maanden", proeftijd: "1 maand" }), []);
  assert.deepEqual(arbeidsWaarschuwingen({ soort: "onbepaalde tijd", proeftijd: "2 maanden" }), []);
  assert.equal(arbeidsWaarschuwingen({ soort: "onbepaalde tijd", urenPerWeek: "40", vakantiedagen: "15" }).length, 1);
  assert.equal(arbeidsWaarschuwingen({ soort: "bepaalde tijd", duur: "1 jaar", concurrentiebeding: "n.v.t." }).length, 0);
});
