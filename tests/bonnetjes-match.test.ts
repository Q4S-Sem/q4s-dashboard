import assert from "node:assert/strict";
import test from "node:test";
import { matchPersoon } from "../src/lib/expense-extract";

const personen = [
  { id: "rob", firstName: "Rob", lastName: "Van Son", email: "rob@vanson.nl" },
  { id: "jordy", firstName: "Jordy", lastName: "Balder", email: "Jordy@Balder.nl" },
  { id: "rene", firstName: "René", lastName: "Hartman", email: null },
];

test("afzender = e-mailadres van de persoon (hoofdletters maken niet uit)", () => {
  assert.equal(matchPersoon({ afzender: "jordy@balder.nl" }, personen), "jordy");
});

test("anders de volledige naam in onderwerp/bestandsnaam (ook zonder accenten)", () => {
  assert.equal(matchPersoon({ afzender: "x@gmail.com", tekst: "Bonnetjes rene hartman week 39" }, personen), "rene");
  assert.equal(matchPersoon({ tekst: "bon_Rob-van-Son_tanken.jpg" }, personen), "rob");
});

test("geen of dubbele treffer → niet toegewezen", () => {
  assert.equal(matchPersoon({ afzender: "onbekend@x.nl", tekst: "bonnetjes" }, personen), null);
  assert.equal(matchPersoon({ tekst: "Rob van Son en Jordy Balder" }, personen), null);
  assert.equal(matchPersoon({ tekst: "Robert van Sonnema" }, personen), null);
});
