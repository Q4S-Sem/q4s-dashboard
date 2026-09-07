import assert from "node:assert/strict";
import test from "node:test";
import {
  dedupeTimesheetsPerPersonWeek,
  dubbelePersoonWeken,
  dubbeleUploadLabel,
  persoonWeekSleutel,
  type DubbelBasis,
} from "../src/lib/wizard-dubbelen";

// ---------------------------------------------------------------------------
// DUBBELE UPLOADS in de wizard "Week verwerken".
//
// Dezelfde persoon-week hoort ÉÉN keer in beeld te staan. Wordt een urenstaat
// twee keer geüpload (of per mail én met de hand), dan liggen er twee ruwe
// inbox-regels van dezelfde week. Deze module houdt er één zichtbaar en geeft de
// andere terug als "verborgen dubbele", zodat het scherm er een opruim-melding
// bij kan zetten. Er wordt NOOIT iets verwijderd — dat blijft mensenwerk.
//
// De week komt uit de GEWERKTE DAGEN (canonicalWeekFromDates via
// weekSlotVanDatum), nooit uit een bestandsnaam. Is de week nog onbekend (niet
// uitgelezen), dan valt er niets te vergelijken en blijft elke staat staan.
//
// Alles hier is puur: geen `new Date()`, geen Prisma.
// ---------------------------------------------------------------------------

/** Eén openstaande weekstaat; alleen de velden die het ontdubbelen aangaan. */
function staat(over: Partial<DubbelBasis> & { id: string }): DubbelBasis {
  return {
    naam: "Jan Jansen",
    consultantId: "c1",
    weekStart: "2026-08-24",
    status: "EXTRACTED",
    ontvangen: "2026-08-31",
    ...over,
  };
}

const ids = (items: readonly DubbelBasis[]) => items.map((i) => i.id);

// ===========================================================================
// 1) DE SLEUTEL — persoon + canonieke week
// ===========================================================================

test("de sleutel is de persoon plus zijn canonieke week", () => {
  const a = persoonWeekSleutel(staat({ id: "a", weekStart: "2026-08-24" }));
  // Woensdag uit dezelfde ISO-week: dezelfde sleutel.
  const b = persoonWeekSleutel(staat({ id: "b", weekStart: "2026-08-26" }));
  assert.ok(a !== null);
  assert.equal(a, b);
});

test("zonder bekende week is er geen sleutel", () => {
  assert.equal(persoonWeekSleutel(staat({ id: "a", weekStart: "" })), null);
  assert.equal(persoonWeekSleutel(staat({ id: "b", weekStart: "geen datum" })), null);
});

test("zonder persoon (geen id, geen naam) is er geen sleutel", () => {
  assert.equal(persoonWeekSleutel(staat({ id: "a", consultantId: null, naam: "  " })), null);
});

// ===========================================================================
// 2) SAMENKLAPPEN — dezelfde persoon, dezelfde week
// ===========================================================================

test("dezelfde persoon + week blijft één regel", () => {
  const r = dedupeTimesheetsPerPersonWeek([
    staat({ id: "eerste" }),
    staat({ id: "tweede" }),
  ]);
  assert.equal(r.items.length, 1);
  assert.equal(r.verborgen.length, 1);
});

test("een dag midden in dezelfde ISO-week telt als dezelfde week", () => {
  const r = dedupeTimesheetsPerPersonWeek([
    staat({ id: "maandag", weekStart: "2026-08-24" }),
    staat({ id: "woensdag", weekStart: "2026-08-26" }),
  ]);
  assert.equal(r.items.length, 1);
});

test("de uitgelezen staat wint van de nog niet uitgelezene", () => {
  const r = dedupeTimesheetsPerPersonWeek([
    staat({ id: "ongelezen", status: "NEW", ontvangen: "2026-09-02" }),
    staat({ id: "gelezen", status: "EXTRACTED", ontvangen: "2026-08-31" }),
  ]);
  assert.deepEqual(ids(r.items), ["gelezen"]);
  assert.deepEqual(r.verborgen, ["ongelezen"]);
});

test("bij gelijke status wint de laatst binnengekomen staat", () => {
  const r = dedupeTimesheetsPerPersonWeek([
    staat({ id: "oud", ontvangen: "2026-08-28" }),
    staat({ id: "nieuw", ontvangen: "2026-09-01" }),
  ]);
  assert.deepEqual(ids(r.items), ["nieuw"]);
  assert.deepEqual(r.verborgen, ["oud"]);
});

