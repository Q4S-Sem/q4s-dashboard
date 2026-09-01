import assert from "node:assert/strict";
import test from "node:test";
import {
  GATE_MAX_WEEKLY_HOURS,
  GATE_MIN_HISTORY_WEEKS,
  GATE_RELATIVE_FACTOR,
  evaluateTimesheetGate,
  type TimesheetGateInput,
} from "../src/lib/timesheet-auto-gate";
import { formatCurrency } from "../src/lib/utils";

/** Een schone uitlezing: alles klopt, dus deze mag automatisch door. */
const CLEAN: TimesheetGateInput = {
  confidence: "high",
  placementId: "pl-1",
  matchedPlacementCount: 1,
  totalHours: 40,
  recentAvgHours: 38,
  recentWeeks: 6,
  duplicateExists: false,
  chargeRate: 75,
  costRate: 50,
};

const gate = (patch: Partial<TimesheetGateInput> = {}, opts?: Parameters<typeof evaluateTimesheetGate>[1]) =>
  evaluateTimesheetGate({ ...CLEAN, ...patch }, opts);

test("de drempels staan vast: 60 uur, factor 1,75 en 3 weken historie", () => {
  assert.equal(GATE_MAX_WEEKLY_HOURS, 60);
  assert.equal(GATE_RELATIVE_FACTOR, 1.75);
  assert.equal(GATE_MIN_HISTORY_WEEKS, 3);
});

test("een volledig schone weekstaat wordt automatisch goedgekeurd", () => {
  assert.deepEqual(gate(), { decision: "AUTO_APPROVE", reasons: [], flags: [] });
});

// --- 1) confidence ---------------------------------------------------------

test("confidence laag blokkeert de automatische goedkeuring", () => {
  assert.deepEqual(gate({ confidence: "low" }), {
    decision: "NEEDS_REVIEW",
    reasons: ["confidence laag"],
    flags: [{ level: "error", message: "confidence laag" }],
  });
});

test("confidence gemiddeld blokkeert met een waarschuwing", () => {
  assert.deepEqual(gate({ confidence: "medium" }), {
    decision: "NEEDS_REVIEW",
    reasons: ["confidence gemiddeld — alleen 'hoog' gaat automatisch door"],
    flags: [{ level: "warn", message: "confidence gemiddeld — alleen 'hoog' gaat automatisch door" }],
  });
});

test("een ontbrekende of onbekende confidence blokkeert", () => {
  for (const value of [null, "", "   ", "onzin"]) {
    assert.deepEqual(gate({ confidence: value }), {
      decision: "NEEDS_REVIEW",
      reasons: ["confidence ontbreekt"],
      flags: [{ level: "error", message: "confidence ontbreekt" }],
    });
  }
});

test("confidence is hoofdletter-ongevoelig", () => {
  assert.equal(gate({ confidence: "HIGH" }).decision, "AUTO_APPROVE");
  assert.equal(gate({ confidence: " High " }).decision, "AUTO_APPROVE");
});

// --- 2) plaatsing ----------------------------------------------------------

test("zonder actieve plaatsing volgt handmatige controle", () => {
  assert.deepEqual(gate({ placementId: null, matchedPlacementCount: 0 }), {
    decision: "NEEDS_REVIEW",
    reasons: ["geen actieve plaatsing gevonden"],
    flags: [{ level: "error", message: "geen actieve plaatsing gevonden" }],
  });
});

test("meerdere actieve plaatsingen blokkeren, want de keuze is niet eenduidig", () => {
  assert.deepEqual(gate({ matchedPlacementCount: 3 }), {
    decision: "NEEDS_REVIEW",
    reasons: ["meerdere actieve plaatsingen gevonden (3) — kies handmatig de juiste"],
    flags: [
      { level: "error", message: "meerdere actieve plaatsingen gevonden (3) — kies handmatig de juiste" },
    ],
  });
});

test("één match maar geen gekoppelde plaatsing blokkeert", () => {
  assert.deepEqual(gate({ placementId: null, matchedPlacementCount: 1 }), {
    decision: "NEEDS_REVIEW",
    reasons: ["geen plaatsing gekoppeld aan deze weekstaat"],
    flags: [{ level: "error", message: "geen plaatsing gekoppeld aan deze weekstaat" }],
  });
});

// --- 3) absolute bandbreedte ----------------------------------------------

