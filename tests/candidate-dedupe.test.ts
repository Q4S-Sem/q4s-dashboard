import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReapplicationNote,
  candidateDedupeKeys,
  hasDedupeKey,
  normalizeCandidateEmail,
  normalizeCandidatePhone,
  pickDuplicateCandidate,
} from "../src/lib/candidate-dedupe";

test("e-mail normaliseert naar trim + kleine letters", () => {
  assert.equal(normalizeCandidateEmail("  Jan.De.Vries@Example.NL "), "jan.de.vries@example.nl");
  assert.equal(normalizeCandidateEmail("jan@example.nl"), "jan@example.nl");
});

test("onbruikbare e-mailwaarden leveren geen dedupe-sleutel op", () => {
  assert.equal(normalizeCandidateEmail(null), null);
  assert.equal(normalizeCandidateEmail(undefined), null);
  assert.equal(normalizeCandidateEmail("   "), null);
  assert.equal(normalizeCandidateEmail("-"), null);
  assert.equal(normalizeCandidateEmail("geen-apenstaartje.nl"), null);
  assert.equal(normalizeCandidateEmail("twee@apen@staartjes.nl"), null);
  assert.equal(normalizeCandidateEmail("met spatie@example.nl"), null);
  assert.equal(normalizeCandidateEmail("@example.nl"), null);
  assert.equal(normalizeCandidateEmail("jan@example"), null);
});

test("alle NL-notaties van hetzelfde mobiele nummer normaliseren gelijk", () => {
  const expected = "0612345678";
  for (const raw of [
    "0612345678",
    "06-12345678",
    "06 12 34 56 78",
    "(06) 1234 5678",
    "+31612345678",
    "+31 6 12345678",
    "0031612345678",
    "00 31 6 12345678",
    "31612345678",
  ]) {
    assert.equal(normalizeCandidatePhone(raw), expected, `notatie ${raw}`);
  }
});

test("buitenlandse en vaste nummers blijven ongemoeid", () => {
  // Alleen de NL-landcode wordt tot de nationale notatie teruggebracht.
  assert.equal(normalizeCandidatePhone("+49 30 1234567"), "49301234567");
  assert.equal(normalizeCandidatePhone("0031 10 1234567"), "0101234567");
  assert.equal(normalizeCandidatePhone("010-1234567"), "0101234567");
});

test("onbruikbare telefoonwaarden leveren geen dedupe-sleutel op", () => {
  assert.equal(normalizeCandidatePhone(null), null);
  assert.equal(normalizeCandidatePhone("   "), null);
  assert.equal(normalizeCandidatePhone("geen nummer"), null);
  // Te kort om een persoon mee te kunnen herkennen.
  assert.equal(normalizeCandidatePhone("12345"), null);
  assert.equal(normalizeCandidatePhone("+31"), null);
});

test("candidateDedupeKeys en hasDedupeKey beschrijven wat er te vergelijken valt", () => {
  assert.deepEqual(candidateDedupeKeys({ email: " JAN@example.nl ", phone: "06-1234 5678" }), {
    email: "jan@example.nl",
    phone: "0612345678",
  });
  assert.deepEqual(candidateDedupeKeys({ email: "rommel", phone: "12" }), { email: null, phone: null });
  assert.equal(hasDedupeKey({ email: null, phone: null }), false);
  assert.equal(hasDedupeKey({ email: null, phone: "0612345678" }), true);
  assert.equal(hasDedupeKey({ email: "jan@example.nl", phone: null }), true);
});

test("een bestaande kandidaat wordt op e-mail OF op telefoonnummer gevonden", () => {
  const rows = [
    { id: "a", email: "Jan@Example.NL", phone: null },
    { id: "b", email: null, phone: "+31 6 1234 5678" },
  ];

  assert.deepEqual(pickDuplicateCandidate(rows, { email: "jan@example.nl", phone: null }), {
    candidate: rows[0],
    matchedOn: "email",
  });
  assert.deepEqual(pickDuplicateCandidate(rows, { email: null, phone: "0612345678" }), {
    candidate: rows[1],
    matchedOn: "phone",
  });
});

test("e-mail weegt zwaarder dan telefoon en de eerst aangeboden rij wint", () => {
  const rows = [
    { id: "oud-telefoon", email: null, phone: "0612345678" },
    { id: "oud-email", email: "jan@example.nl", phone: null },
    { id: "nieuw-email", email: "jan@example.nl", phone: null },
  ];

  assert.deepEqual(pickDuplicateCandidate(rows, { email: "jan@example.nl", phone: "0612345678" }), {
    candidate: rows[1],
    matchedOn: "email",
  });
});

test("zonder sleutel of zonder treffer is er geen dubbele kandidaat", () => {
  const rows = [{ id: "a", email: "iemand@example.nl", phone: "0612345678" }];
  assert.equal(pickDuplicateCandidate(rows, { email: null, phone: null }), null);
  assert.equal(pickDuplicateCandidate(rows, { email: "ander@example.nl", phone: "0698765432" }), null);
  assert.equal(pickDuplicateCandidate([], { email: "iemand@example.nl", phone: null }), null);
});

test("de recruiter-melding zegt letterlijk dat een bestaande kandidaat opnieuw gesolliciteerd heeft", () => {
  const note = buildReapplicationNote({
    candidateName: "Jan de Vries",
    matchedOn: "email",
    origin: "de vacature QC Inspector",
    unattachedCvName: null,
  });

  assert.equal(note.title, "Bestaande kandidaat opnieuw gesolliciteerd: Jan de Vries");
  assert.match(note.body, /gevonden op e-mailadres/);
  assert.match(note.body, /de vacature QC Inspector/);
  assert.match(note.body, /NIET overschreven/);
  assert.doesNotMatch(note.body, /nieuwe bestand/);
});

test("een niet-gekoppeld CV wordt in de melding benoemd zodat een mens kan beslissen", () => {
  const note = buildReapplicationNote({
    candidateName: "Piet Jansen",
    matchedOn: "phone",
    origin: "de talentpool",
    unattachedCvName: "piet-cv.pdf",
  });

  assert.match(note.body, /gevonden op telefoonnummer/);
  assert.match(note.body, /piet-cv\.pdf/);
  assert.match(note.body, /niet aan het dossier gehangen/);
});

test("de melding is review-only: geen status, bericht of samenvoeging", () => {
  const note = buildReapplicationNote({
    candidateName: "Jan de Vries",
    matchedOn: "email",
    origin: "de talentpool",
    unattachedCvName: null,
  });

  assert.deepEqual(Object.keys(note).sort(), ["body", "title"]);
  assert.ok(note.title.length <= 300);
  assert.ok(note.body.length <= 1000);
});
