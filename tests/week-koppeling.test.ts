import assert from "node:assert/strict";
import test from "node:test";
import {
  buildWeekStrip,
  canonicalWeekFromDates,
  recenteWeken,
  weekKey,
  weekMismatch,
  weekMismatchLabel,
  weekNummerUitTekst,
} from "../src/lib/week-koppeling";
import { parseWeekNumber } from "../src/lib/invoice-extract";

// ===========================================================================
// 1) DE WAARHEID — canonicalWeekFromDates
// ===========================================================================
// Alle gebruikte datums zijn met de hand na te rekenen:
//   2025-08-18 = maandag van ISO-week 34 (2025-08-24 is de zondag daarvan)
//   2025-12-29 = maandag van ISO-week 1 van 2026 (1 jan 2026 is een donderdag)
//   2020-12-28 = maandag van ISO-week 53 van 2020 (2020 heeft er 53)

test("waarheid: een maandag geeft zijn eigen ISO-week", () => {
  const w = canonicalWeekFromDates(new Date("2025-08-18T00:00:00"));
  assert.deepEqual(w, { isoWeek: 34, year: 2025, monday: new Date("2025-08-18T00:00:00") });
});

test("waarheid: de zondag van dezelfde week levert diezelfde maandag op", () => {
  // Precies het geval van de baas: de gefactureerde regels lopen 24.08–30.08,
  // maar op de stukken staat week 35. De gewerkte dagen beginnen in week 34.
  const w = canonicalWeekFromDates(new Date("2025-08-24T00:00:00"));
  assert.equal(w?.isoWeek, 34);
  assert.equal(w?.year, 2025);
  assert.equal(w?.monday.getTime(), new Date("2025-08-18T00:00:00").getTime());
});

test("waarheid: een tijdstip midden op de dag verandert niets (maandag = middernacht)", () => {
  const w = canonicalWeekFromDates(new Date("2025-08-21T16:45:12"));
  assert.equal(w?.isoWeek, 34);
  assert.equal(w?.monday.getHours(), 0);
  assert.equal(w?.monday.getMinutes(), 0);
});

test("waarheid: jaargrens — maandag 29-12-2025 hoort bij week 1 van 2026", () => {
  const w = canonicalWeekFromDates(new Date("2025-12-29T00:00:00"));
  assert.deepEqual(w, { isoWeek: 1, year: 2026, monday: new Date("2025-12-29T00:00:00") });
});

test("waarheid: jaargrens andersom — 01-01-2021 valt nog in week 53 van 2020", () => {
  const w = canonicalWeekFromDates(new Date("2021-01-01T00:00:00"));
  assert.equal(w?.isoWeek, 53);
  assert.equal(w?.year, 2020);
  assert.equal(w?.monday.getTime(), new Date("2020-12-28T00:00:00").getTime());
});

test("waarheid: week 53 bestaat gewoon (2020 heeft er 53)", () => {
  const w = canonicalWeekFromDates(new Date("2020-12-31T00:00:00"));
  assert.equal(w?.isoWeek, 53);
  assert.equal(w?.year, 2020);
});

test("waarheid: 'YYYY-MM-DD' mag ook — het formulierformaat van de wizard", () => {
  const w = canonicalWeekFromDates("2025-08-24");
  assert.equal(w?.isoWeek, 34);
  assert.equal(w?.year, 2025);
});

test("waarheid: zonder (of met een onleesbare) datum is er geen week", () => {
  assert.equal(canonicalWeekFromDates(null), null);
  assert.equal(canonicalWeekFromDates(undefined), null);
  assert.equal(canonicalWeekFromDates(""), null);
  assert.equal(canonicalWeekFromDates("geen datum"), null);
  assert.equal(canonicalWeekFromDates(new Date("onzin")), null);
});

// ===========================================================================
// 2) DE AFWIJKING — weekMismatch + label
// ===========================================================================

test("afwijking: gelijk weeknummer → geen melding", () => {
  assert.equal(weekMismatch({ canonicalWeek: 34, typedWeek: 34 }), null);
});

test("afwijking: hij schreef 35, de dagen zeggen 34", () => {
  assert.deepEqual(weekMismatch({ canonicalWeek: 34, typedWeek: 35 }), { typed: 35, echt: 34 });
});