test("zonder uitgelezen weektotaal kan er niets automatisch door", () => {
  for (const value of [null, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.deepEqual(gate({ totalHours: value }), {
      decision: "NEEDS_REVIEW",
      reasons: ["geen weektotaal uitgelezen"],
      flags: [{ level: "error", message: "geen weektotaal uitgelezen" }],
    });
  }
});

test("meer uren dan de bandbreedte toestaat blokkeert", () => {
  assert.deepEqual(gate({ totalHours: 60.5, recentAvgHours: 58 }), {
    decision: "NEEDS_REVIEW",
    reasons: ["weektotaal 60,5 u valt buiten de bandbreedte 0–60 u"],
    flags: [{ level: "error", message: "weektotaal 60,5 u valt buiten de bandbreedte 0–60 u" }],
  });
});

test("negatieve uren vallen onder de bandbreedte en blokkeren", () => {
  assert.deepEqual(gate({ totalHours: -5, recentAvgHours: 0, recentWeeks: 0 }), {
    decision: "NEEDS_REVIEW",
    reasons: ["weektotaal -5 u valt buiten de bandbreedte 0–60 u"],
    flags: [{ level: "error", message: "weektotaal -5 u valt buiten de bandbreedte 0–60 u" }],
  });
});

test("de randen van de bandbreedte (0 en 60) vallen er nog binnen", () => {
  assert.equal(gate({ totalHours: 60, recentAvgHours: 58 }).decision, "AUTO_APPROVE");
  assert.equal(gate({ totalHours: 0, recentAvgHours: 0, recentWeeks: 6 }).decision, "AUTO_APPROVE");
});

test("de bandbreedte is instelbaar via maxWeeklyHours", () => {
  assert.equal(gate({ totalHours: 45, recentAvgHours: 44 }, { maxWeeklyHours: 40 }).decision, "NEEDS_REVIEW");
  assert.deepEqual(gate({ totalHours: 45, recentAvgHours: 44 }, { maxWeeklyHours: 40 }).reasons, [
    "weektotaal 45 u valt buiten de bandbreedte 0–40 u",
  ]);
  assert.equal(gate({ totalHours: 70, recentAvgHours: 68 }, { maxWeeklyHours: 80 }).decision, "AUTO_APPROVE");
});

// --- 4) relatieve check t.o.v. het eigen gemiddelde ------------------------

test("uren ver boven het eigen gemiddelde blokkeren met een uitleg", () => {
  assert.deepEqual(gate({ totalHours: 55, recentAvgHours: 25, recentWeeks: 6 }), {
    decision: "NEEDS_REVIEW",
    reasons: ["uren 55 u is ~2,2x hoger dan het gemiddelde van 25 u (laatste 6 weken)"],
    flags: [
      { level: "warn", message: "uren 55 u is ~2,2x hoger dan het gemiddelde van 25 u (laatste 6 weken)" },
    ],
  });
});

test("de uitleg noemt de verhouding afgerond, ook bij een ruimere bandbreedte", () => {
  assert.deepEqual(gate({ totalHours: 78, recentAvgHours: 40, recentWeeks: 8 }, { maxWeeklyHours: 80 }).reasons, [
    "uren 78 u is ~2x hoger dan het gemiddelde van 40 u (laatste 8 weken)",
  ]);
});

test("precies 1,75x het gemiddelde mag er nog door", () => {
  assert.equal(gate({ totalHours: 42, recentAvgHours: 24, recentWeeks: 4 }).decision, "AUTO_APPROVE");
  assert.equal(gate({ totalHours: 42.5, recentAvgHours: 24, recentWeeks: 4 }).decision, "NEEDS_REVIEW");
});

test("0 uren terwijl er normaal gewerkt wordt blokkeert", () => {
  assert.deepEqual(gate({ totalHours: 0, recentAvgHours: 40, recentWeeks: 5 }), {
    decision: "NEEDS_REVIEW",
    reasons: ["0 uren terwijl het gemiddelde 40 u is (laatste 5 weken)"],
    flags: [{ level: "error", message: "0 uren terwijl het gemiddelde 40 u is (laatste 5 weken)" }],
  });
});

test("met minder dan 3 weken historie slaan we de relatieve check over", () => {
  assert.equal(gate({ totalHours: 55, recentAvgHours: 10, recentWeeks: 2 }).decision, "AUTO_APPROVE");
  assert.equal(gate({ totalHours: 0, recentAvgHours: 40, recentWeeks: 2 }).decision, "AUTO_APPROVE");
  // Vanaf de derde week telt de vergelijking wel mee.
  assert.equal(gate({ totalHours: 55, recentAvgHours: 10, recentWeeks: 3 }).decision, "NEEDS_REVIEW");
});

test("zonder bruikbaar gemiddelde is er niets om mee te vergelijken", () => {
  for (const avg of [null, 0, Number.NaN]) {
    assert.deepEqual(gate({ totalHours: 55, recentAvgHours: avg, recentWeeks: 9 }), {
      decision: "AUTO_APPROVE",
      reasons: [],
      flags: [],
    });
  }
});

test("de relatieve drempel en de minimale historie zijn instelbaar", () => {
  assert.equal(
    gate({ totalHours: 50, recentAvgHours: 40, recentWeeks: 6 }, { relativeFactor: 1.1 }).decision,
    "NEEDS_REVIEW",
  );
  assert.equal(
    gate({ totalHours: 55, recentAvgHours: 10, recentWeeks: 2 }, { minHistoryWeeks: 2 }).decision,
    "NEEDS_REVIEW",
  );
});

// --- 5) dubbele weekstaat --------------------------------------------------

test("een bestaande weekstaat voor dezelfde plaatsing en week blokkeert", () => {
  assert.deepEqual(gate({ duplicateExists: true }), {
    decision: "NEEDS_REVIEW",
    reasons: ["dubbele weekstaat voor deze plaatsing en week"],
    flags: [{ level: "error", message: "dubbele weekstaat voor deze plaatsing en week" }],
  });
});

// --- 6) marge --------------------------------------------------------------

test("gelijke tarieven leveren geen positieve marge op", () => {
  const message = `marge niet positief (inkoop ${formatCurrency(75)} ≥ verkoop ${formatCurrency(75)})`;
  assert.deepEqual(gate({ costRate: 75 }), {
    decision: "NEEDS_REVIEW",
    reasons: [message],
    flags: [{ level: "error", message }],
  });
});

test("een inkooptarief boven het verkooptarief blokkeert", () => {
  const message = `marge niet positief (inkoop ${formatCurrency(90)} ≥ verkoop ${formatCurrency(75)})`;
  assert.deepEqual(gate({ costRate: 90 }).reasons, [message]);
});

test("zonder tarieven is de marge niet te bepalen", () => {
  for (const patch of [{ chargeRate: null }, { costRate: null }, { chargeRate: Number.NaN }]) {
    assert.deepEqual(gate(patch), {
      decision: "NEEDS_REVIEW",
      reasons: ["tarieven onbekend — marge niet te bepalen"],
      flags: [{ level: "error", message: "tarieven onbekend — marge niet te bepalen" }],
    });
  }
});

// --- samenloop -------------------------------------------------------------

test("alle problemen tegelijk geven alle redenen in een vaste volgorde", () => {
  const result = gate({
    confidence: "low",
    placementId: null,
    matchedPlacementCount: 0,
    totalHours: 78,
    recentAvgHours: 40,
    recentWeeks: 8,
    duplicateExists: true,
    chargeRate: 50,
    costRate: 50,
  });

  assert.equal(result.decision, "NEEDS_REVIEW");
  assert.deepEqual(result.reasons, [
    "confidence laag",
    "geen actieve plaatsing gevonden",
    "weektotaal 78 u valt buiten de bandbreedte 0–60 u",
    "uren 78 u is ~2x hoger dan het gemiddelde van 40 u (laatste 8 weken)",
    "dubbele weekstaat voor deze plaatsing en week",
    `marge niet positief (inkoop ${formatCurrency(50)} ≥ verkoop ${formatCurrency(50)})`,
  ]);
  // Elke reden hoort bij precies één vlag, zodat de UI ze samen kan tonen.
  assert.deepEqual(
    result.flags.map((f) => f.message),
    result.reasons,
  );
  assert.deepEqual(
    result.flags.map((f) => f.level),
    ["error", "error", "error", "warn", "error", "error"],
  );
});

test("de functie is puur: dezelfde invoer geeft hetzelfde resultaat en muteert niets", () => {
  const input: TimesheetGateInput = { ...CLEAN, confidence: "low", duplicateExists: true };
  const snapshot = { ...input };
  const first = evaluateTimesheetGate(input);
  const second = evaluateTimesheetGate(input);

  assert.deepEqual(first, second);
  assert.notEqual(first.reasons, second.reasons); // geen gedeelde (muteerbare) array
  assert.deepEqual(input, snapshot);
});
