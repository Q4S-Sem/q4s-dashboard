import assert from "node:assert/strict";
import test from "node:test";
import {
  autoSelectTimesheet,
  type AutoKiesBasis,
} from "../src/app/(app)/verwerken/nieuw/wizard-data";

// ---------------------------------------------------------------------------
// VANZELF OPENZETTEN in stap 1 van de wizard "Week verwerken".
//
// Ligt er voor de week die de eigenaar bovenaan koos precies ÉÉN weekstaat, en
// is die al uitgelezen, dan hoeft hij die regel niet eerst nog eens aan te
// klikken: stap 1 zet hem meteen open en "Volgende: factuur" doet het gelijk.
//
// Bewust terughoudend — vanzelf openen mag nooit een keuze wegnemen:
//   - nog niet uitgelezen (NEW) of zonder uren → daar moet de mens bij;
//   - meer dan één week open              → hij kiest zelf welke;
//   - geen gekozen week                   → er valt niets te kiezen.
//
// De week wordt AFGELEZEN uit de gewerkte dagen (weekstaatWeekKey →
// weekSlotVanDatum), nooit uit een bestandsnaam. Alles hier is puur.
// ---------------------------------------------------------------------------

type Staat = AutoKiesBasis & { id: string };

/** Eén openstaande weekstaat; alleen de velden die het openzetten aangaan. */
function staat(over: Partial<Staat> & { id: string }): Staat {
  return {
    status: "EXTRACTED",
    weekStart: "2026-08-24", // week 35
    dagUren: ["8", "8", "8", "8", "8", "", ""],
    ...over,
  };
}

const WEEK35 = "2026-W35";
const WEEK36 = "2026-W36";

// ===========================================================================
// 1) WAT WÉL VANZELF OPENGAAT — één uitgelezen week
// ===========================================================================

test("de enige uitgelezen week van de gekozen week gaat vanzelf open", () => {
  const item = staat({ id: "week35" });
  assert.equal(autoSelectTimesheet([item], WEEK35), item);
});

test("een dag midden in de week telt gewoon als die week", () => {
  const item = staat({ id: "woensdag", weekStart: "2026-08-26" });
  assert.equal(autoSelectTimesheet([item], WEEK35), item);
});

test("uren met een komma tellen ook als uren", () => {
  const item = staat({ id: "halve-dag", dagUren: ["7,5", "", "", "", "", "", ""] });
  assert.equal(autoSelectTimesheet([item], WEEK35), item);
});

test("een uitgelezen staat die nagekeken moet worden gaat ook open — de mens ziet 'm dan", () => {
  const item = staat({ id: "nakijken", status: "REVIEW" });
  assert.equal(autoSelectTimesheet([item], WEEK35), item);
});

// ===========================================================================
// 2) WAT NIET VANZELF OPENGAAT
// ===========================================================================

test("een nog niet uitgelezen staat blijft dicht", () => {
  const item = staat({ id: "nieuw", status: "NEW", dagUren: ["", "", "", "", "", "", ""] });
  assert.equal(autoSelectTimesheet([item], WEEK35), null);
});

test("ook een NEW-staat waar toevallig uren in staan blijft dicht", () => {
  assert.equal(autoSelectTimesheet([staat({ id: "nieuw", status: "NEW" })], WEEK35), null);
});

test("uitgelezen maar zonder uren blijft dicht — daar moet de mens bij", () => {
  const leeg = staat({ id: "geen-uren", dagUren: ["", "", "", "0", "", "", ""] });
  assert.equal(autoSelectTimesheet([leeg], WEEK35), null);
  assert.equal(autoSelectTimesheet([staat({ id: "zonder", dagUren: null })], WEEK35), null);
});

test("twee weekstaten in dezelfde week: hij kiest zelf welke", () => {
  const items = [staat({ id: "a" }), staat({ id: "b", weekStart: "2026-08-26" })];
  assert.equal(autoSelectTimesheet(items, WEEK35), null);
});

test("staat er niets open in de gekozen week, dan gaat er niets open", () => {
  assert.equal(autoSelectTimesheet([staat({ id: "week36" })], WEEK36), null);
  assert.equal(autoSelectTimesheet([], WEEK35), null);
});

test("zonder gekozen week gaat er niets open", () => {
  const items = [staat({ id: "week35" })];
  assert.equal(autoSelectTimesheet(items, ""), null);
  assert.equal(autoSelectTimesheet(items, null), null);
  assert.equal(autoSelectTimesheet(items, undefined), null);
});

test("lege of ontbrekende lijst geeft niets", () => {
  for (const invoer of [[], null, undefined]) {
    assert.equal(autoSelectTimesheet(invoer, WEEK35), null);
  }
});

test("een staat zonder leesbare week hoort bij geen enkele week", () => {
  assert.equal(autoSelectTimesheet([staat({ id: "leeg", weekStart: "" })], WEEK35), null);
  assert.equal(autoSelectTimesheet([staat({ id: "raar", weekStart: "geen datum" })], WEEK35), null);
});

// ===========================================================================
// 3) DE GEKOZEN WEEK IS LEIDEND — andere weken blijven staan
// ===========================================================================

test("alleen de gekozen week telt mee, de andere weken doen niet mee", () => {
  const week35 = staat({ id: "week35", weekStart: "2026-08-24" });
  const week36 = staat({ id: "week36", weekStart: "2026-08-31" });
  const week37 = staat({ id: "week37", weekStart: "2026-09-07" });
  const items = [week36, week35, week37];
  assert.equal(autoSelectTimesheet(items, WEEK35), week35);
  assert.equal(autoSelectTimesheet(items, WEEK36), week36);
  assert.equal(autoSelectTimesheet(items, "2026-W37"), week37);
});

test("meerdere open weken maken de gekozen week niet onduidelijk", () => {
  // Twee weken open, maar in de GEKOZEN week ligt er precies één uitgelezen
  // staat — die mag gewoon open; de andere week blijft gewoon te kiezen.
  const week35 = staat({ id: "week35" });
  const week36 = staat({ id: "week36", weekStart: "2026-08-31", status: "NEW" });
  assert.equal(autoSelectTimesheet([week35, week36], WEEK35), week35);
  assert.equal(autoSelectTimesheet([week35, week36], WEEK36), null);
});

test("de gegeven lijst wordt niet aangeraakt", () => {
  const items = [staat({ id: "a" }), staat({ id: "b", weekStart: "2026-08-31" })];
  autoSelectTimesheet(items, WEEK35);
  assert.deepEqual(
    items.map((i) => i.id),
    ["a", "b"],
  );
});
