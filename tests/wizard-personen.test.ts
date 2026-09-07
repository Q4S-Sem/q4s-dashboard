import assert from "node:assert/strict";
import test from "node:test";
import {
  bouwPersoonRijen,
  filterPersonen,
  laatsteVerwerktLabel,
  laatsteVerwerkteWeek,
  openstaandLabel,
  type PlaatsingBasis,
  type WeekstaatBasis,
} from "../src/lib/wizard-personen";
import { recenteWeken, weekKey } from "../src/lib/week-koppeling";

// ---------------------------------------------------------------------------
// De PERSOON-EERST-ingang van de wizard "Week verwerken": één kaart per persoon,
// met daaronder zijn plaatsing(en) en zijn openstaande weken.
//
// De harde eis van de eigenaar: dezelfde persoon mag NOOIT twee keer in de lijst
// staan. Meerdere openstaande weken = meerdere WEKEN onder één persoon, en
// meerdere plaatsingen = meerdere REGELS onder diezelfde persoon.
// ---------------------------------------------------------------------------

/** Vijf weken t/m de week van maandag 07-09-2026 (oudste eerst). */
const WEKEN = recenteWeken(new Date("2026-09-07T00:00:00"), 5);
const sleutel = (i: number) => WEKEN[i].key;

function plaatsing(
  id: string,
  consultantId: string,
  consultantNaam: string,
  klantNaam: string | null,
  functie = "QA-inspecteur",
  costRate = 77,
  chargeRate = 92,
): PlaatsingBasis {
  return {
    id,
    consultantId,
    consultantNaam,
    klantNaam,
    functie,
    config: { costRate, chargeRate },
  };
}

function weekstaat(
  id: string,
  consultantId: string | null,
  naam: string,
  placementId = "",
): WeekstaatBasis {
  return { id, consultantId, naam, placementId };
}

// ===========================================================================
// 1) GROEPEREN — één rij per persoon
// ===========================================================================

test("groeperen: drie plaatsingen en twee openstaande weken van één man = één rij", () => {
  const plaatsingen = [
    plaatsing("p1", "c1", "Jan Jansen", "Shell"),
    plaatsing("p2", "c1", "Jan Jansen", "Tata Steel"),
    plaatsing("p3", "c1", "Jan Jansen", "Vopak"),
  ];
  const weekstaten = [
    weekstaat("i1", "c1", "Jan Jansen", "p1"),
    weekstaat("i2", "c1", "Jan Jansen", "p1"),
  ];

  const { personen, ongekoppeld } = bouwPersoonRijen({ plaatsingen, weekstaten });

  assert.equal(personen.length, 1);
  assert.equal(personen[0].consultantId, "c1");
  assert.equal(personen[0].naam, "Jan Jansen");
  assert.equal(personen[0].plaatsingen.length, 3);
  assert.equal(personen[0].openstaand.length, 2);
  assert.deepEqual(ongekoppeld, []);
});

test("groeperen: klantnamen ontdubbeld, in de volgorde van de plaatsingen", () => {
  const plaatsingen = [
    plaatsing("p1", "c1", "Jan Jansen", "Shell"),
    plaatsing("p2", "c1", "Jan Jansen", "Shell"),
    plaatsing("p3", "c1", "Jan Jansen", null),
    plaatsing("p4", "c1", "Jan Jansen", "Vopak"),
  ];

  const { personen } = bouwPersoonRijen({ plaatsingen });

  assert.deepEqual(personen[0].klanten, ["Shell", "Vopak"]);
});

test("groeperen: de weken hangen aan de plaatsing waar ze op gematcht zijn", () => {
  const plaatsingen = [
    plaatsing("p1", "c1", "Jan Jansen", "Shell"),
    plaatsing("p2", "c1", "Jan Jansen", "Vopak"),
  ];
  const weekstaten = [
    weekstaat("i1", "c1", "Jan Jansen", "p1"),
    weekstaat("i2", "c1", "Jan Jansen", "p1"),
    weekstaat("i3", "c1", "Jan Jansen", "p2"),
    // Nog geen plaatsing gematcht: telt wél bij de persoon, bij geen plaatsing.
    weekstaat("i4", "c1", "Jan Jansen", ""),
  ];

  const { personen } = bouwPersoonRijen({ plaatsingen, weekstaten });

  assert.equal(personen[0].openstaand.length, 4);
  assert.equal(personen[0].plaatsingen[0].openstaand, 2);
  assert.equal(personen[0].plaatsingen[1].openstaand, 1);
});