test("bij dezelfde dag beslist het id — de uitkomst staat altijd vast", () => {
  const heen = dedupeTimesheetsPerPersonWeek([staat({ id: "a" }), staat({ id: "b" })]);
  const terug = dedupeTimesheetsPerPersonWeek([staat({ id: "b" }), staat({ id: "a" })]);
  assert.deepEqual(ids(heen.items), ["b"]);
  assert.deepEqual(ids(terug.items), ["b"]);
});

test("drie keer dezelfde week: één blijft over, twee worden verborgen", () => {
  const r = dedupeTimesheetsPerPersonWeek([
    staat({ id: "a", ontvangen: "2026-08-28" }),
    staat({ id: "b", ontvangen: "2026-08-30" }),
    staat({ id: "c", ontvangen: "2026-08-29" }),
  ]);
  assert.deepEqual(ids(r.items), ["b"]);
  assert.deepEqual([...r.verborgen].sort(), ["a", "c"]);
});

// ===========================================================================
// 3) WAT NIET SAMENKLAPT
// ===========================================================================

test("verschillende weken van dezelfde persoon blijven allebei staan", () => {
  const r = dedupeTimesheetsPerPersonWeek([
    staat({ id: "week35", weekStart: "2026-08-24" }),
    staat({ id: "week36", weekStart: "2026-08-31" }),
  ]);
  assert.deepEqual(ids(r.items), ["week35", "week36"]);
  assert.deepEqual(r.verborgen, []);
  assert.deepEqual(r.dubbelen, {});
});

test("dezelfde week van verschillende personen blijft staan", () => {
  const r = dedupeTimesheetsPerPersonWeek([
    staat({ id: "jan", consultantId: "c1" }),
    staat({ id: "piet", consultantId: "c2", naam: "Piet Peters" }),
  ]);
  assert.deepEqual(ids(r.items), ["jan", "piet"]);
});

test("staten zonder bekende week worden nooit samengeklapt", () => {
  const r = dedupeTimesheetsPerPersonWeek([
    staat({ id: "leeg1", weekStart: "", status: "NEW" }),
    staat({ id: "leeg2", weekStart: "", status: "NEW" }),
    staat({ id: "leeg3", weekStart: null, status: "NEW" }),
  ]);
  assert.deepEqual(ids(r.items), ["leeg1", "leeg2", "leeg3"]);
  assert.deepEqual(r.verborgen, []);
});

// ===========================================================================
// 4) TERUGVAL OP DE NAAM — de persoon is nog niet gematcht
// ===========================================================================

test("zonder consultantId groepeert hij op naam", () => {
  const r = dedupeTimesheetsPerPersonWeek([
    staat({ id: "scan1", consultantId: null, naam: "Sören Müller" }),
    staat({ id: "scan2", consultantId: null, naam: "  soren muller " }),
  ]);
  assert.equal(r.items.length, 1);
  assert.deepEqual(r.verborgen, ["scan1"]);
});

test("verschillende namen zonder consultantId blijven apart", () => {
  const r = dedupeTimesheetsPerPersonWeek([
    staat({ id: "scan1", consultantId: null, naam: "Jan Jansen" }),
    staat({ id: "scan2", consultantId: null, naam: "Piet Peters" }),
  ]);
  assert.deepEqual(ids(r.items), ["scan1", "scan2"]);
});

test("een gematchte en een ongematchte staat van dezelfde week blijven apart", () => {
  // Zonder consultantId weten we niet zeker dat het dezelfde mens is — dan liever
  // twee regels tonen dan er stilletjes één verstoppen.
  const r = dedupeTimesheetsPerPersonWeek([
    staat({ id: "gematcht", consultantId: "c1" }),
    staat({ id: "los", consultantId: null }),
  ]);
  assert.deepEqual(ids(r.items), ["gematcht", "los"]);
});

// ===========================================================================
// 5) WAT ERUIT KOMT — de verborgen dubbelen, per bewaarde staat
// ===========================================================================

test("de verborgen dubbelen hangen aan de staat die blijft staan", () => {
  const r = dedupeTimesheetsPerPersonWeek([
    staat({ id: "blijft", ontvangen: "2026-09-01" }),
    staat({ id: "weg", ontvangen: "2026-08-28" }),
    staat({ id: "andere-week", weekStart: "2026-08-31" }),
  ]);
  assert.deepEqual(ids(r.items), ["blijft", "andere-week"]);
  assert.deepEqual(Object.keys(r.dubbelen), ["blijft"]);
  assert.deepEqual(ids(r.dubbelen["blijft"]), ["weg"]);
  assert.deepEqual(r.verborgen, ["weg"]);
});

