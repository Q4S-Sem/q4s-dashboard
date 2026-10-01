import assert from "node:assert/strict";
import test from "node:test";
import { matchZzpFactuur } from "../src/lib/name-match";

const mensen = [
  { id: "a", firstName: "Piotr", lastName: "Kowalski", companyName: "Kowalski Welding Sp. z o.o.", kvkNumber: null, vatNumber: "PL1234567890", iban: "PL61 1090 1014 0000 0712 1981 2874" },
  { id: "b", firstName: "Jan", lastName: "Jansen", companyName: "Jansen Lassen B.V.", kvkNumber: "12345678", vatNumber: null, iban: null },
  { id: "c", firstName: "Kees", lastName: "Jansen", companyName: null, kvkNumber: null, vatNumber: null, iban: null },
];

test("bedrijfsnaam op de factuur koppelt aan de ZZP'er (rechtsvorm telt niet mee)", () => {
  const r = matchZzpFactuur(mensen, { name: "KOWALSKI WELDING" });
  assert.equal(r.match?.id, "a");
  assert.equal(r.via, "bedrijf");
  assert.equal(matchZzpFactuur(mensen, { name: "Jansen Lassen" }).match?.id, "b");
});

test("KvK / btw / IBAN winnen van een onduidelijke naam", () => {
  assert.equal(matchZzpFactuur(mensen, { name: "J. Lasbedrijf", kvkNumber: "1234 5678" }).match?.id, "b");
  assert.equal(matchZzpFactuur(mensen, { name: "", vatId: "pl 1234567890" }).via, "btw");
  assert.equal(matchZzpFactuur(mensen, { iban: "PL61109010140000071219812874" }).match?.id, "a");
});

test("persoonsnaam blijft de terugval; naamgenoten geven geen match", () => {
  assert.equal(matchZzpFactuur(mensen, { name: "Kees Jansen" }).match?.id, "c");
  const r = matchZzpFactuur(mensen, { name: "Jansen" });
  assert.equal(r.match, null);
});
