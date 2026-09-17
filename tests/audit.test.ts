import { test } from "node:test";
import assert from "node:assert/strict";
import { auditFlag, pickNextInvoice } from "../src/lib/audit";

test("auditFlag flags creditnota's (negatief totaal)", () => {
  assert.match(auditFlag({ total: -500, subject: null, services: null, notes: null })!, /creditnota/i);
});

test("auditFlag flags trainingen/doorbelasting/inleen op tekstvelden", () => {
  assert.ok(auditFlag({ total: 100, subject: "Training VCA", services: null, notes: null }));
  assert.ok(auditFlag({ total: 100, subject: null, services: "Doorbelasting kosten", notes: null }));
  assert.ok(auditFlag({ total: 100, subject: null, services: null, notes: "inleen derden" }));
});

test("auditFlag laat een gewone factuur met rust", () => {
  assert.equal(auditFlag({ total: 4200, subject: "R. van Son", services: "QC Inspector", notes: null }), null);
});

test("pickNextInvoice picks the first invoice number after the current one", () => {
  const all = ["2025116", "2025143", "2025170", "2026020"];
  assert.equal(pickNextInvoice(all, "2025143"), "2025170");
  assert.equal(pickNextInvoice(all, "2026020"), null);
  assert.equal(pickNextInvoice(all, "onbekend"), null);
});