test("afwijking: geen weeknummer op de stukken → niets te melden", () => {
  assert.equal(weekMismatch({ canonicalWeek: 34, typedWeek: null }), null);
  assert.equal(weekMismatch({ canonicalWeek: 34, typedWeek: undefined }), null);
});

test("afwijking: geen echte week (nog geen datums) → niets te melden", () => {
  assert.equal(weekMismatch({ canonicalWeek: null, typedWeek: 35 }), null);
});

test("afwijking: de canonieke week mag ook als heel object mee", () => {
  const echt = canonicalWeekFromDates("2025-08-24");
  assert.deepEqual(weekMismatch({ canonicalWeek: echt, typedWeek: 35 }), { typed: 35, echt: 34 });
  assert.equal(weekMismatch({ canonicalWeek: echt, typedWeek: 34 }), null);
});

test("afwijking: een onmogelijk weeknummer telt als 'niet vermeld'", () => {
  assert.equal(weekMismatch({ canonicalWeek: 34, typedWeek: 0 }), null);
  assert.equal(weekMismatch({ canonicalWeek: 34, typedWeek: 54 }), null);
  assert.equal(weekMismatch({ canonicalWeek: 34, typedWeek: 3.5 }), null);
});

test("afwijking: jaargrens — 'week 52' op de stukken terwijl het week 1 is", () => {
  const echt = canonicalWeekFromDates("2025-12-29");
  assert.deepEqual(weekMismatch({ canonicalWeek: echt, typedWeek: 52 }), { typed: 52, echt: 1 });
});

test("label: leest als gewoon Nederlands, met beide nummers erin", () => {
  const melding = weekMismatchLabel({ typed: 35, echt: 34 });
  assert.equal(
    melding,
    "Op de stukken staat week 35, maar de gewerkte dagen vallen in week 34. Wij houden week 34 aan.",
  );
});

// ===========================================================================
// 3) HET GETYPTE WEEKNUMMER — weekNummerUitTekst (bestandsnamen/koptekst)
// ===========================================================================

test("getypt: 'week 35' uit een bestandsnaam", () => {
  assert.equal(weekNummerUitTekst("Urenstaat week 35.pdf"), 35);
  assert.equal(weekNummerUitTekst("week35.pdf"), 35);
  assert.equal(weekNummerUitTekst("WK 7 - Jansen.xlsx"), 7);
  assert.equal(weekNummerUitTekst("Week nr. 27 (definitief).pdf"), 27);
  assert.equal(weekNummerUitTekst("timesheet-week_07.pdf"), 7);
});

test("getypt: alleen een getal ná 'week' telt — geen losse getallen uit de naam", () => {
  // Zonder deze eis zou "08" (een dag- of maandnummer) een vals alarm geven.
  assert.equal(weekNummerUitTekst("Jansen 08 week 35.pdf"), 35);
  assert.equal(weekNummerUitTekst("Urenstaat 2026.pdf"), null);
  assert.equal(weekNummerUitTekst("weekstaat 12.pdf"), null);
  assert.equal(weekNummerUitTekst("factuur 2026-014.pdf"), null);
});

test("getypt: een onmogelijk weeknummer levert niets op", () => {
  assert.equal(weekNummerUitTekst("week 54.pdf"), null);
  assert.equal(weekNummerUitTekst("week 0.pdf"), null);
  assert.equal(weekNummerUitTekst("week 353.pdf"), null);
  assert.equal(weekNummerUitTekst(null), null);
  assert.equal(weekNummerUitTekst(""), null);
});

test("getypt: samen met parseWeekNumber uit invoice-extract dekt dit de factuurkop", () => {
  // De factuur-uitlezing levert vaak alleen het getal; de bestandsnaam is de
  // terugval. Beide moeten op hetzelfde nummer uitkomen.
  assert.equal(parseWeekNumber("week 35") ?? weekNummerUitTekst("factuur week 35.pdf"), 35);
  assert.equal(parseWeekNumber("") ?? weekNummerUitTekst("factuur week 35.pdf"), 35);
  assert.equal(parseWeekNumber("") ?? weekNummerUitTekst("factuur 2026-014.pdf"), null);
});

// ===========================================================================
// 4) DE WEEKSTROOK — weekKey, recenteWeken, buildWeekStrip
// ===========================================================================

