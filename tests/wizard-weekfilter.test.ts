import assert from "node:assert/strict";
import test from "node:test";
import { recenteWeken } from "../src/lib/week-koppeling";
import { bouwPersoonRijen, type PlaatsingBasis } from "../src/lib/wizard-personen";
import {
  bouwWeekKeuzes,
  personenVoorWeek,
  persoonWeekStatus,
  standaardWeek,
  weekKeuzeLabel,
  weekLabel,
  weekSamenvatting,
  weekStatusKleur,
  weekStatusLabel,
  weekstaatWeekKey,
  weekstatenVoorWeek,
  type WeekKeuze,
} from "../src/lib/wizard-weekfilter";

// ---------------------------------------------------------------------------
// DE WEEKFILTER van de personenkeuze in de wizard "Week verwerken".
//
// De eigenaar werkt per WEEK: hij kiest bovenaan één week en ziet dan per mens
// wat er in DIE week te doen is — open, al verwerkt, of niets ingeleverd.
//
// Alles hier is puur: geen `new Date()`, geen Prisma. "Nu" komt als parameter
// binnen (de weken van recenteWeken), zodat de server, het scherm en deze tests
// exact hetzelfde uitrekenen.
//
// De week zelf blijft de canonieke week uit de GEWERKTE DAGEN
// (canonicalWeekFromDates) — deze module leest die alleen af om op te filteren,
// hij bepaalt hem nooit zelf.
// ---------------------------------------------------------------------------

/** Vijf weken t/m de week van maandag 07-09-2026 (week 33..37, oudste eerst). */
const WEKEN = recenteWeken(new Date("2026-09-07T00:00:00"), 5);
/** WEKEN[4] = de lopende week (week 37). */
const HUIDIG = WEKEN[4].key;
const sleutel = (i: number) => WEKEN[i].key;

/** Eén openstaande weekstaat: alleen de maandag doet er hier toe. */
function staat(weekStart: string | null, placementId = "") {
  return { id: `i-${weekStart ?? "leeg"}-${placementId}`, weekStart, placementId };
}

function plaatsing(id: string, consultantId: string, naam: string): PlaatsingBasis {
  return {
    id,
    consultantId,
    consultantNaam: naam,
    klantNaam: "Shell",
    functie: "QA-inspecteur",
    config: { costRate: 77, chargeRate: 92 },
  };
}

// ===========================================================================
// 1) DE WEEK VAN EEN WEEKSTAAT
// ===========================================================================

test("weeksleutel: een dag midden in de week valt op de maandag van die ISO-week", () => {
  // Zondag 30-08-2026 hoort bij de week van maandag 24-08 = week 35.
  assert.equal(weekstaatWeekKey({ weekStart: "2026-08-30" }), sleutel(2));
  assert.equal(weekstaatWeekKey({ weekStart: "2026-08-24" }), sleutel(2));
});

test("weeksleutel: zonder of met een onleesbare datum is er geen week", () => {
  assert.equal(weekstaatWeekKey({ weekStart: "" }), null);
  assert.equal(weekstaatWeekKey({ weekStart: null }), null);
  assert.equal(weekstaatWeekKey({}), null);
  assert.equal(weekstaatWeekKey(null), null);
  assert.equal(weekstaatWeekKey({ weekStart: "geen datum" }), null);
});

// ===========================================================================
// 2) DE KIESBARE WEKEN
// ===========================================================================

test("weekkeuzes: de strook komt terug met de nieuwste week bovenaan", () => {
  const keuzes = bouwWeekKeuzes({ weken: WEKEN });

  assert.deepEqual(
    keuzes.map((k) => k.isoWeek),
    [37, 36, 35, 34, 33],
  );
  assert.equal(keuzes[0].key, HUIDIG);
});

test("weekkeuzes: per week staat erbij hoeveel er nog openstaat", () => {
  const keuzes = bouwWeekKeuzes({
    weken: WEKEN,
    weekstaten: [
      staat("2026-08-24"),
      staat("2026-08-26"), // zelfde week (woensdag)
      staat("2026-08-31"),
    ],
  });

  const perSleutel = new Map(keuzes.map((k) => [k.key, k.open]));
  assert.equal(perSleutel.get(sleutel(2)), 2);
  assert.equal(perSleutel.get(sleutel(3)), 1);
  assert.equal(perSleutel.get(sleutel(4)), 0);
});

