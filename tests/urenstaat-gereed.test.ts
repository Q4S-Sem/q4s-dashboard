import assert from "node:assert/strict";
import test from "node:test";
import {
  bouwGereedPerPlaatsing,
  gereedMelding,
  gereedeUrenstaat,
  gereedeUrenstaatVanPlaatsingen,
  verwerkteWekenPerPlaatsing,
  type GereedeStaatInvoer,
} from "../src/lib/urenstaat-gereed";

// ---------------------------------------------------------------------------
// "ER STAAT AL EEN URENSTAAT GEREED" — vóórdat er iets verwerkt wordt.
//
// De wizard "Week verwerken" merkte pas bij het akkoord dat er al een urenstaat
// voor deze plaatsing + week lag (de @@unique sloeg toe). Deze module maakt dat
// van tevoren zichtbaar: de server laadt de goedgekeurde/gefactureerde
// urenstaten en dit is de opzoeklijst waarmee het scherm per persoon-week kan
// zeggen "die is al gereed — hier is hij" in plaats van hem nog eens te doen.
//
// PUUR, net als src/lib/wizard-weekfilter.ts: geen Prisma, geen `new Date()`,
// geen I/O. De week wordt hier alleen AFGELEZEN (weekSlotVanDatum, dus de
// gewerkte dagen zijn leidend) — nooit zelf bepaald.
// ---------------------------------------------------------------------------

/** Eén al vastgelegde urenstaat, zoals de server-pagina hem aanlevert. */
function staat(over: Partial<GereedeStaatInvoer> = {}): GereedeStaatInvoer {
  return { id: "ts1", placementId: "pl1", weekStart: "2026-08-24", ...over };
}

// ===========================================================================
// 1) De opzoeklijst bouwen
// ===========================================================================

test("elke urenstaat komt onder zijn plaatsing en zijn weeksleutel te staan", () => {
  const gereed = bouwGereedPerPlaatsing([staat()]);
  assert.deepEqual(gereed, {
    pl1: { "2026-W35": { id: "ts1", key: "2026-W35", isoWeek: 35, year: 2026 } },
  });
});

test("een dag midden in de week telt gewoon voor die hele week", () => {
  // Donderdag 27-08-2026 hoort bij de week van maandag 24-08 = ISO-week 35.
  const gereed = bouwGereedPerPlaatsing([staat({ weekStart: "2026-08-27" })]);
  assert.equal(gereedeUrenstaat(gereed, "pl1", "2026-W35")?.id, "ts1");
});

test("een Date wordt net zo gelezen als een datumtekst", () => {
  const gereed = bouwGereedPerPlaatsing([staat({ weekStart: new Date(2026, 7, 24) })]);
  assert.equal(gereedeUrenstaat(gereed, "pl1", "2026-W35")?.id, "ts1");
});

test("meerdere plaatsingen en weken staan los van elkaar", () => {
  const gereed = bouwGereedPerPlaatsing([
    staat({ id: "a", placementId: "pl1", weekStart: "2026-08-24" }),
    staat({ id: "b", placementId: "pl1", weekStart: "2026-08-31" }),
    staat({ id: "c", placementId: "pl2", weekStart: "2026-08-24" }),
  ]);
  assert.equal(gereedeUrenstaat(gereed, "pl1", "2026-W35")?.id, "a");
  assert.equal(gereedeUrenstaat(gereed, "pl1", "2026-W36")?.id, "b");
  assert.equal(gereedeUrenstaat(gereed, "pl2", "2026-W35")?.id, "c");
  assert.equal(gereedeUrenstaat(gereed, "pl2", "2026-W36"), null);
});

test("staten zonder leesbare week, zonder plaatsing of zonder id tellen niet mee", () => {
  const gereed = bouwGereedPerPlaatsing([
    staat({ id: "geenweek", weekStart: null }),
    staat({ id: "onleesbaar", weekStart: "geen datum" }),
    staat({ id: "geenplaatsing", placementId: "  " }),
    staat({ id: "  ", placementId: "pl9" }),
  ]);
  assert.deepEqual(gereed, {});
});

