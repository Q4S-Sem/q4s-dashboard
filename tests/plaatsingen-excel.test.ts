import { test } from "node:test";
import assert from "node:assert/strict";
import { plaatsingenCellen } from "../src/lib/plaatsingen-excel";

test("plaatsingenCellen: juiste kolommen, marge-formule (K) ongemoeid", () => {
  const c = plaatsingenCellen([
    { naam: "Jordy Balder", status: "Actief", klant: "HSM", functie: "QA/QC", locatie: null, start: new Date(2026, 7, 3), einde: null,
      per: "uur", inkoop: 77, verkoop: 87, allIn: true, kmIn: 0.45, kmUit: 0.45, bedrijf: "BQS", kvk: "825", btw: "NL0",
      iban: "NL77", email: "a@b.nl", telefoon: "06", adres: "Weg 1", postcode: "1234", plaats: "Dordrecht", po: null },
  ]);
  assert.equal(c.A6, "Jordy Balder");
  assert.equal(c.I6, 77);
  assert.equal(c.J6, 87);
  assert.ok(!("K6" in c));
  assert.equal(c.L6, "Ja");
  assert.equal(c.P6, "825");
  assert.equal(c.S6, "a@b.nl");
  assert.equal(c.W6, "Dordrecht");
});