test("weekkeuzes: een openstaande week ouder dan de strook wordt erbij gezet", () => {
  const keuzes = bouwWeekKeuzes({
    weken: WEKEN,
    // Week 30 van 2026 (maandag 20-07) valt buiten de vijf weken van de strook.
    weekstaten: [staat("2026-07-20")],
  });

  assert.equal(keuzes.length, 6);
  // Nog steeds nieuwste eerst: de oude week sluit achteraan aan.
  assert.equal(keuzes[keuzes.length - 1].isoWeek, 30);
  assert.equal(keuzes[keuzes.length - 1].open, 1);
});

test("weekkeuzes: weekstaten zonder leesbare week tellen nergens mee", () => {
  const keuzes = bouwWeekKeuzes({
    weken: WEKEN,
    weekstaten: [staat(""), staat(null), staat("onleesbaar")],
  });

  assert.equal(keuzes.length, 5);
  assert.deepEqual(
    keuzes.map((k) => k.open),
    [0, 0, 0, 0, 0],
  );
});

test("weekkeuzes: de laatste week van de strook is de lopende week", () => {
  const keuzes = bouwWeekKeuzes({ weken: WEKEN });

  assert.deepEqual(
    keuzes.filter((k) => k.huidig).map((k) => k.key),
    [HUIDIG],
  );
});

test("weekkeuzes: een expliciet meegegeven lopende week wint", () => {
  const keuzes = bouwWeekKeuzes({ weken: WEKEN, huidigeWeek: sleutel(1) });

  assert.deepEqual(
    keuzes.filter((k) => k.huidig).map((k) => k.key),
    [sleutel(1)],
  );
});

test("weekkeuzes: zonder weken en zonder weekstaten blijft de lijst leeg", () => {
  assert.deepEqual(bouwWeekKeuzes({}), []);
  assert.deepEqual(bouwWeekKeuzes({ weken: [], weekstaten: [] }), []);
});

test("weekkeuzes: de meegegeven lijsten worden niet omgegooid", () => {
  const weken = [...WEKEN];
  const weekstaten = [staat("2026-08-24"), staat("2026-07-20")];

  bouwWeekKeuzes({ weken, weekstaten });

  assert.deepEqual(
    weken.map((w) => w.key),
    WEKEN.map((w) => w.key),
  );
  assert.equal(weekstaten.length, 2);
});

// ===========================================================================
// 3) DE STANDAARDWEEK — waar begint de eigenaar?
// ===========================================================================

test("standaardweek: de meest recente week waar nog iets openstaat", () => {
  const keuzes = bouwWeekKeuzes({
    weken: WEKEN,
    weekstaten: [staat("2026-08-17"), staat("2026-08-24")],
  });

  // Week 35 (24-08) is recenter dan week 34 — en niet de lopende week 37.
  assert.equal(standaardWeek(keuzes), sleutel(2));
});

test("standaardweek: staat er niets open, dan de lopende week", () => {
  assert.equal(standaardWeek(bouwWeekKeuzes({ weken: WEKEN })), HUIDIG);
});

test("standaardweek: zonder weken is er niets te kiezen", () => {
  assert.equal(standaardWeek([]), "");
  assert.equal(standaardWeek(null), "");
});

test("standaardweek: geen open week en geen lopende week → de nieuwste", () => {
  const keuzes: WeekKeuze[] = WEKEN.map((w) => ({ ...w, open: 0, huidig: false })).reverse();
  assert.equal(standaardWeek(keuzes), sleutel(4));
});

// ===========================================================================
// 4) DE STATUS VAN ÉÉN PERSOON IN DE GEKOZEN WEEK
// ===========================================================================

const JAN = {
  plaatsingen: [{ plaatsing: { id: "p1" } }, { plaatsing: { id: "p2" } }],
  openstaand: [staat("2026-08-24", "p1")],
};

test("status: een openstaande weekstaat in die week = 'open'", () => {
  assert.equal(persoonWeekStatus(JAN, sleutel(2)), "open");
});

test("status: die week al verwerkt op één van zijn plaatsingen = 'verwerkt'", () => {
  assert.equal(
    persoonWeekStatus(JAN, sleutel(3), { p2: [sleutel(3)] }),
    "verwerkt",
  );
});

test("status: openstaand wint van verwerkt — er is nog werk te doen", () => {
  assert.equal(
    persoonWeekStatus(JAN, sleutel(2), { p1: [sleutel(2)] }),
    "open",
  );
});

test("status: niets ingeleverd en niets verwerkt = 'niets'", () => {
  assert.equal(persoonWeekStatus(JAN, sleutel(4), { p1: [sleutel(0)] }), "niets");
});

test("status: de verwerkte week van een ándere plaatsing telt niet mee", () => {
  assert.equal(persoonWeekStatus(JAN, sleutel(3), { p9: [sleutel(3)] }), "niets");
});

