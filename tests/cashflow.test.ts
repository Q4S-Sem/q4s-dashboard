import { test } from "node:test";
import assert from "node:assert/strict";
import { cashflowPrognose, herinneringAanDeBeurt } from "../src/lib/cashflow";

const now = new Date(2026, 9, 7, 12); // woensdag 7 okt 2026
const d = (m: number, day: number) => new Date(2026, m, day);

test("herinnering: alleen verzonden + te laat, met 7 dagen tussenruimte", () => {
  assert.equal(herinneringAanDeBeurt({ status: "SENT", dueDate: d(9, 6), reminderSentAt: null }, now), true);
  assert.equal(herinneringAanDeBeurt({ status: "SENT", dueDate: d(9, 8), reminderSentAt: null }, now), false);
  assert.equal(herinneringAanDeBeurt({ status: "PAID", dueDate: d(8, 1), reminderSentAt: null }, now), false);
  assert.equal(herinneringAanDeBeurt({ status: "SENT", dueDate: d(8, 1), reminderSentAt: d(9, 3) }, now), false);
  assert.equal(herinneringAanDeBeurt({ status: "SENT", dueDate: d(8, 1), reminderSentAt: d(8, 30) }, now), true);
});

test("prognose: te laat in week 0, buiten horizon genegeerd, cumulatief saldo", () => {
  const p = cashflowPrognose(
    [
      { bedrag: 1000, datum: d(8, 1) }, // te laat → deze week
      { bedrag: 500, datum: d(9, 14) }, // volgende week
      { bedrag: 9999, datum: d(11, 31) }, // buiten 8 weken
    ],
    [{ bedrag: 300, datum: d(9, 9) }, { bedrag: 200, datum: d(9, 12) }],
    now,
  );
  assert.equal(p.length, 8);
  assert.deepEqual([p[0].in, p[0].uit, p[0].saldo], [1000, 300, 700]);
  assert.deepEqual([p[1].in, p[1].uit, p[1].saldo], [500, 200, 1000]);
  assert.equal(p[7].saldo, 1000);
});
