import assert from "node:assert/strict";
import test from "node:test";
import { fotoZoekvraag } from "../src/lib/linkedin-og";

test("foto-zoekvraag = titel + industriële context van het vak", () => {
  assert.equal(fotoZoekvraag("Engineering", "Transport Engineer"), "Transport Engineer engineer industrial shipyard");
  assert.equal(fotoZoekvraag("Overig", "TIG-lasser (RVS)"), "TIG lasser  RVS welding steel");
});