test("de volgorde van de lijst blijft staan — de bewaarde staat neemt de plek in", () => {
  const r = dedupeTimesheetsPerPersonWeek([
    staat({ id: "week36", weekStart: "2026-08-31" }),
    staat({ id: "week35-oud", weekStart: "2026-08-24", ontvangen: "2026-08-28" }),
    staat({ id: "week37", weekStart: "2026-09-07" }),
    staat({ id: "week35-nieuw", weekStart: "2026-08-24", ontvangen: "2026-09-01" }),
  ]);
  assert.deepEqual(ids(r.items), ["week36", "week35-nieuw", "week37"]);
});

test("de gegeven lijst wordt niet aangeraakt", () => {
  const lijst = [staat({ id: "a" }), staat({ id: "b" })];
  dedupeTimesheetsPerPersonWeek(lijst);
  assert.deepEqual(ids(lijst), ["a", "b"]);
});

test("lege of ontbrekende invoer geeft een lege uitkomst", () => {
  for (const invoer of [[], null, undefined]) {
    const r = dedupeTimesheetsPerPersonWeek(invoer);
    assert.deepEqual(r.items, []);
    assert.deepEqual(r.verborgen, []);
    assert.deepEqual(r.dubbelen, {});
  }
});

// ===========================================================================
// 6) DUBBELEN AANWIJZEN — de lijst blijft heel, de dubbelen krijgen een badge
// ===========================================================================
//
// De timesheet-inbox (/inbox) verbergt bewust NIETS: daar zie je alle
// binnengekomen scans van een week. Om de twee identieke regels van dezelfde
// persoon-week toch te herkennen wijst deze functie ze allemaal aan, zodat het
// scherm er "dubbel" bij kan zetten en je er één kunt weggooien.

test("beide regels van dezelfde persoon-week worden aangewezen", () => {
  const dubbel = dubbelePersoonWeken([staat({ id: "a" }), staat({ id: "b" })]);
  assert.deepEqual([...dubbel].sort(), ["a", "b"]);
});

test("een week die maar één keer voorkomt is geen dubbele", () => {
  const dubbel = dubbelePersoonWeken([
    staat({ id: "week35", weekStart: "2026-08-24" }),
    staat({ id: "week36", weekStart: "2026-08-31" }),
  ]);
  assert.equal(dubbel.size, 0);
});

test("drie keer dezelfde week wijst alle drie de regels aan", () => {
  const dubbel = dubbelePersoonWeken([
    staat({ id: "a" }),
    staat({ id: "b" }),
    staat({ id: "c" }),
    staat({ id: "andere-week", weekStart: "2026-08-31" }),
  ]);
  assert.deepEqual([...dubbel].sort(), ["a", "b", "c"]);
});

test("dezelfde week van verschillende personen is geen dubbele", () => {
  const dubbel = dubbelePersoonWeken([
    staat({ id: "jan", consultantId: "c1" }),
    staat({ id: "piet", consultantId: "c2", naam: "Piet Peters" }),
  ]);
  assert.equal(dubbel.size, 0);
});

test("staten zonder bekende week worden nooit als dubbel aangewezen", () => {
  const dubbel = dubbelePersoonWeken([
    staat({ id: "leeg1", weekStart: "" }),
    staat({ id: "leeg2", weekStart: null }),
  ]);
  assert.equal(dubbel.size, 0);
});

test("de dagen midden in dezelfde ISO-week tellen als dezelfde week", () => {
  const dubbel = dubbelePersoonWeken([
    staat({ id: "maandag", weekStart: "2026-08-24" }),
    staat({ id: "woensdag", weekStart: "2026-08-26" }),
  ]);
  assert.deepEqual([...dubbel].sort(), ["maandag", "woensdag"]);
});

test("lege of ontbrekende invoer geeft geen dubbelen", () => {
  for (const invoer of [[], null, undefined]) {
    assert.equal(dubbelePersoonWeken(invoer).size, 0);
  }
});

// ===========================================================================
// 7) HET LABEL bij de melding in stap 1
// ===========================================================================

test("het label telt de verborgen uploads mee", () => {
  assert.equal(dubbeleUploadLabel(1), "1 dubbele upload verborgen");
  assert.equal(dubbeleUploadLabel(2), "2 dubbele uploads verborgen");
  assert.equal(dubbeleUploadLabel(0), "");
  assert.equal(dubbeleUploadLabel(-3), "");
});
