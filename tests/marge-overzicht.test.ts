import assert from "node:assert/strict";
import test from "node:test";
import {
  MARGE_LABELS,
  buildMargeOverzicht,
  marginPerClient,
  marginPerFreelancer,
  overallMarginSummary,
  type MargeRegel,
} from "../src/lib/marge-overzicht";

/** Eén gefactureerde uren-regel: uren × (verkooptarief − inkooptarief) = marge. */
const REGEL: MargeRegel = {
  clientId: "kl-1",
  clientName: "Van Dijk Industrie",
  consultantId: "co-1",
  consultantName: "Rens Bakker",
  hours: 40,
  costRate: 45,
  chargeRate: 65,
};

const regel = (patch: Partial<MargeRegel> = {}): MargeRegel => ({ ...REGEL, ...patch });

/**
 * Vaste set:
 *  Van Dijk Industrie (kl-1): Rens 40u + 10u à €20/u marge, Sanne 50u à €10/u
 *    → 2 freelancers, 100u, €1.500 marge, gewogen €15/u
 *  Bakker BV (kl-2): Tom 20u à €5/u → 1 freelancer, 20u, €100 marge, €5/u
 */
const REGELS: MargeRegel[] = [
  regel({ hours: 40 }),
  regel({ hours: 10 }),
  regel({ consultantId: "co-2", consultantName: "Sanne de Vries", hours: 50, costRate: 60, chargeRate: 70 }),
  regel({
    clientId: "kl-2",
    clientName: "Bakker BV",
    consultantId: "co-3",
    consultantName: "Tom Jansen",
    hours: 20,
    costRate: 50,
    chargeRate: 55,
  }),
];

// ---------------------------------------------------------------------------
// marginPerClient
// ---------------------------------------------------------------------------

test("marge per klant telt uren en marge op en weegt de marge per uur over de uren", () => {
  assert.deepEqual(marginPerClient(REGELS), [
    {
      clientId: "kl-1",
      clientName: "Van Dijk Industrie",
      freelancers: 2,
      hours: 100,
      marginPerHour: 15,
      totalMargin: 1500,
      belowNorm: false,
    },
    {
      clientId: "kl-2",
      clientName: "Bakker BV",
      freelancers: 1,
      hours: 20,
      marginPerHour: 5,
      totalMargin: 100,
      belowNorm: false,
    },
  ]);
});

test("marge per klant van een lege lijst is een lege lijst", () => {
  assert.deepEqual(marginPerClient([]), []);
});

test("de gewogen marge per uur is geen gemiddelde van de regels", () => {
  // 1u à €100/u + 99u à €0/u → gewogen €1/u, niet €50/u.
  const rows = [
    regel({ hours: 1, costRate: 0, chargeRate: 100 }),
    regel({ hours: 99, costRate: 50, chargeRate: 50 }),
  ];
  const [client] = marginPerClient(rows);
  assert.equal(client.hours, 100);
  assert.equal(client.totalMargin, 100);
  assert.equal(client.marginPerHour, 1);
});

test("een klant zonder uren levert nul marge op in plaats van een deling door nul", () => {
  const [client] = marginPerClient([regel({ hours: 0 })]);
  assert.equal(client.hours, 0);
  assert.equal(client.totalMargin, 0);
  assert.equal(client.marginPerHour, 0);
  assert.equal(Number.isNaN(client.marginPerHour), false);
});

test("klanten staan op aflopende totale marge, bij gelijke marge op naam", () => {
  const rows = [
    regel({ clientId: "kl-b", clientName: "Bakker BV", hours: 10, costRate: 40, chargeRate: 50 }),
    regel({ clientId: "kl-a", clientName: "Aalsmeer Staal", hours: 10, costRate: 40, chargeRate: 50 }),
    regel({ clientId: "kl-c", clientName: "Cuijk Techniek", hours: 10, costRate: 30, chargeRate: 60 }),
  ];
  assert.deepEqual(
    marginPerClient(rows).map((c) => c.clientId),
    ["kl-c", "kl-a", "kl-b"],
  );
});

test("bij gelijke totale marge wint de klant met de meeste uren de eerste plek", () => {
  const rows = [
    regel({ clientId: "kl-a", clientName: "Aalsmeer Staal", hours: 10, costRate: 40, chargeRate: 50 }),
    regel({ clientId: "kl-b", clientName: "Bakker BV", hours: 20, costRate: 45, chargeRate: 50 }),
  ];
  assert.deepEqual(
    marginPerClient(rows).map((c) => c.clientId),
    ["kl-b", "kl-a"],
  );
});

// ---------------------------------------------------------------------------
// belowNorm
// ---------------------------------------------------------------------------

