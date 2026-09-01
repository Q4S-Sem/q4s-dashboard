import assert from "node:assert/strict";
import test from "node:test";
import { resolveKilometers, resolveKilometersSource } from "../src/lib/kilometers";

// ---------------------------------------------------------------------------
// De km-bron-keuze: freelancers zetten hun kilometers óf op de urenstaat, óf
// alleen op hun eigen factuur. De urenstaat is leidend; staat daar niets, dan
// vallen we terug op de km van de factuur. Km hebben géén marge — ze gaan 1-op-1.
// ---------------------------------------------------------------------------

test("de urenstaat wint zodra daar km op staan", () => {
  assert.equal(resolveKilometers({ timesheetKm: 120, invoiceKm: 400 }), 120);
  assert.equal(resolveKilometersSource({ timesheetKm: 120, invoiceKm: 400 }), "timesheet");
});

test("staat er 0 of niets op de urenstaat, dan tellen de km van de factuur", () => {
  assert.equal(resolveKilometers({ timesheetKm: 0, invoiceKm: 220 }), 220);
  assert.equal(resolveKilometers({ timesheetKm: null, invoiceKm: 220 }), 220);
  assert.equal(resolveKilometers({ timesheetKm: undefined, invoiceKm: 220 }), 220);
  assert.equal(resolveKilometersSource({ timesheetKm: 0, invoiceKm: 220 }), "factuur");
  assert.equal(resolveKilometersSource({ timesheetKm: null, invoiceKm: 220 }), "factuur");
});

test("nergens km → 0, en geen bron", () => {
  assert.equal(resolveKilometers({ timesheetKm: null, invoiceKm: null }), 0);
  assert.equal(resolveKilometers({ timesheetKm: 0, invoiceKm: 0 }), 0);
  assert.equal(resolveKilometers({}), 0);
  assert.equal(resolveKilometersSource({ timesheetKm: null, invoiceKm: null }), "geen");
  assert.equal(resolveKilometersSource({}), "geen");
});

test("negatieve km worden genegeerd — die bestaan niet", () => {
  assert.equal(resolveKilometers({ timesheetKm: -50, invoiceKm: 220 }), 220);
  assert.equal(resolveKilometersSource({ timesheetKm: -50, invoiceKm: 220 }), "factuur");
  assert.equal(resolveKilometers({ timesheetKm: -50, invoiceKm: -220 }), 0);
  assert.equal(resolveKilometersSource({ timesheetKm: -50, invoiceKm: -220 }), "geen");
  assert.equal(resolveKilometers({ timesheetKm: 120, invoiceKm: -220 }), 120);
});

test("onzin-getallen (NaN/Infinity) tellen niet mee", () => {
  assert.equal(resolveKilometers({ timesheetKm: Number.NaN, invoiceKm: 220 }), 220);
  assert.equal(resolveKilometers({ timesheetKm: Number.POSITIVE_INFINITY, invoiceKm: 220 }), 220);
  assert.equal(resolveKilometers({ timesheetKm: Number.NaN, invoiceKm: Number.NaN }), 0);
});

test("km worden op twee decimalen afgerond (geen marge, wel nette centen)", () => {
  assert.equal(resolveKilometers({ timesheetKm: 120.567, invoiceKm: null }), 120.57);
  assert.equal(resolveKilometers({ timesheetKm: null, invoiceKm: 99.999 }), 100);
});

test("de functies zijn puur: zelfde invoer, zelfde uitkomst, invoer blijft ongemoeid", () => {
  const input = { timesheetKm: 0, invoiceKm: 220 };
  const snapshot = JSON.stringify(input);
  assert.equal(resolveKilometers(input), resolveKilometers(input));
  assert.equal(resolveKilometersSource(input), resolveKilometersSource(input));
  assert.equal(JSON.stringify(input), snapshot);
});