test("groeperen: een week zonder naam-match volgt de plaatsing waar hij aan hangt", () => {
  const plaatsingen = [plaatsing("p1", "c1", "Jan Jansen", "Shell")];
  const weekstaten = [weekstaat("i1", null, "urenstaat-week-34.pdf", "p1")];

  const { personen, ongekoppeld } = bouwPersoonRijen({ plaatsingen, weekstaten });

  assert.deepEqual(ongekoppeld, []);
  assert.equal(personen.length, 1);
  assert.equal(personen[0].openstaand.length, 1);
  assert.equal(personen[0].plaatsingen[0].openstaand, 1);
});

test("groeperen: zonder persoon én zonder bekende plaatsing blijft de week ongekoppeld", () => {
  const plaatsingen = [plaatsing("p1", "c1", "Jan Jansen", "Shell")];
  const weekstaten = [
    weekstaat("i1", null, "scan-0042.pdf", ""),
    // Verwijst naar een plaatsing die niet (meer) actief is: ook ongekoppeld.
    weekstaat("i2", null, "scan-0043.pdf", "p-oud"),
  ];

  const { personen, ongekoppeld } = bouwPersoonRijen({ plaatsingen, weekstaten });

  assert.equal(personen.length, 1);
  assert.equal(personen[0].openstaand.length, 0);
  assert.deepEqual(
    ongekoppeld.map((w) => w.id),
    ["i1", "i2"],
  );
});

test("groeperen: iemand die alleen uit de inbox komt krijgt een rij zonder plaatsing", () => {
  const weekstaten = [
    weekstaat("i1", "c9", "Piet de Vries"),
    weekstaat("i2", "c9", "Piet de Vries"),
  ];

  const { personen, ongekoppeld } = bouwPersoonRijen({ plaatsingen: [], weekstaten });

  assert.equal(personen.length, 1);
  assert.equal(personen[0].consultantId, "c9");
  assert.equal(personen[0].naam, "Piet de Vries");
  assert.deepEqual(personen[0].plaatsingen, []);
  assert.equal(personen[0].openstaand.length, 2);
  assert.deepEqual(ongekoppeld, []);
});

test("groeperen: de naam van de plaatsing wint van de naam op de weekstaat", () => {
  const plaatsingen = [plaatsing("p1", "c1", "Jan Jansen", "Shell")];
  const weekstaten = [weekstaat("i1", "c1", "J. JANSEN (scan)", "p1")];

  const { personen } = bouwPersoonRijen({ plaatsingen, weekstaten });

  assert.equal(personen[0].naam, "Jan Jansen");
});

// ===========================================================================
// 2) VOLGORDE — wie moet er als eerste verwerkt worden?
// ===========================================================================

test("volgorde: wie de meeste weken open heeft staat bovenaan, daarna op naam", () => {
  const plaatsingen = [
    plaatsing("p1", "c1", "Zwaan, Kees", "Shell"),
    plaatsing("p2", "c2", "Aalders, Bram", "Vopak"),
    plaatsing("p3", "c3", "Bakker, Dirk", "Tata Steel"),
  ];
  const weekstaten = [
    weekstaat("i1", "c3", "Bakker, Dirk", "p3"),
    weekstaat("i2", "c3", "Bakker, Dirk", "p3"),
    weekstaat("i3", "c1", "Zwaan, Kees", "p1"),
  ];

  const { personen } = bouwPersoonRijen({ plaatsingen, weekstaten });

  assert.deepEqual(
    personen.map((p) => p.naam),
    ["Bakker, Dirk", "Zwaan, Kees", "Aalders, Bram"],
  );
});

test("volgorde: de meegegeven lijsten worden niet omgegooid", () => {
  const plaatsingen = [
    plaatsing("p1", "c1", "Zwaan, Kees", "Shell"),
    plaatsing("p2", "c2", "Aalders, Bram", "Vopak"),
  ];
  const weekstaten = [weekstaat("i1", "c2", "Aalders, Bram", "p2")];

  bouwPersoonRijen({ plaatsingen, weekstaten });

  assert.deepEqual(
    plaatsingen.map((p) => p.id),
    ["p1", "p2"],
  );
  assert.deepEqual(
    weekstaten.map((w) => w.id),
    ["i1"],
  );
});

// ===========================================================================
// 3) LAATST VERWERKTE WEEK
// ===========================================================================

test("laatst verwerkt: de meest recente week uit de strook wint", () => {
  const week = laatsteVerwerkteWeek(WEKEN, [sleutel(1), sleutel(3), sleutel(0)]);
  assert.equal(week?.key, sleutel(3));
});

test("laatst verwerkt: niets verwerkt of een onbekende sleutel → null", () => {
  assert.equal(laatsteVerwerkteWeek(WEKEN, []), null);
  assert.equal(laatsteVerwerkteWeek(WEKEN, ["1999-W01"]), null);
  assert.equal(laatsteVerwerkteWeek([], [sleutel(0)]), null);
});

