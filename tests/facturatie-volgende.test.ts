import { test } from "node:test";
import assert from "node:assert/strict";
import { volgendePersoon, voortgang } from "../src/lib/facturatie-volgende";
import { herinneringMail } from "../src/lib/timesheet-herinnering";

const rij = (key: string, extra: Partial<{ href: string | null; gefactureerd: boolean; vastgelegd: boolean; wachtkamerSinds: Date | null }> = {}) => ({
  key,
  naam: key,
  href: `/facturatie/${key}/2026-W41`,
  gefactureerd: false,
  vastgelegd: false,
  wachtkamerSinds: null,
  ...extra,
});

test("volgende persoon: slaat klaar/wachtkamer/zonder dossier over en loopt rond", () => {
  const rows = [
    rij("a"),
    rij("b", { gefactureerd: true }),
    rij("c", { href: null }),
    rij("d", { wachtkamerSinds: new Date() }),
    rij("e"),
  ];
  assert.equal(volgendePersoon(rows)?.key, "a");
  assert.equal(volgendePersoon(rows, "a")?.key, "e");
  assert.equal(volgendePersoon(rows, "e")?.key, "a"); // rond naar het begin
  assert.equal(volgendePersoon([rij("a")], "a"), null); // alleen jezelf = klaar
  assert.deepEqual(voortgang(rows), { klaar: 1, totaal: 4 });
});

test("herinnering-mail: ZZP vraagt timesheet + factuur, in dienst alleen timesheet", () => {
  const s = { companyName: "Q4S", email: "admin@q4s.nl", phone: "", website: "" };
  const zzp = herinneringMail({ voornaam: "Jordy", isoWeek: 41, bereik: "5 okt – 11 okt", isZZP: true }, s);
  assert.match(zzp.subject, /timesheet en factuur week 41/);
  assert.equal(zzp.content.greeting, "Hoi Jordy,");
  const vast = herinneringMail({ voornaam: "", isoWeek: 41, bereik: "x", isZZP: false }, s);
  assert.doesNotMatch(vast.content.paragraphs[0], /factuur/);
});
