import { test } from "node:test";
import assert from "node:assert/strict";
import { zonderKlantnaam } from "../src/lib/klantnaam-publiek";

test("klantnaam verdwijnt uit publieke tekst (ook zonder rechtsvorm, hoofdletterongevoelig)", () => {
  const namen = ["ArcelorMittal Gent B.V.", "Arcelormittal"];
  assert.equal(
    zonderKlantnaam("Voor ArcelorMittal Gent B.V. zoeken wij een voorman. ARCELORMITTAL is groot.", namen),
    "Voor onze opdrachtgever zoeken wij een voorman. onze opdrachtgever is groot.",
  );
  // Geen halve woorden vervangen.
  assert.equal(zonderKlantnaam("HSMX blijft staan", ["HSM"]), "HSMX blijft staan");
  assert.equal(zonderKlantnaam(null, namen), null);
  assert.equal(zonderKlantnaam("geen klant", [null, ""]), "geen klant");
});
