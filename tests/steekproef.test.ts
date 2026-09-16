import { test } from "node:test";
import assert from "node:assert/strict";
import { matchSalesInvoices, steekproefChecklist } from "../src/lib/steekproef";

const rec = (over: Record<string, unknown> = {}) => ({
  id: "r1",
  issueDate: new Date("2026-06-05"),
  periodStart: new Date("2026-05-25"),
  periodEnd: new Date("2026-05-31"),
  ...over,
});

const sales = (id: string, weeks: string[], over: Record<string, unknown> = {}) => ({
  id,
  issueDate: new Date("2026-06-10"),
  weekStarts: weeks.map((w) => new Date(w)),
  ...over,
});

test("matchSalesInvoices picks sales invoices whose timesheet weeks overlap the purchase period", () => {
  const hit = sales("s1", ["2026-05-25"]);
  const miss = sales("s2", ["2026-03-02"]);
  const out = matchSalesInvoices(rec(), [hit, miss]);
  assert.deepEqual(out.map((s) => s.id), ["s1"]);
});

test("matchSalesInvoices falls back to issue-date window when the purchase invoice has no period", () => {
  const near = sales("s1", [], { issueDate: new Date("2026-06-20") });
  const far = sales("s2", [], { issueDate: new Date("2025-01-01") });
  const out = matchSalesInvoices(rec({ periodStart: null, periodEnd: null }), [near, far]);
  assert.deepEqual(out.map((s) => s.id), ["s1"]);
});

test("steekproefChecklist reports which of the seven stukken are present", () => {
  const check = steekproefChecklist({
    contractDocs: 1,
    kvkDocs: 0,
    idDocs: 2,
    purchaseFile: true,
    paymentDocs: 0,
    salesMatches: 1,
  });
  const byKey = Object.fromEntries(check.map((c) => [c.key, c.ok]));
  assert.equal(byKey.contract, true);
  assert.equal(byKey.kvk, false);
  assert.equal(byKey.id, true);
  assert.equal(byKey.inkoopfactuur, true);
  assert.equal(byKey.betaalbewijs, false);
  assert.equal(byKey.verkoopfactuur, true);
  // Compleet = alles aanwezig
  assert.equal(check.every((c) => c.ok), false);
});