test("sleutel: jaar + genummerde week, altijd twee cijfers", () => {
  assert.equal(weekKey({ isoWeek: 34, year: 2025 }), "2025-W34");
  assert.equal(weekKey({ isoWeek: 4, year: 2026 }), "2026-W04");
  assert.equal(weekKey({ isoWeek: 53, year: 2020 }), "2020-W53");
});

test("strook: de laatste N weken t/m de week van vandaag, oudste eerst", () => {
  const weken = recenteWeken(new Date("2025-08-24T12:00:00"), 3);
  assert.deepEqual(
    weken.map((w) => w.key),
    ["2025-W32", "2025-W33", "2025-W34"],
  );
  assert.deepEqual(
    weken.map((w) => w.monday),
    ["2025-08-04", "2025-08-11", "2025-08-18"],
  );
  assert.equal(weken[2].isoWeek, 34);
  assert.equal(weken[2].year, 2025);
});

test("strook: loopt netjes over de jaargrens heen", () => {
  // Vrijdag 02-01-2026 valt nog in week 1 van 2026 (maandag 29-12-2025).
  const weken = recenteWeken(new Date("2026-01-02T09:00:00"), 3);
  assert.deepEqual(
    weken.map((w) => w.key),
    ["2025-W51", "2025-W52", "2026-W01"],
  );
});

test("strook: een onzinnig aantal valt terug op de standaard van 10 weken", () => {
  assert.equal(recenteWeken(new Date("2025-08-24T12:00:00")).length, 10);
  assert.equal(recenteWeken(new Date("2025-08-24T12:00:00"), 0).length, 10);
  assert.equal(recenteWeken(new Date("2025-08-24T12:00:00"), -3).length, 10);
});

test("status: verwerkt, ontbreekt, en de lopende week telt niet als gemist", () => {
  const weken = recenteWeken(new Date("2025-08-24T12:00:00"), 3);
  const strip = buildWeekStrip({ weken, verwerkt: ["2025-W32"] });
  assert.deepEqual(
    strip.map((c) => c.status),
    ["verwerkt", "ontbreekt", "loopt"],
  );
});

test("status: een week met een geconstateerde weekafwijking springt eruit", () => {
  const weken = recenteWeken(new Date("2025-08-24T12:00:00"), 3);
  const strip = buildWeekStrip({
    weken,
    verwerkt: ["2025-W32", "2025-W33"],
    afwijkend: ["2025-W33"],
  });
  assert.deepEqual(
    strip.map((c) => c.status),
    ["verwerkt", "afwijking", "loopt"],
  );
});

test("status: de week die nu in de wizard staat is 'bezig'", () => {
  const weken = recenteWeken(new Date("2025-08-24T12:00:00"), 3);
  const strip = buildWeekStrip({ weken, verwerkt: [], bezig: "2025-W33" });
  assert.deepEqual(
    strip.map((c) => c.status),
    ["ontbreekt", "bezig", "loopt"],
  );
});

test("status: bezig + afwijking → afwijking (dat is het punt dat aandacht vraagt)", () => {
  const weken = recenteWeken(new Date("2025-08-24T12:00:00"), 3);
  const strip = buildWeekStrip({
    weken,
    verwerkt: [],
    afwijkend: ["2025-W33"],
    bezig: "2025-W33",
  });
  assert.equal(strip[1].status, "afwijking");
});

test("status: een week buiten de strook verandert niets", () => {
  const weken = recenteWeken(new Date("2025-08-24T12:00:00"), 3);
  const strip = buildWeekStrip({ weken, verwerkt: ["2024-W12"], bezig: "2019-W01" });
  assert.deepEqual(
    strip.map((c) => c.status),
    ["ontbreekt", "ontbreekt", "loopt"],
  );
});

test("strook: elke cel draagt zijn eigen Nederlandse omschrijving", () => {
  const weken = recenteWeken(new Date("2025-08-24T12:00:00"), 3);
  const strip = buildWeekStrip({ weken, verwerkt: ["2025-W32"], afwijkend: [] });
  assert.equal(strip[0].titel, "Week 32 · 2025 — verwerkt");
  assert.equal(strip[1].titel, "Week 33 · 2025 — nog geen urenstaat");
  assert.equal(strip[2].titel, "Week 34 · 2025 — deze week loopt nog");
  assert.equal(strip.length, 3);
});
