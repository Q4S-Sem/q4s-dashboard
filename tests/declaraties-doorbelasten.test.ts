import { test } from "node:test";
import assert from "node:assert/strict";
import { bonExBtw, declaratieRegel } from "../src/lib/declaraties-doorbelasten";

test("declaratieRegel: ex btw doorbelasten, week van de bon", () => {
  const b = { id: "e1", date: new Date("2026-09-23T00:00:00"), createdAt: new Date(), vendor: "Shell", description: "Parkeren", amount: 12.1, vatAmount: 2.1 };
  const r = declaratieRegel(b, "Jordy Balder");
  assert.equal(r.amount, 10);
  assert.equal(r.unitPrice, 10);
  assert.equal(r.quantity, 1);
  assert.equal(r.weekNumber, 39);
  assert.equal(r.lineKind, "EXPENSE");
  assert.equal(r.description, "Expenses Jordy Balder: Shell — Parkeren");
  assert.equal(bonExBtw({ amount: 50, vatAmount: null }), 50);
});
