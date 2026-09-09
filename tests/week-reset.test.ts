import { test } from "node:test";
import assert from "node:assert/strict";
import {
  mayDeleteConceptInvoice,
  isReceivedInvoiceResettable,
  weekResetSummary,
} from "../src/lib/week-reset-core";

test("een week zonder concept-factuur mag altijd gereset worden", () => {
  assert.equal(mayDeleteConceptInvoice(null), true);
});

test("een concept- of geannuleerde verkoopfactuur mag mee-verwijderd worden", () => {
  assert.equal(mayDeleteConceptInvoice("DRAFT"), true);
  assert.equal(mayDeleteConceptInvoice("CANCELLED"), true);
});

test("een vrijgegeven/verstuurde/betaalde verkoopfactuur blokkeert de reset", () => {
  assert.equal(mayDeleteConceptInvoice("READY"), false);
  assert.equal(mayDeleteConceptInvoice("SENT"), false);
  assert.equal(mayDeleteConceptInvoice("PAID"), false);
});

test("een betaalde ontvangen factuur wordt nooit gereset", () => {
  assert.equal(isReceivedInvoiceResettable("NEW"), true);
  assert.equal(isReceivedInvoiceResettable("APPROVED"), true);
  assert.equal(isReceivedInvoiceResettable("PAID"), false);
});

test("de samenvatting telt gereset, overgeslagen en factuurnummers netjes op", () => {
  const s = weekResetSummary([
    { weekLabel: "week 26", result: "reset", invoiceNumber: "2026-0007" },
    { weekLabel: "week 27", result: "locked", invoiceNumber: "2026-0008" },
    { weekLabel: "week 28", result: "reset", invoiceNumber: null },
  ]);
  assert.equal(s.resetCount, 2);
  assert.equal(s.lockedCount, 1);
  assert.deepEqual(s.deletedInvoiceNumbers, ["2026-0007"]);
  assert.ok(s.lockedLabels.includes("week 27"));
});
