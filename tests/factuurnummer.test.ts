import assert from "node:assert/strict";
import test from "node:test";
import {
  DUPLICAAT_FACTUURNUMMER,
  effectiveNextSequence,
  parseManualInvoiceNumber,
  sequenceBaseline,
} from "../src/lib/numbering";

// ---------------------------------------------------------------------------
// De rekenkern onder "Facturen doorlopend nummeren vanaf" (Instellingen) en het
// handmatig aanpassen van een factuurnummer.
//
// Twee harde regels, want een factuurnummer is administratie:
//   1. De teller loopt NOOIT terug — een hoger bereikt nummer blijft staan.
//   2. Een nummer wordt NOOIT hergebruikt — dubbel = geweigerd.
//
// PUUR: geen database, geen datum, geen tijdzone.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// effectiveNextSequence — welk volgnummer krijgt de VOLGENDE automatische factuur
// ---------------------------------------------------------------------------

test("een lege jaarteller start op 1 als er geen startnummer is ingesteld", () => {
  assert.equal(effectiveNextSequence({ current: 0, start: 1 }), 1);
});

test("een startnummer HOGER dan de teller trekt de nummering omhoog", () => {
  assert.equal(effectiveNextSequence({ current: 0, start: 100 }), 100);
  assert.equal(effectiveNextSequence({ current: 5, start: 100 }), 100);
  assert.equal(effectiveNextSequence({ current: 99, start: 100 }), 100);
});

test("een startnummer LAGER dan de teller laat de teller gewoon doorlopen", () => {
  assert.equal(effectiveNextSequence({ current: 200, start: 100 }), 201);
  assert.equal(effectiveNextSequence({ current: 200, start: 1 }), 201);
});

test("de nummering loopt nooit terug — ook niet bij een gelijk startnummer", () => {
  // 200 is al uitgegeven; start=200 mag dat nummer niet hergebruiken.
  assert.equal(effectiveNextSequence({ current: 200, start: 200 }), 201);
  assert.equal(effectiveNextSequence({ current: 200, start: 201 }), 201);
});

test("elke stap is monotoon: het volgende nummer is altijd > de teller", () => {
  for (const current of [0, 1, 7, 42, 999, 9999]) {
    for (const start of [-10, 0, 1, 50, 1000]) {
      assert.ok(effectiveNextSequence({ current, start }) > current);
    }
  }
});

test("onzin-startnummers vallen terug op 1 in plaats van de teller te verpesten", () => {
  assert.equal(effectiveNextSequence({ current: 4, start: 0 }), 5);
  assert.equal(effectiveNextSequence({ current: 4, start: -12 }), 5);
  assert.equal(effectiveNextSequence({ current: 4, start: Number.NaN }), 5);
  assert.equal(effectiveNextSequence({ current: Number.NaN, start: 7 }), 7);
});

test("kommagetallen worden naar beneden afgerond op hele nummers", () => {
  assert.equal(effectiveNextSequence({ current: 0, start: 100.9 }), 100);
  assert.equal(effectiveNextSequence({ current: 4.7, start: 1 }), 5);
});

// ---------------------------------------------------------------------------
// sequenceBaseline — de tellerstand die vóór het ophogen minimaal nodig is
// ---------------------------------------------------------------------------

test("de tellerstand is altijd één onder het volgende nummer", () => {
  assert.equal(sequenceBaseline({ current: 0, start: 100 }), 99);
  assert.equal(sequenceBaseline({ current: 0, start: 1 }), 0);
  assert.equal(sequenceBaseline({ current: 200, start: 100 }), 200);
});

test("de tellerstand zakt nooit onder de huidige stand", () => {
  for (const current of [0, 3, 500]) {
    for (const start of [1, 2, 400, 9000]) {
      assert.ok(sequenceBaseline({ current, start }) >= current);
    }
  }
});

// ---------------------------------------------------------------------------
// parseManualInvoiceNumber — handmatig ingetypt nummer valideren
// ---------------------------------------------------------------------------

test("een gewoon nummer komt er getrimd doorheen", () => {
  assert.deepEqual(parseManualInvoiceNumber("  Q4S-2026-0007 "), {
    ok: true,
    number: "Q4S-2026-0007",
  });
});

test("dubbele spaties binnenin worden samengetrokken", () => {
  assert.deepEqual(parseManualInvoiceNumber("Q4S  2026   7"), {
    ok: true,
    number: "Q4S 2026 7",
  });
});

test("een leeg factuurnummer wordt geweigerd", () => {
  const leeg = parseManualInvoiceNumber("   ");
  assert.equal(leeg.ok, false);
  assert.match(leeg.ok ? "" : leeg.error, /verplicht/i);
  assert.equal(parseManualInvoiceNumber(undefined).ok, false);
  assert.equal(parseManualInvoiceNumber(42).ok, false);
});

test("een bestaand nummer wordt geweigerd met de Nederlandse melding", () => {
  const res = parseManualInvoiceNumber("Q4S-2026-0001", {
    taken: ["Q4S-2026-0001", "Q4S-2026-0002"],
  });
  assert.deepEqual(res, { ok: false, error: DUPLICAAT_FACTUURNUMMER });
  assert.equal(DUPLICAAT_FACTUURNUMMER, "Dit factuurnummer bestaat al.");
});

test("dubbeldetectie kijkt naar het GETRIMDE nummer", () => {
  const res = parseManualInvoiceNumber("  Q4S-2026-0001  ", { taken: ["Q4S-2026-0001"] });
  assert.equal(res.ok, false);
});

test("een nummer dat nog niet bestaat mag gewoon", () => {
  assert.deepEqual(
    parseManualInvoiceNumber("Q4S-2026-0003", { taken: ["Q4S-2026-0001", "Q4S-2026-0002"] }),
    { ok: true, number: "Q4S-2026-0003" },
  );
});

test("het eigen nummer opnieuw opslaan mag (de lijst bevat alleen ANDERE facturen)", () => {
  assert.deepEqual(parseManualInvoiceNumber("Q4S-2026-0001", { taken: [] }), {
    ok: true,
    number: "Q4S-2026-0001",
  });
});

test("een absurd lang nummer wordt geweigerd", () => {
  const res = parseManualInvoiceNumber("X".repeat(65));
  assert.equal(res.ok, false);
  assert.match(res.ok ? "" : res.error, /lang/i);
  assert.equal(parseManualInvoiceNumber("X".repeat(64)).ok, true);
});
