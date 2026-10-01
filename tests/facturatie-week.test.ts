import assert from "node:assert/strict";
import test from "node:test";
import { resolveWeek, weekEntityId } from "../src/lib/facturatie-week";

// ---------------------------------------------------------------------------
// De weekbepaling onder /facturatie. Twee bronnen zetten `?week=`: de bestaande
// WeekBalk doet dat met de MAANDAG ("2026-09-28") en de dossier-route met de
// WEEKSLEUTEL ("2026-W40"). Beide moeten op exact dezelfde week uitkomen,
// anders kijkt het overzicht naar een andere week dan het dossier.
//
// Alleen `resolveWeek` en `weekEntityId` worden hier getest: de rest van
// facturatie-week.ts praat met de database en hoort niet in een unit-test.
// ---------------------------------------------------------------------------

/** Donderdag 1 oktober 2026 — valt in ISO-week 40 (maandag 28-09-2026). */
const VANDAAG = new Date(2026, 9, 1);

test("een weeksleutel en een losse dag uit diezelfde week geven dezelfde uitkomst", () => {
  const viaSleutel = resolveWeek("2026-W40", VANDAAG);
  const viaDag = resolveWeek("2026-09-30", VANDAAG);
  assert.equal(viaSleutel.key, "2026-W40");
  assert.equal(viaDag.key, viaSleutel.key);
  assert.equal(viaDag.monday.getTime(), viaSleutel.monday.getTime());
});

test("de maandag, zondag en het weeknummer kloppen", () => {
  const week = resolveWeek("2026-W40", VANDAAG);
  assert.equal(week.isoWeek, 40);
  assert.equal(week.year, 2026);
  assert.equal(week.monday.getDay(), 1, "monday moet een maandag zijn");
  assert.equal(week.monday.getDate(), 28);
  assert.equal(week.monday.getMonth(), 8); // september
  assert.equal(week.sunday.getDay(), 0, "sunday moet een zondag zijn");
  assert.equal(week.sunday.getDate(), 4);
  assert.equal(week.sunday.getMonth(), 9); // oktober
  // De hele zondag hoort erbij, anders mist een query van die dag.
  assert.equal(week.sunday.getHours(), 23);
  assert.equal(week.mondayParam, "2026-09-28");
});

test("de deadline is de dinsdag 12:00 ná de gewerkte week", () => {
  const week = resolveWeek("2026-W40", VANDAAG);
  assert.equal(week.deadline.getDay(), 2);
  assert.equal(week.deadline.getDate(), 6);
  assert.equal(week.deadline.getMonth(), 9);
  assert.equal(week.deadline.getHours(), 12);
});

test("leeg, onleesbaar of onzin valt terug op de week van vandaag", () => {
  for (const waarde of ["", "   ", "onzin", "2026-W99", "2026-13-45", null, undefined]) {
    assert.equal(resolveWeek(waarde, VANDAAG).key, "2026-W40", `faalde op ${String(waarde)}`);
  }
});

test("de week rond de jaarwisseling houdt het ISO-weekjaar aan", () => {
  // 31-12-2025 valt in ISO-week 1 van 2026 (maandag 29-12-2025).
  const week = resolveWeek("2025-12-31", VANDAAG);
  assert.equal(week.key, "2026-W01");
  assert.equal(week.isoWeek, 1);
  assert.equal(week.year, 2026);
  assert.equal(week.monday.getDate(), 29);
  assert.equal(week.monday.getMonth(), 11); // december 2025
});

test("het label en bereik zijn leesbaar Nederlands", () => {
  const week = resolveWeek("2026-W40", VANDAAG);
  assert.match(week.label, /40/);
  assert.match(week.bereik, /sep/);
  assert.match(week.bereik, /okt/);
  assert.match(week.bereik, /2026/);
});

test("de aantekeningen van een week hangen aan plaatsing + week samen", () => {
  assert.equal(weekEntityId("pl-1", "2026-W40"), "pl-1:2026-W40");
  assert.notEqual(weekEntityId("pl-1", "2026-W40"), weekEntityId("pl-1", "2026-W41"));
  assert.notEqual(weekEntityId("pl-1", "2026-W40"), weekEntityId("pl-2", "2026-W40"));
});
