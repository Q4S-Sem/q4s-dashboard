import assert from "node:assert/strict";
import test from "node:test";
import { parseConfirmInput, type ConfirmInboxRaw } from "../src/lib/inbox-confirm-input";

/** Een complete, geldige invoer; losse velden overschrijf je per test. */
function raw(patch: Partial<ConfirmInboxRaw> = {}): ConfirmInboxRaw {
  return {
    placementId: "pl_1",
    weekStart: "2026-06-01", // maandag
    kilometers: "",
    overtimeHours: "",
    hours: ["8", "8", "8", "8", "8", "", ""],
    ...patch,
  };
}

/** Kort: de fields uit een geslaagde parse, of laten klappen met de foutcode. */
function fieldsOf(input: ConfirmInboxRaw) {
  const parsed = parseConfirmInput(input);
  assert.equal(parsed.ok, true, `verwacht ok, kreeg ${parsed.ok ? "" : parsed.error}`);
  assert.ok(parsed.ok);
  return parsed.fields;
}

test("zonder plaatsing kan er niets bevestigd worden", () => {
  assert.deepEqual(parseConfirmInput(raw({ placementId: "" })), { ok: false, error: "match" });
  assert.deepEqual(parseConfirmInput(raw({ placementId: null })), { ok: false, error: "match" });
  assert.deepEqual(parseConfirmInput(raw({ placementId: "   " })), { ok: false, error: "match" });
});

test("zonder week kan er niets bevestigd worden", () => {
  assert.deepEqual(parseConfirmInput(raw({ weekStart: "" })), { ok: false, error: "week" });
  assert.deepEqual(parseConfirmInput(raw({ weekStart: undefined })), { ok: false, error: "week" });
});

test("een onleesbare weekdatum is óók een weekfout", () => {
  assert.deepEqual(parseConfirmInput(raw({ weekStart: "onzin" })), { ok: false, error: "week" });
});

test("de week wordt altijd naar de maandag van die ISO-week getrokken", () => {
  // Donderdag 2026-06-04 hoort bij de week van maandag 2026-06-01.
  const fields = fieldsOf(raw({ weekStart: "2026-06-04" }));
  assert.equal(fields.monday.getTime(), new Date("2026-06-01T00:00:00").getTime());
});

test("zonder uren valt er niets goed te keuren", () => {
  assert.deepEqual(parseConfirmInput(raw({ hours: ["", "", "", "", "", "", ""] })), {
    ok: false,
    error: "hours",
  });
  assert.deepEqual(parseConfirmInput(raw({ hours: [] })), { ok: false, error: "hours" });
  // 0 en negatieve uren tellen niet als een gewerkte dag.
  assert.deepEqual(parseConfirmInput(raw({ hours: ["0", "-4", "onzin", null, undefined, "", ""] })), {
    ok: false,
    error: "hours",
  });
});

test("elke dag met uren wordt een dagregel op de juiste datum", () => {
  const fields = fieldsOf(raw({ hours: ["8", "", "7,5", "", "", "4", ""] }));
  assert.deepEqual(fields.entries, [
    { date: new Date("2026-06-01T00:00:00"), hours: 8 },
    { date: new Date("2026-06-03T00:00:00"), hours: 7.5 },
    { date: new Date("2026-06-06T00:00:00"), hours: 4 },
  ]);
  assert.equal(fields.totalHours, 19.5);
});

test("uren mogen ook als getal binnenkomen (batch vanuit de urencontrole)", () => {
  const fields = fieldsOf(raw({ hours: [8, "", 8, "", "", "", ""] }));
  assert.equal(fields.entries.length, 2);
  assert.equal(fields.totalHours, 16);
});

test("meer dan zeven dagen worden genegeerd — een week heeft er zeven", () => {
  const fields = fieldsOf(raw({ hours: ["8", "8", "8", "8", "8", "8", "8", "8", "8"] }));
  assert.equal(fields.entries.length, 7);
  assert.equal(fields.totalHours, 56);
});

test("het weektotaal wordt op twee decimalen afgerond", () => {
  const fields = fieldsOf(raw({ hours: ["7,33", "7,33", "7,33", "", "", "", ""] }));
  assert.equal(fields.totalHours, 21.99);
});

test("kilometers en overuren: leeg of nul wordt null", () => {
  const fields = fieldsOf(raw({ kilometers: "", overtimeHours: "0" }));
  assert.equal(fields.kilometers, null);
  assert.equal(fields.overtimeHours, null);
});

test("kilometers en overuren worden met komma of punt gelezen", () => {
  const fields = fieldsOf(raw({ kilometers: "120,5", overtimeHours: 2.5 }));
  assert.equal(fields.kilometers, 120.5);
  assert.equal(fields.overtimeHours, 2.5);
});

test("de plaatsing komt getrimd terug", () => {
  assert.equal(fieldsOf(raw({ placementId: " pl_9 " })).placementId, "pl_9");
});

test("de functie is puur: zelfde invoer, zelfde uitkomst en de invoer blijft ongemoeid", () => {
  const input = raw({ hours: ["8", "8", "", "", "", "", ""] });
  const snapshot = JSON.stringify(input);
  const first = parseConfirmInput(input);
  const second = parseConfirmInput(input);

  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(input), snapshot);
});