test("zonder norm staat alleen een klant met nul of negatieve marge per uur onder druk", () => {
  const rows = [
    regel({ clientId: "kl-plus", clientName: "Plus", hours: 10, costRate: 40, chargeRate: 41 }),
    regel({ clientId: "kl-nul", clientName: "Nul", hours: 10, costRate: 40, chargeRate: 40 }),
    regel({ clientId: "kl-min", clientName: "Min", hours: 10, costRate: 40, chargeRate: 35 }),
  ];
  const byId = new Map(marginPerClient(rows).map((c) => [c.clientId, c]));
  assert.equal(byId.get("kl-plus")!.belowNorm, false);
  assert.equal(byId.get("kl-nul")!.belowNorm, true);
  assert.equal(byId.get("kl-min")!.belowNorm, true);
  assert.equal(byId.get("kl-min")!.marginPerHour, -5);
});

test("met een norm staat een klant onder druk zodra de marge per uur STRIKT onder de norm ligt", () => {
  const rows = [
    regel({ clientId: "kl-onder", clientName: "Onder", hours: 10, costRate: 40, chargeRate: 51.99 }),
    regel({ clientId: "kl-gelijk", clientName: "Gelijk", hours: 10, costRate: 40, chargeRate: 52 }),
    regel({ clientId: "kl-boven", clientName: "Boven", hours: 10, costRate: 40, chargeRate: 52.01 }),
  ];
  const byId = new Map(marginPerClient(rows, 12).map((c) => [c.clientId, c]));
  assert.equal(byId.get("kl-onder")!.belowNorm, true);
  assert.equal(byId.get("kl-gelijk")!.belowNorm, false);
  assert.equal(byId.get("kl-boven")!.belowNorm, false);
});

test("een norm van nul telt als norm en niet als 'geen norm opgegeven'", () => {
  const rows = [regel({ hours: 10, costRate: 40, chargeRate: 40 })];
  // Zonder norm: 0 ≤ 0 → onder druk. Met norm 0: 0 < 0 is onwaar → niet onder druk.
  assert.equal(marginPerClient(rows)[0].belowNorm, true);
  assert.equal(marginPerClient(rows, 0)[0].belowNorm, false);
});

test("een onbruikbare norm (null of NaN) valt terug op de regel 'nul of negatief'", () => {
  const rows = [regel({ hours: 10, costRate: 40, chargeRate: 45 })];
  assert.equal(marginPerClient(rows, null)[0].belowNorm, false);
  assert.equal(marginPerClient(rows, Number.NaN)[0].belowNorm, false);
});

// ---------------------------------------------------------------------------
// marginPerFreelancer
// ---------------------------------------------------------------------------

test("marge per freelancer telt de uren en marge over al zijn plaatsingen op", () => {
  assert.deepEqual(marginPerFreelancer(REGELS), [
    {
      consultantId: "co-1",
      consultantName: "Rens Bakker",
      clients: 1,
      hours: 50,
      marginPerHour: 20,
      totalMargin: 1000,
    },
    {
      consultantId: "co-2",
      consultantName: "Sanne de Vries",
      clients: 1,
      hours: 50,
      marginPerHour: 10,
      totalMargin: 500,
    },
    {
      consultantId: "co-3",
      consultantName: "Tom Jansen",
      clients: 1,
      hours: 20,
      marginPerHour: 5,
      totalMargin: 100,
    },
  ]);
});

test("marge per freelancer van een lege lijst is een lege lijst", () => {
  assert.deepEqual(marginPerFreelancer([]), []);
});

test("een freelancer bij twee klanten telt beide klanten en beide marges", () => {
  const rows = [
    regel({ hours: 10, costRate: 40, chargeRate: 50 }),
    regel({ clientId: "kl-2", clientName: "Bakker BV", hours: 10, costRate: 40, chargeRate: 60 }),
  ];
  assert.deepEqual(marginPerFreelancer(rows), [
    {
      consultantId: "co-1",
      consultantName: "Rens Bakker",
      clients: 2,
      hours: 20,
      marginPerHour: 15,
      totalMargin: 300,
    },
  ]);
});

test("freelancers staan op aflopende totale marge, bij gelijke marge op naam", () => {
  const rows = [
    regel({ consultantId: "co-b", consultantName: "Bea Bos", hours: 10, costRate: 40, chargeRate: 50 }),
    regel({ consultantId: "co-a", consultantName: "Aad Aarts", hours: 10, costRate: 40, chargeRate: 50 }),
  ];
  assert.deepEqual(
    marginPerFreelancer(rows).map((f) => f.consultantId),
    ["co-a", "co-b"],
  );
});

test("een freelancer zonder uren levert nul marge op in plaats van een deling door nul", () => {
  const [f] = marginPerFreelancer([regel({ hours: 0 })]);
  assert.equal(f.hours, 0);
  assert.equal(f.marginPerHour, 0);
  assert.equal(f.totalMargin, 0);
});

// ---------------------------------------------------------------------------
// overallMarginSummary
// ---------------------------------------------------------------------------