test("status: zonder gekozen week valt er niets te zeggen → 'niets'", () => {
  assert.equal(persoonWeekStatus(JAN, ""), "niets");
  assert.equal(persoonWeekStatus(JAN, null), "niets");
});

test("status: een lege persoon geeft nooit een fout", () => {
  assert.equal(persoonWeekStatus({}, sleutel(2)), "niets");
  assert.equal(
    persoonWeekStatus({ plaatsingen: null, openstaand: null }, sleutel(2)),
    "niets",
  );
});

// ===========================================================================
// 5) DE LIJST VOOR ÉÉN WEEK — sorteren en filteren
// ===========================================================================

/** Drie mensen: Jan (open in week 35), Bram (week 35 verwerkt), Kees (niets). */
const PERSONEN = bouwPersoonRijen({
  plaatsingen: [
    plaatsing("p1", "c1", "Jan Jansen"),
    plaatsing("p2", "c2", "Bram Aalders"),
    plaatsing("p3", "c3", "Kees Zwaan"),
  ],
  weekstaten: [
    { id: "i1", naam: "Jan Jansen", consultantId: "c1", placementId: "p1", weekStart: "2026-08-24" },
  ],
}).personen;

const VERWERKT = { p2: [sleutel(2)] };

test("weeklijst: iedereen krijgt zijn status voor de gekozen week", () => {
  const rijen = personenVoorWeek({
    personen: PERSONEN,
    week: sleutel(2),
    verwerktPerPlaatsing: VERWERKT,
  });

  const perNaam = new Map(rijen.map((r) => [r.naam, r.weekStatus]));
  assert.equal(perNaam.get("Jan Jansen"), "open");
  assert.equal(perNaam.get("Bram Aalders"), "verwerkt");
  assert.equal(perNaam.get("Kees Zwaan"), "niets");
});

test("weeklijst: te verwerken bovenaan, verwerkt onderaan", () => {
  const rijen = personenVoorWeek({
    personen: PERSONEN,
    week: sleutel(2),
    verwerktPerPlaatsing: VERWERKT,
  });

  assert.deepEqual(
    rijen.map((r) => r.naam),
    ["Jan Jansen", "Kees Zwaan", "Bram Aalders"],
  );
});

test("weeklijst: binnen dezelfde status blijft de volgorde van de lijst staan", () => {
  const rijen = personenVoorWeek({ personen: PERSONEN, week: sleutel(4) });

  // Niemand heeft iets in week 37: gewoon de volgorde van bouwPersoonRijen.
  assert.deepEqual(
    rijen.map((r) => r.naam),
    PERSONEN.map((p) => p.naam),
  );
});

test("weeklijst: het aantal openstaande weekstaten in die week staat erbij", () => {
  const rijen = personenVoorWeek({ personen: PERSONEN, week: sleutel(2) });

  assert.equal(rijen.find((r) => r.naam === "Jan Jansen")?.weekOpen, 1);
  assert.equal(rijen.find((r) => r.naam === "Kees Zwaan")?.weekOpen, 0);
});

test("weeklijst: 'alleen met open weken' laat de rest weg", () => {
  const rijen = personenVoorWeek({
    personen: PERSONEN,
    week: sleutel(2),
    verwerktPerPlaatsing: VERWERKT,
    alleenOpen: true,
  });

  assert.deepEqual(
    rijen.map((r) => r.naam),
    ["Jan Jansen"],
  );
});

test("weeklijst: zonder gekozen week blijft iedereen staan, in dezelfde volgorde", () => {
  const rijen = personenVoorWeek({ personen: PERSONEN, week: null });

  assert.deepEqual(
    rijen.map((r) => r.naam),
    PERSONEN.map((p) => p.naam),
  );
  assert.deepEqual(
    rijen.map((r) => r.weekStatus),
    ["niets", "niets", "niets"],
  );
});

test("weeklijst: de velden van de persoon blijven gewoon bestaan", () => {
  const rij = personenVoorWeek({ personen: PERSONEN, week: sleutel(2) })[0];

  assert.equal(rij.consultantId, "c1");
  assert.equal(rij.plaatsingen.length, 1);
  assert.equal(rij.zoek.includes("jansen"), true);
});

test("weeklijst: de meegegeven lijst wordt niet omgegooid", () => {
  const namen = PERSONEN.map((p) => p.naam);

  personenVoorWeek({ personen: PERSONEN, week: sleutel(2), verwerktPerPlaatsing: VERWERKT });

  assert.deepEqual(
    PERSONEN.map((p) => p.naam),
    namen,
  );
});

