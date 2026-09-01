import assert from "node:assert/strict";
import test from "node:test";
import {
  GATE_HISTORY_WEEKS,
  summarizeRecentWeeks,
  type WeeklyTotal,
} from "../src/lib/timesheet-gate-history";

/** Maandag 00:00 uit "YYYY-MM-DD" — leest prettiger dan losse Date-constructors. */
const ma = (iso: string) => new Date(`${iso}T00:00:00`);

/** Een reeks opeenvolgende weken (nieuwste eerst is niet nodig — volgorde mag door elkaar). */
const week = (iso: string, hours: number): WeeklyTotal => ({ weekStart: ma(iso), hours });

test("acht weken historie is de standaard", () => {
  assert.equal(GATE_HISTORY_WEEKS, 8);
});

test("zonder weken valt er niets te middelen", () => {
  assert.deepEqual(summarizeRecentWeeks([]), { recentAvgHours: null, recentWeeks: 0 });
});

test("het gemiddelde is de som van de weektotalen gedeeld door het aantal weken", () => {
  const rows = [week("2026-06-01", 40), week("2026-06-08", 36), week("2026-06-15", 32)];
  assert.deepEqual(summarizeRecentWeeks(rows), { recentAvgHours: 36, recentWeeks: 3 });
});

test("alleen weken vóór de opgegeven week tellen mee", () => {
  const rows = [
    week("2026-06-01", 40),
    week("2026-06-08", 20),
    week("2026-06-15", 100), // de week zelf — telt niet mee
    week("2026-06-22", 100), // erna — telt niet mee
  ];
  assert.deepEqual(summarizeRecentWeeks(rows, { before: ma("2026-06-15") }), {
    recentAvgHours: 30,
    recentWeeks: 2,
  });
});

test("zonder 'before' tellen alle weken mee", () => {
  const rows = [week("2026-06-01", 40), week("2026-06-08", 20)];
  assert.equal(summarizeRecentWeeks(rows, { before: null }).recentWeeks, 2);
});

test("meerdere plaatsingen in dezelfde week worden opgeteld tot één weektotaal", () => {
  const rows = [week("2026-06-01", 24), week("2026-06-01", 16), week("2026-06-08", 40)];
  assert.deepEqual(summarizeRecentWeeks(rows), { recentAvgHours: 40, recentWeeks: 2 });
});

test("hoogstens de acht meest recente weken tellen mee", () => {
  const rows: WeeklyTotal[] = [];
  // 10 weken van 2026-04-06 t/m 2026-06-08: de twee oudste (10 u) vallen af.
  for (let i = 0; i < 10; i++) {
    const d = new Date(ma("2026-04-06"));
    d.setDate(d.getDate() + i * 7);
    rows.push({ weekStart: d, hours: i < 2 ? 10 : 40 });
  }
  assert.deepEqual(summarizeRecentWeeks(rows), { recentAvgHours: 40, recentWeeks: 8 });
});

test("de vensterlengte is instelbaar", () => {
  const rows = [week("2026-06-01", 10), week("2026-06-08", 40), week("2026-06-15", 40)];
  assert.deepEqual(summarizeRecentWeeks(rows, { limit: 2 }), {
    recentAvgHours: 40,
    recentWeeks: 2,
  });
});

test("een week zonder gewerkte uren telt gewoon mee in het gemiddelde", () => {
  const rows = [week("2026-06-01", 40), week("2026-06-08", 0)];
  assert.deepEqual(summarizeRecentWeeks(rows), { recentAvgHours: 20, recentWeeks: 2 });
});

test("onbruikbare regels worden genegeerd", () => {
  const rows: WeeklyTotal[] = [
    week("2026-06-01", 40),
    { weekStart: ma("2026-06-08"), hours: Number.NaN },
    { weekStart: ma("2026-06-15"), hours: Number.POSITIVE_INFINITY },
    { weekStart: ma("2026-06-22"), hours: -8 },
    { weekStart: new Date("onzin"), hours: 40 },
  ];
  assert.deepEqual(summarizeRecentWeeks(rows), { recentAvgHours: 40, recentWeeks: 1 });
});

test("het gemiddelde wordt op twee decimalen afgerond", () => {
  const rows = [week("2026-06-01", 40), week("2026-06-08", 39), week("2026-06-15", 38)];
  assert.deepEqual(summarizeRecentWeeks(rows), { recentAvgHours: 39, recentWeeks: 3 });
  const rows2 = [week("2026-06-01", 40), week("2026-06-08", 37), week("2026-06-15", 38)];
  assert.equal(summarizeRecentWeeks(rows2).recentAvgHours, 38.33);
});

test("de functie is puur: zelfde invoer, zelfde uitkomst en de lijst blijft ongemoeid", () => {
  const rows = [week("2026-06-08", 36), week("2026-06-01", 40)];
  const snapshot = rows.map((r) => ({ weekStart: new Date(r.weekStart), hours: r.hours }));
  const first = summarizeRecentWeeks(rows);
  const second = summarizeRecentWeeks(rows);

  assert.deepEqual(first, second);
  assert.deepEqual(rows, snapshot);
});
