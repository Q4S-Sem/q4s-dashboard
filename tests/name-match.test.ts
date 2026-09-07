import assert from "node:assert/strict";
import test from "node:test";
import { nameMatches, matchByName, normalizeName } from "../src/lib/name-match";

// ---------------------------------------------------------------------------
// De naam-match die AI-uitlezingen (urenstaat én ZZP-factuur) aan een medewerker
// koppelt. Bewust STRENG: élk deel van de voor- én achternaam moet als heel woord
// in de uitgelezen naam voorkomen. Bij twijfel liever geen match — een mens
// bevestigt toch, maar een FOUTE match kost geld op de verkeerde persoon.
// ---------------------------------------------------------------------------

const son = { firstName: "Rob", lastName: "van Son" };
const berg = { firstName: "Johanna", lastName: "van den Berg" };

test("normalizeName maakt kleine letters, haalt diakrieten en leestekens weg", () => {
  assert.equal(normalizeName("José  Núñez-Pérez"), "jose nunez perez");
  assert.equal(normalizeName("  R.  van  Son  "), "r van son");
  assert.equal(normalizeName(""), "");
});

test("de volledige naam matcht, ongeacht hoofdletters of diakrieten", () => {
  assert.equal(nameMatches(son, "Rob van Son"), true);
  assert.equal(nameMatches(son, "ROB VAN SON"), true);
  assert.equal(nameMatches({ firstName: "José", lastName: "Núñez" }, "jose nunez"), true);
});

test("extra woorden eromheen (bedrijfsnaam, functie) mogen erbij staan", () => {
  assert.equal(nameMatches(son, "Van Son Lasinspectie — Rob van Son, ZZP"), true);
});

test("een losse initiaal of half woord is niet genoeg", () => {
  assert.equal(nameMatches(son, "R. van Son"), false);
  // "An Berg" mag nooit doorgaan voor "Johanna van den Berg".
  assert.equal(nameMatches(berg, "An Berg"), false);
});

test("een lege of ontbrekende naam matcht nooit", () => {
  assert.equal(nameMatches(son, ""), false);
  assert.equal(nameMatches(son, "   "), false);
  assert.equal(nameMatches(son, "123 !!"), false);
});

test("matchByName geeft alleen bij één treffer een match, plus altijd de kandidaten", () => {
  const people = [
    { id: "c1", ...son },
    { id: "c2", ...berg },
  ];
  const hit = matchByName(people, "Factuur van Rob van Son");
  assert.equal(hit.match?.id, "c1");
  assert.deepEqual(
    hit.candidates.map((c) => c.id),
    ["c1"],
  );

  const none = matchByName(people, "Pietje Puk");
  assert.equal(none.match, null);
  assert.deepEqual(none.candidates, []);
});

test("bij twee naamgenoten blijft de match leeg — de mens kiest", () => {
  const people = [
    { id: "c1", firstName: "Rob", lastName: "van Son" },
    { id: "c2", firstName: "Rob", lastName: "van Son" },
  ];
  const res = matchByName(people, "Rob van Son");
  assert.equal(res.match, null);
  assert.deepEqual(
    res.candidates.map((c) => c.id),
    ["c1", "c2"],
  );
});

test("zonder uitgelezen naam wordt er niet eens gezocht", () => {
  const people = [{ id: "c1", ...son }];
  assert.deepEqual(matchByName(people, null), { match: null, candidates: [] });
  assert.deepEqual(matchByName(people, "  "), { match: null, candidates: [] });
});
