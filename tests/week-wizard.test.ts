import assert from "node:assert/strict";
import test from "node:test";
import {
  BEDRAG_TOLERANTIE_EUR,
  BEDRAG_TOLERANTIE_PCT,
  STANDAARD_MARGENORM,
  margeGezondheid,
  matchFactuurBedrag,
  parseBedrag,
  wizardVoortgang,
  type FactuurMatchInput,
} from "../src/lib/week-wizard";
import { formatCurrency } from "../src/lib/utils";

// ===========================================================================
// 1) STAPPEN — wizardVoortgang
// ===========================================================================

test("stappen: zonder timesheet mag je nergens heen — stap 1 is verplicht", () => {
  const v = wizardVoortgang({ heeftTimesheet: false, heeftFactuur: false });
  assert.equal(v.timesheet, "todo");
  assert.equal(v.factuur, "todo");
  assert.equal(v.maxStap, 1);
  assert.equal(v.kanAfronden, false);
  assert.equal(v.factuurOntbreekt, true);
});

test("stappen: met een timesheet staat de hele wizard open (de factuur is optioneel)", () => {
  const v = wizardVoortgang({ heeftTimesheet: true, heeftFactuur: false });
  assert.equal(v.timesheet, "done");
  assert.equal(v.factuur, "todo");
  assert.equal(v.maxStap, 3);
  assert.equal(v.kanAfronden, true);
  assert.equal(v.factuurOntbreekt, true);
});

test("stappen: met timesheet én factuur zijn de eerste twee stappen afgevinkt", () => {
  const v = wizardVoortgang({ heeftTimesheet: true, heeftFactuur: true });
  assert.equal(v.timesheet, "done");
  assert.equal(v.factuur, "done");
  assert.equal(v.maxStap, 3);
  assert.equal(v.kanAfronden, true);
  assert.equal(v.factuurOntbreekt, false);
});

test("stappen: een factuur zonder timesheet telt niet — de uren blijven leidend", () => {
  // Kan in de praktijk niet (stap 2 zit achter stap 1), maar de logica moet
  // nooit een week laten afronden zonder uren om te factureren.
  const v = wizardVoortgang({ heeftTimesheet: false, heeftFactuur: true });
  assert.equal(v.maxStap, 1);
  assert.equal(v.kanAfronden, false);
});

// ===========================================================================
// 2) BEDRAG-CONTROLE — matchFactuurBedrag
// ===========================================================================

/** Zijn factuur (€ 2.464) = 32 uur × € 77 inkoop — precies gelijk. */
const MATCH_OK: FactuurMatchInput = { factuurBedrag: 2464, verwachtBedrag: 2464 };

const match = (patch: Partial<FactuurMatchInput> = {}) =>
  matchFactuurBedrag({ ...MATCH_OK, ...patch });

test("bedrag: exact gelijk aan uren × tarief is een schone match", () => {
  const r = match();
  assert.equal(r.status, "klopt");
  assert.equal(r.verschil, 0);
  assert.equal(r.verwacht, 2464);
  assert.match(r.message, /Klopt/);
});

test("bedrag: een cent-verschil valt binnen de tolerantie", () => {
  const r = match({ factuurBedrag: 2464.5 });
  assert.equal(r.status, "klopt");
  assert.equal(r.verschil, 0.5);
});

test("bedrag: de tolerantie is de grootste van € 1 en 1% — 1% van € 2.464 is € 24,64", () => {
  assert.equal(BEDRAG_TOLERANTIE_EUR, 1);
  assert.equal(BEDRAG_TOLERANTIE_PCT, 1);
  const r = match({ factuurBedrag: 2464 + 24.64 });
  assert.equal(r.tolerantie, 24.64);
  assert.equal(r.status, "klopt");
});

test("bedrag: net over de tolerantie is een afwijking", () => {
  const r = match({ factuurBedrag: 2464 + 24.65 });
  assert.equal(r.status, "afwijking");
  assert.equal(r.verschil, 24.65);
  assert.match(r.message, /meer/);
});

test("bedrag: bij een klein verwacht bedrag geldt de ondergrens van € 1", () => {
  // 1% van € 20 is € 0,20 — de vaste € 1 wint, anders zou centenruis al vlaggen.
  const r = matchFactuurBedrag({ factuurBedrag: 20.9, verwachtBedrag: 20 });
  assert.equal(r.tolerantie, 1);
  assert.equal(r.status, "klopt");
});

