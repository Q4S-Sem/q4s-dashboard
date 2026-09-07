import assert from "node:assert/strict";
import test from "node:test";
import {
  BESTAANDE_URENSTAAT_NOTITIE,
  beoordeelBestaandeUrenstaat,
  type BestaandeUrenstaatInvoer,
} from "../src/lib/urenstaat-hergebruik";

// ---------------------------------------------------------------------------
// ER LAG AL EEN URENSTAAT voor deze plaatsing + week.
//
// De wizard "Week verwerken" liep hier vroeger dood: confirmInboxItem botste op
// de @@unique(placementId, weekStart) en gaf "exists" terug, waarna er niets
// gebeurde. Deze module beslist wat er dan nog mág — en dat is precies één van
// drie dingen:
//
//   1) hergebruiken   — nog niet gefactureerd: de inkoop en de verkoopfactuur
//      mogen gewoon tegen de BESTAANDE urenstaat aangehangen worden;
//   2) niets doen     — hij staat al op een verkoopfactuur; dubbel factureren is
//      het enige wat écht niet mag;
//   3) verwijderen    — dezelfde guard als deleteTimesheet (src/app/(app)/uren/
//      actions.ts): niet INVOICED, geen verkoop- én geen inkoopfactuurregel.
//
// Puur: geen Prisma, geen `new Date()`, geen I/O — de server-action en deze
// tests rekenen exact hetzelfde uit.
// ---------------------------------------------------------------------------

/** Eén bestaande urenstaat; alleen de velden die het oordeel aangaan. */
function urenstaat(over: Partial<BestaandeUrenstaatInvoer> = {}): BestaandeUrenstaatInvoer {
  return { status: "APPROVED", verkoopRegelId: null, inkoopRegelId: null, ...over };
}

// ===========================================================================
// 1) HERGEBRUIKEN — de gewone uitkomst
// ===========================================================================

test("een goedgekeurde urenstaat zonder facturen mag hergebruikt worden", () => {
  const o = beoordeelBestaandeUrenstaat(urenstaat());
  assert.equal(o.hergebruik, true);
  assert.equal(o.alGefactureerd, false);
  assert.equal(o.eerstGoedkeuren, false);
  assert.equal(o.magVerwijderen, true);
  assert.ok(o.reden.length > 0);
});

test("de status wordt hoofdletter-ongevoelig en zonder spaties gelezen", () => {
  const o = beoordeelBestaandeUrenstaat(urenstaat({ status: "  approved " }));
  assert.equal(o.hergebruik, true);
  assert.equal(o.eerstGoedkeuren, false);
});

// ===========================================================================
// 2) AL GEFACTUREERD — nooit dubbel
// ===========================================================================

test("status INVOICED: niet hergebruiken en niet verwijderen", () => {
  const o = beoordeelBestaandeUrenstaat(urenstaat({ status: "INVOICED" }));
  assert.equal(o.alGefactureerd, true);
  assert.equal(o.hergebruik, false);
  assert.equal(o.magVerwijderen, false);
});

test("een verkoopfactuurregel telt óók als gefactureerd, wat de status ook zegt", () => {
  const o = beoordeelBestaandeUrenstaat(urenstaat({ verkoopRegelId: "line1" }));
  assert.equal(o.alGefactureerd, true);
  assert.equal(o.hergebruik, false);
  assert.equal(o.magVerwijderen, false);
});

test("een lege verkoopregel-id telt niet als factuur", () => {
  const o = beoordeelBestaandeUrenstaat(urenstaat({ verkoopRegelId: "   " }));
  assert.equal(o.alGefactureerd, false);
  assert.equal(o.hergebruik, true);
});

// ===========================================================================
// 3) NOG NIET GOEDGEKEURD — hergebruiken mag, maar de verkoop komt er niet uit
// ===========================================================================

test("een concept-urenstaat moet eerst goedgekeurd worden", () => {
  for (const status of ["DRAFT", "SUBMITTED"]) {
    const o = beoordeelBestaandeUrenstaat(urenstaat({ status }));
    assert.equal(o.eerstGoedkeuren, true, status);
    assert.equal(o.alGefactureerd, false, status);
    assert.equal(o.magVerwijderen, true, status);
  }
});

test("een onbekende of ontbrekende status geldt als 'nog niet goedgekeurd'", () => {
  for (const status of ["", null, undefined, "ONZIN"]) {
    const o = beoordeelBestaandeUrenstaat(urenstaat({ status }));
    assert.equal(o.eerstGoedkeuren, true, String(status));
    assert.equal(o.alGefactureerd, false, String(status));
  }
});

// ===========================================================================
// 4) VERWIJDEREN — exact de guard van deleteTimesheet
// ===========================================================================

test("met een inkoopfactuurregel mag hij niet verwijderd worden", () => {
  const o = beoordeelBestaandeUrenstaat(urenstaat({ inkoopRegelId: "p1" }));
  // Hergebruiken mag nog wel: er is nog niets naar de klant gefactureerd.
  assert.equal(o.hergebruik, true);
  assert.equal(o.magVerwijderen, false);
});

test("gefactureerd of niet: verwijderen kan alleen als er geen enkele regel aan hangt", () => {
  assert.equal(beoordeelBestaandeUrenstaat(urenstaat()).magVerwijderen, true);
  assert.equal(
    beoordeelBestaandeUrenstaat(urenstaat({ status: "INVOICED", inkoopRegelId: "p1" })).magVerwijderen,
    false,
  );
});

// ===========================================================================
// 5) DE MELDING die de eigenaar te zien krijgt
// ===========================================================================

test("de notitie bij een hergebruikte week is de vaste Nederlandse zin", () => {
  assert.equal(
    BESTAANDE_URENSTAAT_NOTITIE,
    "Er bestond al een urenstaat voor deze week; die is gebruikt.",
  );
});

test("elke uitkomst heeft zijn eigen uitleg", () => {
  const gefactureerd = beoordeelBestaandeUrenstaat(urenstaat({ status: "INVOICED" })).reden;
  const concept = beoordeelBestaandeUrenstaat(urenstaat({ status: "DRAFT" })).reden;
  const goed = beoordeelBestaandeUrenstaat(urenstaat()).reden;
  assert.notEqual(gefactureerd, concept);
  assert.notEqual(concept, goed);
  assert.notEqual(gefactureerd, goed);
});