test("het totaaloverzicht telt alles op en wijst de beste en de zwakste klant aan", () => {
  const summary = overallMarginSummary(REGELS);

  assert.equal(summary.clients, 2);
  assert.equal(summary.freelancers, 3);
  assert.equal(summary.hours, 120);
  assert.equal(summary.totalMargin, 1600);
  // 1600 / 120 = 13,333… → 13,33
  assert.equal(summary.avgMarginPerHour, 13.33);
  assert.equal(summary.belowNormCount, 0);
  assert.equal(summary.bestClient?.clientId, "kl-1");
  assert.equal(summary.worstClient?.clientId, "kl-2");
});

test("het totaaloverzicht van een lege lijst is nul zonder beste of zwakste klant", () => {
  assert.deepEqual(overallMarginSummary([]), {
    clients: 0,
    freelancers: 0,
    hours: 0,
    totalMargin: 0,
    avgMarginPerHour: 0,
    belowNormCount: 0,
    bestClient: null,
    worstClient: null,
  });
});

test("klanten zonder uren doen niet mee als beste of zwakste klant", () => {
  const rows = [
    regel({ clientId: "kl-leeg", clientName: "Leeg BV", hours: 0 }),
    regel({ clientId: "kl-1", clientName: "Van Dijk Industrie", hours: 10, costRate: 40, chargeRate: 50 }),
  ];
  const summary = overallMarginSummary(rows);
  assert.equal(summary.clients, 2);
  assert.equal(summary.bestClient?.clientId, "kl-1");
  assert.equal(summary.worstClient?.clientId, "kl-1");
});

test("zonder enige klant met uren blijven beste en zwakste klant leeg", () => {
  const summary = overallMarginSummary([regel({ hours: 0 })]);
  assert.equal(summary.hours, 0);
  assert.equal(summary.avgMarginPerHour, 0);
  assert.equal(summary.bestClient, null);
  assert.equal(summary.worstClient, null);
});

test("bij gelijke marge per uur wint de grootste totale marge als beste en de kleinste als zwakste", () => {
  const rows = [
    regel({ clientId: "kl-groot", clientName: "Groot BV", hours: 100, costRate: 40, chargeRate: 50 }),
    regel({ clientId: "kl-klein", clientName: "Klein BV", hours: 10, costRate: 40, chargeRate: 50 }),
  ];
  const summary = overallMarginSummary(rows);
  assert.equal(summary.bestClient?.marginPerHour, 10);
  assert.equal(summary.worstClient?.marginPerHour, 10);
  assert.equal(summary.bestClient?.clientId, "kl-groot");
  assert.equal(summary.worstClient?.clientId, "kl-klein");
});

test("bij gelijke marge per uur én gelijke totale marge beslist de klantnaam", () => {
  const rows = [
    regel({ clientId: "kl-b", clientName: "Bakker BV", hours: 10, costRate: 40, chargeRate: 50 }),
    regel({ clientId: "kl-a", clientName: "Aalsmeer Staal", hours: 10, costRate: 40, chargeRate: 50 }),
  ];
  const summary = overallMarginSummary(rows);
  assert.equal(summary.bestClient?.clientId, "kl-a");
  assert.equal(summary.worstClient?.clientId, "kl-a");
});

test("het totaaloverzicht telt met een norm hoeveel klanten onder druk staan", () => {
  const summary = overallMarginSummary(REGELS, 12);
  assert.equal(summary.belowNormCount, 1);
  assert.equal(summary.worstClient?.clientId, "kl-2");
  assert.equal(summary.worstClient?.belowNorm, true);
});

// ---------------------------------------------------------------------------
// Samenstelling + zuiverheid
// ---------------------------------------------------------------------------

test("buildMargeOverzicht levert de drie overzichten, de norm en Nederlandse labels", () => {
  const overzicht = buildMargeOverzicht({ rows: REGELS, norm: 12 });

  assert.equal(overzicht.norm, 12);
  assert.deepEqual(overzicht.perClient, marginPerClient(REGELS, 12));
  assert.deepEqual(overzicht.perFreelancer, marginPerFreelancer(REGELS));
  assert.deepEqual(overzicht.summary, overallMarginSummary(REGELS, 12));
  assert.equal(overzicht.labels, MARGE_LABELS);
  assert.equal(MARGE_LABELS.marginPerHour, "Marge per uur");
});

test("buildMargeOverzicht zonder norm laat de norm leeg", () => {
  assert.equal(buildMargeOverzicht({ rows: REGELS }).norm, null);
});

test("de rekenfuncties zijn zuiver: zelfde invoer geeft zelfde uitvoer en de invoer blijft ongemoeid", () => {
  const rows = REGELS.map((r) => Object.freeze({ ...r })) as MargeRegel[];
  const before = JSON.stringify(rows);

  assert.deepEqual(marginPerClient(rows, 12), marginPerClient(rows, 12));
  assert.deepEqual(marginPerFreelancer(rows), marginPerFreelancer(rows));
  assert.deepEqual(overallMarginSummary(rows, 12), overallMarginSummary(rows, 12));
  assert.deepEqual(buildMargeOverzicht({ rows, norm: 12 }), buildMargeOverzicht({ rows, norm: 12 }));

  assert.equal(JSON.stringify(rows), before);
  assert.equal(rows.length, REGELS.length);
});
