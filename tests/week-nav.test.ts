import assert from "node:assert/strict";
import test from "node:test";
import { parseWeek, shiftWeek, weekHref, ymd } from "../src/lib/week-nav";

// ---------------------------------------------------------------------------
// De rekenaars onder de week-balk (src/components/week-balk.tsx). Elke pagina met
// een week-balk gebruikt deze drie functies, dus ze moeten overal hetzelfde doen:
// dezelfde maandag, dezelfde "YYYY-MM-DD", dezelfde link.
//
// PUUR: geen `new Date()` van binnenuit, geen tijdzone-aannames buiten "lokaal".
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// ymd — een datum als "YYYY-MM-DD" in de LOKALE tijdzone
// ---------------------------------------------------------------------------

test("ymd zet een datum om naar YYYY-MM-DD met nullen ervoor", () => {
  assert.equal(ymd(new Date(2026, 8, 7)), "2026-09-07");
  assert.equal(ymd(new Date(2026, 0, 1)), "2026-01-01");
  assert.equal(ymd(new Date(2025, 11, 29)), "2025-12-29");
});

test("ymd gebruikt de LOKALE dag, niet de UTC-dag", () => {
  // 23:30 lokaal is in een oostelijke tijdzone al de volgende dag in UTC. De
  // week-param moet de dag zijn die de gebruiker ziet.
  const laatOpDeAvond = new Date(2026, 8, 7, 23, 30, 0);
  assert.equal(ymd(laatOpDeAvond), "2026-09-07");
});

// ---------------------------------------------------------------------------
// parseWeek — "YYYY-MM-DD" terug naar een echte maandag
// ---------------------------------------------------------------------------

test("parseWeek geeft de maandag van die week op lokale middernacht", () => {
  const maandag = parseWeek("2026-09-07");
  assert.ok(maandag);
  assert.equal(maandag.getFullYear(), 2026);
  assert.equal(maandag.getMonth(), 8);
  assert.equal(maandag.getDate(), 7);
  assert.equal(maandag.getHours(), 0);
  assert.equal(maandag.getDay(), 1);
});

test("parseWeek trekt een dag midden in de week naar zijn maandag", () => {
  // Donderdag 10-09-2026 hoort bij de week van maandag 07-09-2026.
  assert.equal(ymd(parseWeek("2026-09-10")!), "2026-09-07");
  // Zondag 13-09-2026 is de LAATSTE dag van diezelfde week (ISO: ma t/m zo).
  assert.equal(ymd(parseWeek("2026-09-13")!), "2026-09-07");
});

test("parseWeek neemt ook een Date aan", () => {
  assert.equal(ymd(parseWeek(new Date(2026, 8, 10))!), "2026-09-07");
});

test("parseWeek geeft null bij onleesbare of kalender-ongeldige invoer", () => {
  assert.equal(parseWeek(""), null);
  assert.equal(parseWeek("vorige week"), null);
  assert.equal(parseWeek("2026-9-7"), null);
  assert.equal(parseWeek("2026-13-40"), null);
  assert.equal(parseWeek(null), null);
  assert.equal(parseWeek(undefined), null);
  assert.equal(parseWeek(new Date("onzin")), null);
});

// ---------------------------------------------------------------------------
// shiftWeek — een week vooruit of terug
// ---------------------------------------------------------------------------

test("shiftWeek springt één week vooruit en terug", () => {
  assert.equal(shiftWeek("2026-09-07", 1), "2026-09-14");
  assert.equal(shiftWeek("2026-09-07", -1), "2026-08-31");
});

test("shiftWeek met 0 normaliseert naar de maandag van die week", () => {
  assert.equal(shiftWeek("2026-09-07", 0), "2026-09-07");
  assert.equal(shiftWeek("2026-09-10", 0), "2026-09-07");
});

test("shiftWeek neemt ook een Date aan", () => {
  assert.equal(shiftWeek(new Date(2026, 8, 7), 1), "2026-09-14");
});

test("shiftWeek loopt netjes over de maand- en jaargrens", () => {
  // 29-12-2025 is de maandag van ISO-week 1 van 2026.
  assert.equal(shiftWeek("2025-12-29", 1), "2026-01-05");
  assert.equal(shiftWeek("2025-12-29", -1), "2025-12-22");
  assert.equal(shiftWeek("2026-03-30", 1), "2026-04-06");
});

test("shiftWeek stapt ook meer dan één week", () => {
  assert.equal(shiftWeek("2026-09-07", 4), "2026-10-05");
  assert.equal(shiftWeek("2026-09-07", -4), "2026-08-10");
});

test("shiftWeek landt ALTIJD op een maandag — ook over de zomertijd heen", () => {
  // Een jaar lang doorstappen: als er ergens met kale millisecondes gerekend zou
  // worden, schuift de klok bij de zomertijd-overgang een uur en verspringt de
  // dag. Tijdzone-onafhankelijk: we eisen alleen "het blijft maandag".
  let week = "2026-01-05";
  for (let i = 0; i < 60; i++) {
    week = shiftWeek(week, 1);
    const d = parseWeek(week);
    assert.ok(d, `week ${i} onleesbaar: ${week}`);
    assert.equal(d.getDay(), 1, `week ${i} (${week}) is geen maandag`);
    assert.equal(d.getHours(), 0, `week ${i} (${week}) staat niet op middernacht`);
  }
});

test("shiftWeek geeft een lege string bij onleesbare invoer", () => {
  assert.equal(shiftWeek("", 1), "");
  assert.equal(shiftWeek("onzin", -1), "");
});

// ---------------------------------------------------------------------------
// weekHref — de link naar een week, met behoud van de andere filters
// ---------------------------------------------------------------------------

test("weekHref zet de week in de querystring", () => {
  assert.equal(weekHref("/uren", "2026-09-07"), "/uren?week=2026-09-07");
});

test("weekHref houdt de overige filters vast", () => {
  assert.equal(
    weekHref("/verzenden", "2026-09-07", { tab: "inkoop", q: "jan" }),
    "/verzenden?week=2026-09-07&tab=inkoop&q=jan",
  );
});

test("weekHref codeert waarden die niet in een URL passen", () => {
  assert.equal(
    weekHref("/verzenden", "2026-09-07", { q: "de vries & zn" }),
    "/verzenden?week=2026-09-07&q=de+vries+%26+zn",
  );
});

test("weekHref laat lege en ontbrekende filters weg", () => {
  assert.equal(
    weekHref("/verzenden", "2026-09-07", { tab: "verkoop", q: "", voor: null, x: undefined }),
    "/verzenden?week=2026-09-07&tab=verkoop",
  );
});

test("weekHref zonder week is 'alle weken' — geen week-param", () => {
  assert.equal(weekHref("/verzenden", null), "/verzenden");
  assert.equal(weekHref("/verzenden", ""), "/verzenden");
  assert.equal(weekHref("/verzenden", null, { tab: "inkoop" }), "/verzenden?tab=inkoop");
});