test("bedrag: te weinig gefactureerd meldt 'minder' met het verschil erin", () => {
  const r = match({ factuurBedrag: 2000 });
  assert.equal(r.status, "afwijking");
  assert.equal(r.verschil, -464);
  assert.match(r.message, /minder/);
  assert.ok(r.message.includes(formatCurrency(464)));
});

test("bedrag: zonder factuurbedrag of zonder verwacht bedrag zeggen we niets", () => {
  for (const patch of [
    { factuurBedrag: null },
    { verwachtBedrag: null },
    { verwachtBedrag: 0 },
    { factuurBedrag: Number.NaN },
  ] as Partial<FactuurMatchInput>[]) {
    const r = match(patch);
    assert.equal(r.status, "onbekend");
    assert.equal(r.verschil, null);
  }
});

test("bedrag: eigen tolerantie is instelbaar", () => {
  const r = matchFactuurBedrag({
    factuurBedrag: 2500,
    verwachtBedrag: 2464,
    tolerantieEur: 50,
    tolerantiePct: 0,
  });
  assert.equal(r.tolerantie, 50);
  assert.equal(r.status, "klopt");
});

test("bedrag: dezelfde invoer geeft altijd hetzelfde antwoord (puur)", () => {
  const input: FactuurMatchInput = { factuurBedrag: 2718.1, verwachtBedrag: 2464 };
  assert.deepEqual(matchFactuurBedrag(input), matchFactuurBedrag(input));
});

// ===========================================================================
// 3) MARGE-BADGE — margeGezondheid
// ===========================================================================

test("marge: boven de norm is groen en noemt de norm", () => {
  const g = margeGezondheid({ marginPerHour: 10, belowNorm: false, normPerHour: STANDAARD_MARGENORM });
  assert.equal(g.color, "green");
  assert.match(g.label, /gezond/);
  assert.ok(g.label.includes(formatCurrency(10)));
});

test("marge: positief maar onder de norm is amber", () => {
  const g = margeGezondheid({ marginPerHour: 4, belowNorm: true, normPerHour: 10 });
  assert.equal(g.color, "amber");
  assert.match(g.label, /laag/);
});

test("marge: nul of negatief is rood, ongeacht de norm", () => {
  assert.equal(margeGezondheid({ marginPerHour: 0, belowNorm: true, normPerHour: 10 }).color, "red");
  assert.equal(margeGezondheid({ marginPerHour: -3, belowNorm: true, normPerHour: null }).color, "red");
});

test("marge: onbepaalbaar wordt neutraal getoond, niet als 'gezond'", () => {
  const g = margeGezondheid({ marginPerHour: null, belowNorm: true, normPerHour: 10 });
  assert.equal(g.color, "slate");
  assert.match(g.label, /onbekend/);
});

test("marge: zonder norm is elke positieve marge gezond", () => {
  const g = margeGezondheid({ marginPerHour: 1.5, belowNorm: false, normPerHour: null });
  assert.equal(g.color, "green");
  assert.equal(g.label, `marge gezond (${formatCurrency(1.5)}/u)`);
});

// ===========================================================================
// 4) BEDRAG INLEZEN — parseBedrag
// ===========================================================================

test("bedrag inlezen: Nederlandse notatie met duizendtal-punt en komma", () => {
  assert.equal(parseBedrag("3.146,00"), 3146);
  assert.equal(parseBedrag("€ 2.718,10"), 2718.1);
  assert.equal(parseBedrag("12.345,67"), 12345.67);
});

test("bedrag inlezen: losse punten in een duizendtal-patroon zijn duizendtallen", () => {
  assert.equal(parseBedrag("3.840"), 3840);
  assert.equal(parseBedrag("12.345"), 12345);
});

test("bedrag inlezen: een punt als decimaalteken blijft een decimaalteken", () => {
  assert.equal(parseBedrag("3840.50"), 3840.5);
  assert.equal(parseBedrag(2464.5), 2464.5);
});

test("bedrag inlezen: leeg of onleesbaar is null (niet 0)", () => {
  assert.equal(parseBedrag(""), null);
  assert.equal(parseBedrag("   "), null);
  assert.equal(parseBedrag(null), null);
  assert.equal(parseBedrag(undefined), null);
  assert.equal(parseBedrag("n.v.t."), null);
  assert.equal(parseBedrag(Number.NaN), null);
});

test("bedrag inlezen: negatieve bedragen worden niet stilletjes positief", () => {
  assert.equal(parseBedrag("-120,50"), -120.5);
});