test("een lege of ontbrekende lijst geeft een lege opzoeklijst", () => {
  assert.deepEqual(bouwGereedPerPlaatsing([]), {});
  assert.deepEqual(bouwGereedPerPlaatsing(null), {});
  assert.deepEqual(bouwGereedPerPlaatsing(undefined), {});
});

test("bij twee staten op dezelfde plaatsing + week blijft de eerste staan", () => {
  // Kan door de @@unique(placementId, weekStart) niet voorkomen; als het tóch
  // gebeurt kiezen we deterministisch, zodat het scherm niet wisselt.
  const gereed = bouwGereedPerPlaatsing([staat({ id: "eerste" }), staat({ id: "tweede" })]);
  assert.equal(gereedeUrenstaat(gereed, "pl1", "2026-W35")?.id, "eerste");
});

// ===========================================================================
// 2) Opzoeken — per plaatsing en over meerdere plaatsingen
// ===========================================================================

test("zonder plaatsing of zonder week valt er niets op te zoeken", () => {
  const gereed = bouwGereedPerPlaatsing([staat()]);
  assert.equal(gereedeUrenstaat(gereed, "", "2026-W35"), null);
  assert.equal(gereedeUrenstaat(gereed, null, "2026-W35"), null);
  assert.equal(gereedeUrenstaat(gereed, "pl1", ""), null);
  assert.equal(gereedeUrenstaat(gereed, "pl1", null), null);
  assert.equal(gereedeUrenstaat(null, "pl1", "2026-W35"), null);
});

test("over meerdere plaatsingen wint de eerste met een gereedstaande urenstaat", () => {
  const gereed = bouwGereedPerPlaatsing([staat({ id: "b", placementId: "pl2" })]);
  assert.equal(gereedeUrenstaatVanPlaatsingen(gereed, ["pl1", "pl2"], "2026-W35")?.id, "b");
  assert.equal(gereedeUrenstaatVanPlaatsingen(gereed, ["pl1"], "2026-W35"), null);
  assert.equal(gereedeUrenstaatVanPlaatsingen(gereed, [], "2026-W35"), null);
  assert.equal(gereedeUrenstaatVanPlaatsingen(gereed, null, "2026-W35"), null);
});

// ===========================================================================
// 3) Dezelfde lijst, plat: welke weken zijn er per plaatsing verwerkt?
// ===========================================================================

test("de weekstrook krijgt per plaatsing zijn verwerkte weeksleutels", () => {
  const gereed = bouwGereedPerPlaatsing([
    staat({ id: "b", weekStart: "2026-08-31" }),
    staat({ id: "a", weekStart: "2026-08-24" }),
    staat({ id: "c", placementId: "pl2", weekStart: "2026-08-24" }),
  ]);
  assert.deepEqual(verwerkteWekenPerPlaatsing(gereed), {
    pl1: ["2026-W35", "2026-W36"],
    pl2: ["2026-W35"],
  });
});

test("een lege opzoeklijst geeft een lege weekstrook", () => {
  assert.deepEqual(verwerkteWekenPerPlaatsing({}), {});
  assert.deepEqual(verwerkteWekenPerPlaatsing(null), {});
});

// ===========================================================================
// 4) De melding die de eigenaar te zien krijgt
// ===========================================================================

test("de melding noemt de persoon en het weeknummer", () => {
  const gereed = bouwGereedPerPlaatsing([staat()]);
  assert.equal(
    gereedMelding("Jan Jansen", gereedeUrenstaat(gereed, "pl1", "2026-W35")),
    "Er staat al een urenstaat gereed voor Jan Jansen — week 35.",
  );
});

test("een kaal weeknummer mag ook", () => {
  assert.equal(
    gereedMelding("Jan Jansen", 35),
    "Er staat al een urenstaat gereed voor Jan Jansen — week 35.",
  );
});

test("zonder naam blijft de melding gewoon Nederlands", () => {
  assert.equal(
    gereedMelding("  ", 35),
    "Er staat al een urenstaat gereed voor deze medewerker — week 35.",
  );
  assert.equal(
    gereedMelding(null, 35),
    "Er staat al een urenstaat gereed voor deze medewerker — week 35.",
  );
});

test("zonder week blijft het weeknummer weg in plaats van 'week null'", () => {
  assert.equal(gereedMelding("Jan Jansen", null), "Er staat al een urenstaat gereed voor Jan Jansen.");
});
