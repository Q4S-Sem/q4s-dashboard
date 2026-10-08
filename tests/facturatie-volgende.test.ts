import { test } from "node:test";
import assert from "node:assert/strict";
import { volgendePersoon, voortgang, weekBeslissing, dubbelBesluit, wekenInPeriode, watMist } from "../src/lib/facturatie-volgende";
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

test("weekBeslissing: andere week open → verder, al verwerkt → verkeerd", () => {
  assert.equal(weekBeslissing("2026-W41", "2026-W41", true), "zelfde");
  assert.equal(weekBeslissing("2026-W41", null, false), "zelfde");
  assert.equal(weekBeslissing("2026-W41", "2026-W39", false), "verder");
  assert.equal(weekBeslissing("2026-W41", "2026-W39", true), "verkeerd");
});

test("dubbelBesluit: open versie wordt vervangen, goedgekeurde blokkeert", () => {
  for (const st of ["NEW", "EXTRACTED", "DISPUTED"]) assert.equal(dubbelBesluit(st), "vervang");
  for (const st of ["APPROVED", "PAID", "INVOICED", "CONFIRMED"]) assert.equal(dubbelBesluit(st), "blokkeer");
});

test("wekenInPeriode: verzamelfactuur over 3 weken → 3 weeksleutels", () => {
  assert.deepEqual(wekenInPeriode("2026-09-14", "2026-10-04"), ["2026-W38", "2026-W39", "2026-W40"]);
  assert.deepEqual(wekenInPeriode("2026-09-21", "2026-09-27"), ["2026-W39"]);
  // Factuur 30-2026: "21.09 t/m 28.09 (week 39)" — de maandag erna is uitloop, geen tweede week.
  assert.deepEqual(wekenInPeriode("2026-09-21", "2026-09-28"), ["2026-W39"]);
  assert.deepEqual(wekenInPeriode("2026-09-20", "2026-09-27"), ["2026-W39"]);
  assert.deepEqual(wekenInPeriode("2026-09-21", "2026-09-29"), ["2026-W39", "2026-W40"]);
  assert.deepEqual(wekenInPeriode("2026-09-21", null), ["2026-W39"]);
  assert.deepEqual(wekenInPeriode(null, null), []);
  assert.deepEqual(wekenInPeriode("2025-12-22", "2026-01-11"), ["2025-W52", "2026-W01", "2026-W02"]);
});

test("watMist: per stap wat er nog ontbreekt, leeg = compleet", () => {
  const leeg = { timesheetOntvangen: false, factuurOntvangen: false, factuurNvt: false, vastgelegd: false, inkoopStatus: null, verkoopStatus: null };
  assert.deepEqual(watMist(leeg), ["Urenstaat", "Factuur freelancer", "Akkoord"]);
  assert.deepEqual(watMist({ ...leeg, timesheetOntvangen: true, factuurNvt: true }), ["Akkoord"]);
  const klaar = { timesheetOntvangen: true, factuurOntvangen: true, factuurNvt: false, vastgelegd: true, inkoopStatus: "PAID", verkoopStatus: "PAID" };
  assert.deepEqual(watMist(klaar), []);
  assert.deepEqual(watMist({ ...klaar, verkoopStatus: "DRAFT", inkoopStatus: "APPROVED" }), ["Versturen", "Freelancer betalen"]);
});