test("laatst verwerkt: per persoon over al zijn plaatsingen heen", () => {
  const plaatsingen = [
    plaatsing("p1", "c1", "Jan Jansen", "Shell"),
    plaatsing("p2", "c1", "Jan Jansen", "Vopak"),
  ];

  const { personen } = bouwPersoonRijen({
    plaatsingen,
    weekstrook: {
      weken: WEKEN,
      verwerktPerPlaatsing: { p1: [sleutel(0)], p2: [sleutel(2)] },
    },
  });

  assert.equal(personen[0].laatsteVerwerkteWeek?.key, sleutel(2));
  assert.equal(personen[0].plaatsingen[0].laatsteVerwerkteWeek?.key, sleutel(0));
  assert.equal(personen[0].plaatsingen[1].laatsteVerwerkteWeek?.key, sleutel(2));
});

test("laatst verwerkt: zonder weekstrook blijft alles netjes leeg", () => {
  const plaatsingen = [plaatsing("p1", "c1", "Jan Jansen", "Shell")];

  const { personen } = bouwPersoonRijen({ plaatsingen });

  assert.equal(personen[0].laatsteVerwerkteWeek, null);
  assert.equal(personen[0].plaatsingen[0].laatsteVerwerkteWeek, null);
});

// ===========================================================================
// 4) ZOEKEN — op naam of klant
// ===========================================================================

const ZOEKLIJST = bouwPersoonRijen({
  plaatsingen: [
    plaatsing("p1", "c1", "Jan Jansen", "Shell", "QA-inspecteur"),
    plaatsing("p2", "c2", "Sören Bruggé", "Tata Steel", "Lasser"),
    plaatsing("p3", "c3", "Piet de Vries", "Vopak", "NDO-technicus"),
  ],
}).personen;

test("zoeken: lege term geeft iedereen terug", () => {
  assert.equal(filterPersonen(ZOEKLIJST, "").length, 3);
  assert.equal(filterPersonen(ZOEKLIJST, "   ").length, 3);
  assert.equal(filterPersonen(ZOEKLIJST, null).length, 3);
});

test("zoeken: op naam, hoofdletterongevoelig", () => {
  assert.deepEqual(
    filterPersonen(ZOEKLIJST, "JANSEN").map((p) => p.consultantId),
    ["c1"],
  );
});

test("zoeken: op klantnaam en op functie", () => {
  assert.deepEqual(
    filterPersonen(ZOEKLIJST, "vopak").map((p) => p.consultantId),
    ["c3"],
  );
  assert.deepEqual(
    filterPersonen(ZOEKLIJST, "lasser").map((p) => p.consultantId),
    ["c2"],
  );
});

test("zoeken: accenten doen niet mee — 'soren brugge' vindt 'Sören Bruggé'", () => {
  assert.deepEqual(
    filterPersonen(ZOEKLIJST, "soren brugge").map((p) => p.consultantId),
    ["c2"],
  );
});

test("zoeken: alle losse woorden moeten kloppen (naam én klant)", () => {
  assert.deepEqual(
    filterPersonen(ZOEKLIJST, "jan shell").map((p) => p.consultantId),
    ["c1"],
  );
  assert.deepEqual(filterPersonen(ZOEKLIJST, "jan vopak"), []);
});

test("zoeken: niets gevonden = lege lijst, geen halve treffers", () => {
  assert.deepEqual(filterPersonen(ZOEKLIJST, "zzzz"), []);
});

// ===========================================================================
// 5) LABELS — wat er op de kaart komt te staan
// ===========================================================================

test("label: openstaande weken in gewoon Nederlands, enkelvoud en meervoud", () => {
  assert.equal(openstaandLabel(0), "geen open weken");
  assert.equal(openstaandLabel(1), "1 week te verwerken");
  assert.equal(openstaandLabel(2), "2 weken te verwerken");
});

test("label: onzin-aantallen worden nooit een rare tekst", () => {
  assert.equal(openstaandLabel(-3), "geen open weken");
  assert.equal(openstaandLabel(Number.NaN), "geen open weken");
});

test("label: laatst verwerkte week, of eerlijk 'nog niets verwerkt'", () => {
  assert.equal(laatsteVerwerktLabel(null), "nog niets verwerkt");
  assert.equal(
    laatsteVerwerktLabel(WEKEN[4]),
    `laatst verwerkt: week ${WEKEN[4].isoWeek}`,
  );
});

test("sleutels: de strook-sleutel blijft die van week-koppeling", () => {
  // Vangnet: bouwPersoonRijen mag nooit zijn eigen sleutel gaan verzinnen.
  assert.equal(WEKEN[0].key, weekKey({ isoWeek: WEKEN[0].isoWeek, year: WEKEN[0].year }));
});