test("weeklijst: lege invoer geeft een lege lijst", () => {
  assert.deepEqual(personenVoorWeek({}), []);
  assert.deepEqual(personenVoorWeek({ personen: null, week: sleutel(2) }), []);
});

// ===========================================================================
// 6) DE WEKEN VAN ÉÉN PERSOON — de gekozen week vooraan in stap 1
// ===========================================================================

test("weekstaten: de gekozen week komt bovenaan, de rest blijft in volgorde", () => {
  const items = [staat("2026-08-31"), staat("2026-08-17"), staat("2026-08-24")];

  assert.deepEqual(
    weekstatenVoorWeek(items, sleutel(2)).map((i) => i.weekStart),
    ["2026-08-24", "2026-08-31", "2026-08-17"],
  );
});

test("weekstaten: meerdere staten in de gekozen week houden hun onderlinge volgorde", () => {
  const items = [staat("2026-08-31"), staat("2026-08-24", "p1"), staat("2026-08-26", "p2")];

  assert.deepEqual(
    weekstatenVoorWeek(items, sleutel(2)).map((i) => i.placementId),
    ["p1", "p2", ""],
  );
});

test("weekstaten: zonder gekozen week (of zonder treffer) verandert er niets", () => {
  const items = [staat("2026-08-31"), staat("2026-08-17")];

  assert.deepEqual(
    weekstatenVoorWeek(items, null).map((i) => i.weekStart),
    ["2026-08-31", "2026-08-17"],
  );
  assert.deepEqual(
    weekstatenVoorWeek(items, sleutel(0)).map((i) => i.weekStart),
    ["2026-08-31", "2026-08-17"],
  );
  assert.deepEqual(weekstatenVoorWeek(null, sleutel(2)), []);
});

test("weekstaten: de meegegeven lijst wordt niet omgegooid", () => {
  const items = [staat("2026-08-31"), staat("2026-08-24")];

  weekstatenVoorWeek(items, sleutel(2));

  assert.deepEqual(
    items.map((i) => i.weekStart),
    ["2026-08-31", "2026-08-24"],
  );
});

// ===========================================================================
// 7) LABELS — wat er in het scherm komt te staan
// ===========================================================================

test("samenvatting: alleen de groepen die er zijn worden genoemd", () => {
  const rijen = personenVoorWeek({
    personen: PERSONEN,
    week: sleutel(2),
    verwerktPerPlaatsing: VERWERKT,
  });

  assert.equal(weekSamenvatting(rijen), "1 te verwerken · 1 verwerkt · 1 niets ingeleverd");
});

test("samenvatting: lege groepen blijven weg, lege lijst geeft lege tekst", () => {
  assert.equal(
    weekSamenvatting(personenVoorWeek({ personen: PERSONEN, week: sleutel(4) })),
    "3 niets ingeleverd",
  );
  assert.equal(weekSamenvatting([]), "");
  assert.equal(weekSamenvatting(null), "");
});


test("label: een week heet overal 'Week 35 · 2026'", () => {
  assert.equal(weekLabel(WEKEN[2]), "Week 35 · 2026");
});

test("label: de keuzelijst vertelt erbij wat er te doen is", () => {
  const keuzes = bouwWeekKeuzes({
    weken: WEKEN,
    weekstaten: [staat("2026-08-24"), staat("2026-08-25")],
  });
  const week35 = keuzes.find((k) => k.key === sleutel(2))!;
  const week37 = keuzes.find((k) => k.key === HUIDIG)!;

  assert.equal(weekKeuzeLabel(week35), "Week 35 · 2026 · 2 open");
  assert.equal(weekKeuzeLabel(week37), "Week 37 · 2026 · deze week");
});

test("label: één openstaande week blijft enkelvoud", () => {
  const keuzes = bouwWeekKeuzes({ weken: WEKEN, weekstaten: [staat("2026-08-24")] });
  const week35 = keuzes.find((k) => k.key === sleutel(2))!;

  assert.equal(weekKeuzeLabel(week35), "Week 35 · 2026 · 1 open");
});

test("label: de status van een persoon in gewoon Nederlands", () => {
  assert.equal(weekStatusLabel("open"), "open — te verwerken");
  assert.equal(weekStatusLabel("verwerkt"), "verwerkt");
  assert.equal(weekStatusLabel("niets"), "niets ingeleverd");
});

test("label: de statuskleur past bij de badge-kleuren van het dashboard", () => {
  assert.equal(weekStatusKleur("open"), "amber");
  assert.equal(weekStatusKleur("verwerkt"), "green");
  assert.equal(weekStatusKleur("niets"), "slate");
});
