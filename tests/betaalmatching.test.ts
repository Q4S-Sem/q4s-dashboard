import assert from "node:assert/strict";
import test from "node:test";
import {
  BETAALMATCHING_LABELS,
  betaalmatchingSamenvatting,
  buildBetaalmatching,
  freelancerReleaseStatus,
  matchClientPayments,
  type Uitbetaalverplichting,
  type VerkoopFactuur,
} from "../src/lib/betaalmatching";

// Vast referentiemoment, zodat "te laat" en "dagen" niet meebewegen met de klok.
const NU = new Date("2026-09-01T12:00:00Z");

const factuur = (patch: Partial<VerkoopFactuur> & { id: string }): VerkoopFactuur => ({
  number: patch.id,
  clientId: "kl-1",
  clientName: "Van Dijk Industrie",
  status: "SENT",
  total: 1000,
  issueDate: new Date("2026-08-01T00:00:00Z"),
  dueDate: new Date("2026-08-31T00:00:00Z"),
  paidDate: null,
  placementIds: [],
  consultantIds: [],
  ...patch,
});

/**
 * Vaste set verkoopfacturen:
 *  f1 — Van Dijk, BETAALD (20-07), plaatsing pl-1 / freelancer co-1
 *  f2 — Van Dijk, open, vervalt pas 15-09, plaatsing pl-2 / freelancer co-2
 *  f3 — Bakker BV, TE LAAT sinds 04-08 (28 dagen), plaatsing pl-3 / freelancer co-3
 */
const F1 = factuur({
  id: "f1",
  number: "2026-0001",
  status: "PAID",
  total: 5000,
  issueDate: new Date("2026-07-01T00:00:00Z"),
  dueDate: new Date("2026-07-31T00:00:00Z"),
  paidDate: new Date("2026-07-20T00:00:00Z"),
  placementIds: ["pl-1"],
  consultantIds: ["co-1"],
});
const F2 = factuur({
  id: "f2",
  number: "2026-0002",
  total: 3000,
  issueDate: new Date("2026-08-15T00:00:00Z"),
  dueDate: new Date("2026-09-15T00:00:00Z"),
  placementIds: ["pl-2"],
  consultantIds: ["co-2"],
});
const F3 = factuur({
  id: "f3",
  number: "2026-0003",
  clientId: "kl-2",
  clientName: "Bakker BV",
  total: 2000,
  issueDate: new Date("2026-07-05T00:00:00Z"),
  dueDate: new Date("2026-08-04T00:00:00Z"),
  placementIds: ["pl-3"],
  consultantIds: ["co-3"],
});
const FACTUREN = [F1, F2, F3];

const verplichting = (
  patch: Partial<Uitbetaalverplichting> & { id: string },
): Uitbetaalverplichting => ({
  soort: "inkoopfactuur",
  number: patch.id,
  consultantId: "co-1",
  consultantName: "Rens Bakker",
  placementIds: [],
  amount: 1000,
  betaald: false,
  ...patch,
});

const V1 = verplichting({
  id: "v1",
  number: "INK-2026-0001",
  consultantId: "co-1",
  consultantName: "Rens Bakker",
  placementIds: ["pl-1"],
  amount: 3800,
});
const V2 = verplichting({
  id: "v2",
  number: "INK-2026-0002",
  consultantId: "co-2",
  consultantName: "Sanne de Vries",
  placementIds: ["pl-2"],
  amount: 2400,
});
const V3 = verplichting({
  id: "v3",
  soort: "ontvangen-factuur",
  number: "2026-77",
  consultantId: "co-3",
  consultantName: "Tom Jansen",
  placementIds: [],
  amount: 1600,
});
const V4 = verplichting({
  id: "v4",
  number: "INK-2026-0004",
  consultantId: "co-9",
  consultantName: "Kees Onbekend",
  placementIds: ["pl-9"],
  amount: 900,
});
const VERPLICHTINGEN = [V1, V2, V3, V4];

const bucketVan = (rows: { id: string; bucket: string }[], id: string) =>
  rows.find((r) => r.id === id)!.bucket;

// ---------------------------------------------------------------------------
// matchClientPayments
// ---------------------------------------------------------------------------

test("elke verkoopfactuur krijgt een bucket: betaald, openstaand of te laat", () => {
  const rijen = matchClientPayments({ salesInvoices: FACTUREN, now: NU });

  assert.equal(rijen.length, 3);
  assert.equal(bucketVan(rijen, "f1"), "betaald");
  assert.equal(bucketVan(rijen, "f2"), "open");
  assert.equal(bucketVan(rijen, "f3"), "teLaat");
});

test("de bucket krijgt een Nederlands label mee", () => {
  const rijen = matchClientPayments({ salesInvoices: FACTUREN, now: NU });
  const label = (id: string) => rijen.find((r) => r.id === id)!.label;

  assert.equal(label("f1"), "Betaald");
  assert.equal(label("f2"), "Openstaand");
  assert.equal(label("f3"), "Te laat");
});

test("een lege lijst verkoopfacturen levert een lege lijst op", () => {
  assert.deepEqual(matchClientPayments({ salesInvoices: [], now: NU }), []);
});

test("dagen open telt vanaf de factuurdatum tot de betaaldatum, en anders tot vandaag", () => {
  const rijen = matchClientPayments({ salesInvoices: FACTUREN, now: NU });
  const dagen = (id: string) => rijen.find((r) => r.id === id)!.dagenOpen;

  assert.equal(dagen("f1"), 19); // 01-07 → betaald op 20-07
  assert.equal(dagen("f2"), 17); // 15-08 → vandaag 01-09
  assert.equal(dagen("f3"), 58); // 05-07 → vandaag 01-09
});

test("dagen te laat telt de hele dagen na de vervaldatum en is nul zolang die niet verstreken is", () => {
  const rijen = matchClientPayments({ salesInvoices: FACTUREN, now: NU });
  const teLaat = (id: string) => rijen.find((r) => r.id === id)!.dagenTeLaat;

  assert.equal(teLaat("f1"), 0); // betaald vóór de vervaldatum
  assert.equal(teLaat("f2"), 0); // vervalt pas 15-09
  assert.equal(teLaat("f3"), 28); // 04-08 → 01-09
});

test("een factuur die op de vervaldatum nog openstaat is nog niet te laat", () => {
  const opTijd = factuur({ id: "f-vandaag", dueDate: new Date("2026-09-01T00:00:00Z") });
  const [rij] = matchClientPayments({ salesInvoices: [opTijd], now: NU });

  assert.equal(rij.bucket, "open");
  assert.equal(rij.dagenTeLaat, 0);
});

test("een te laat betaalde factuur blijft betaald en houdt zijn te-laat-dagen", () => {
  const laatBetaald = factuur({
    id: "f-laat",
    status: "PAID",
    dueDate: new Date("2026-08-04T00:00:00Z"),
    paidDate: new Date("2026-08-14T00:00:00Z"),
  });
  const [rij] = matchClientPayments({ salesInvoices: [laatBetaald], now: NU });

  assert.equal(rij.bucket, "betaald");
  assert.equal(rij.betaald, true);
  assert.equal(rij.dagenTeLaat, 10);
});

test("een factuur met status OVERDUE telt als te laat, ook zonder verstreken vervaldatum", () => {
  const gemarkeerd = factuur({
    id: "f-overdue",
    status: "OVERDUE",
    dueDate: new Date("2026-09-20T00:00:00Z"),
  });
  assert.equal(matchClientPayments({ salesInvoices: [gemarkeerd], now: NU })[0].bucket, "teLaat");
});

test("een geannuleerde factuur telt niet mee", () => {
  const geannuleerd = factuur({ id: "f-annuleer", status: "CANCELLED" });
  assert.deepEqual(
    matchClientPayments({ salesInvoices: [...FACTUREN, geannuleerd], now: NU }).map((r) => r.id),
    ["f3", "f2", "f1"],
  );
});

test("de te late facturen staan bovenaan, daarna de openstaande en als laatste de betaalde", () => {
  assert.deepEqual(
    matchClientPayments({ salesInvoices: FACTUREN, now: NU }).map((r) => r.id),
    ["f3", "f2", "f1"],
  );
});

test("binnen dezelfde bucket staat de langst openstaande factuur bovenaan", () => {
  const kort = factuur({ id: "f-kort", dueDate: new Date("2026-08-30T00:00:00Z") });
  const lang = factuur({ id: "f-lang", dueDate: new Date("2026-07-01T00:00:00Z") });
  assert.deepEqual(
    matchClientPayments({ salesInvoices: [kort, lang], now: NU }).map((r) => r.id),
    ["f-lang", "f-kort"],
  );
});

test("één klant met meerdere facturen levert per factuur een eigen regel op", () => {
  const rijen = matchClientPayments({ salesInvoices: FACTUREN, now: NU }).filter(
    (r) => r.clientId === "kl-1",
  );

  assert.deepEqual(
    rijen.map((r) => [r.number, r.bucket, r.total]),
    [
      ["2026-0002", "open", 3000],
      ["2026-0001", "betaald", 5000],
    ],
  );
});

// ---------------------------------------------------------------------------
// freelancerReleaseStatus
// ---------------------------------------------------------------------------

test("een uitbetaling wordt vrijgegeven zodra de klant de gekoppelde verkoopfactuur betaalde", () => {
  const rijen = freelancerReleaseStatus({
    salesInvoices: FACTUREN,
    purchaseObligations: VERPLICHTINGEN,
    now: NU,
  });
  const rij = rijen.find((r) => r.id === "v1")!;

  assert.equal(rij.bucket, "vrijgeven");
  assert.equal(rij.label, "Vrijgeven");
  assert.equal(rij.gekoppeldVia, "plaatsing");
  assert.deepEqual(
    rij.facturen.map((f) => f.number),
    ["2026-0001"],
  );
});

test("een uitbetaling wacht op de klant zolang de gekoppelde verkoopfactuur nog openstaat", () => {
  const rijen = freelancerReleaseStatus({
    salesInvoices: FACTUREN,
    purchaseObligations: VERPLICHTINGEN,
    now: NU,
  });
  const rij = rijen.find((r) => r.id === "v2")!;

  assert.equal(rij.bucket, "wachtOpKlant");
  assert.equal(rij.label, "Wacht op klant");
});

test("een uitbetaling krijgt 'klant te laat' als de gekoppelde verkoopfactuur over de vervaldatum is", () => {
  const rijen = freelancerReleaseStatus({
    salesInvoices: FACTUREN,
    purchaseObligations: VERPLICHTINGEN,
    now: NU,
  });
  const rij = rijen.find((r) => r.id === "v3")!;

  assert.equal(rij.bucket, "klantTeLaat");
  assert.equal(rij.label, "Klant te laat");
  assert.match(rij.toelichting, /28 dagen/);
});

test("zonder plaatsing valt de koppeling terug op de freelancer zelf", () => {
  const rijen = freelancerReleaseStatus({
    salesInvoices: FACTUREN,
    purchaseObligations: [V3],
    now: NU,
  });

  assert.equal(rijen[0].gekoppeldVia, "freelancer");
  assert.deepEqual(
    rijen[0].facturen.map((f) => f.number),
    ["2026-0003"],
  );
});

test("een verplichting zonder enige verkoopfactuur komt in de eigen bucket 'niet gekoppeld'", () => {
  const rijen = freelancerReleaseStatus({
    salesInvoices: FACTUREN,
    purchaseObligations: VERPLICHTINGEN,
    now: NU,
  });
  const rij = rijen.find((r) => r.id === "v4")!;

  assert.equal(rij.bucket, "nietGekoppeld");
  assert.equal(rij.label, "Niet gekoppeld");
  assert.equal(rij.gekoppeldVia, "geen");
  assert.deepEqual(rij.facturen, []);
  assert.match(rij.toelichting, /handmatig/i);
});

test("zonder verkoopfacturen is elke verplichting niet gekoppeld en nooit vrijgegeven", () => {
  const rijen = freelancerReleaseStatus({
    salesInvoices: [],
    purchaseObligations: VERPLICHTINGEN,
    now: NU,
  });

  assert.equal(rijen.length, 4);
  assert.deepEqual([...new Set(rijen.map((r) => r.bucket))], ["nietGekoppeld"]);
});

test("zonder verplichtingen is de vrijgavelijst leeg", () => {
  assert.deepEqual(
    freelancerReleaseStatus({ salesInvoices: FACTUREN, purchaseObligations: [], now: NU }),
    [],
  );
});

test("vrijgeven mag alleen als ELKE gekoppelde verkoopfactuur betaald is", () => {
  const beide = verplichting({ id: "v-beide", placementIds: ["pl-1", "pl-2"], amount: 5000 });
  const [rij] = freelancerReleaseStatus({
    salesInvoices: FACTUREN,
    purchaseObligations: [beide],
    now: NU,
  });

  assert.equal(rij.facturen.length, 2);
  assert.equal(rij.bucket, "wachtOpKlant");
  assert.match(rij.toelichting, /1 van de 2/);
});

test("één te late verkoopfactuur weegt zwaarder dan de betaalde ernaast", () => {
  const beide = verplichting({ id: "v-mix", placementIds: ["pl-1", "pl-3"], amount: 5000 });
  const [rij] = freelancerReleaseStatus({
    salesInvoices: FACTUREN,
    purchaseObligations: [beide],
    now: NU,
  });

  assert.equal(rij.bucket, "klantTeLaat");
});

test("een al uitbetaalde verplichting krijgt geen vrijgave-advies meer", () => {
  const gedaan = verplichting({ id: "v-betaald", placementIds: ["pl-2"], betaald: true });
  const [rij] = freelancerReleaseStatus({
    salesInvoices: FACTUREN,
    purchaseObligations: [gedaan],
    now: NU,
  });

  assert.equal(rij.bucket, "alBetaald");
  assert.equal(rij.label, "Al uitbetaald");
});

test("een geannuleerde verkoopfactuur blokkeert de uitbetaling niet", () => {
  const geannuleerd = factuur({ id: "f-annuleer", status: "CANCELLED", placementIds: ["pl-1"] });
  const [rij] = freelancerReleaseStatus({
    salesInvoices: [...FACTUREN, geannuleerd],
    purchaseObligations: [V1],
    now: NU,
  });

  assert.equal(rij.bucket, "vrijgeven");
  assert.equal(rij.facturen.length, 1);
});

test("de risicovolle uitbetalingen staan bovenaan en de afgeronde onderaan", () => {
  const gedaan = verplichting({ id: "v-betaald", placementIds: ["pl-1"], betaald: true });
  const rijen = freelancerReleaseStatus({
    salesInvoices: FACTUREN,
    purchaseObligations: [...VERPLICHTINGEN, gedaan],
    now: NU,
  });

  assert.deepEqual(
    rijen.map((r) => r.id),
    ["v3", "v2", "v4", "v1", "v-betaald"],
  );
});

test("binnen dezelfde bucket staat het hoogste bedrag bovenaan", () => {
  const klein = verplichting({ id: "v-klein", placementIds: ["pl-2"], amount: 100 });
  const groot = verplichting({ id: "v-groot", placementIds: ["pl-2"], amount: 9000 });
  assert.deepEqual(
    freelancerReleaseStatus({
      salesInvoices: FACTUREN,
      purchaseObligations: [klein, groot],
      now: NU,
    }).map((r) => r.id),
    ["v-groot", "v-klein"],
  );
});

// ---------------------------------------------------------------------------
// Samenvatting
// ---------------------------------------------------------------------------

test("de samenvatting telt per bucket het aantal en het bedrag", () => {
  const facturen = matchClientPayments({ salesInvoices: FACTUREN, now: NU });
  const vrijgave = freelancerReleaseStatus({
    salesInvoices: FACTUREN,
    purchaseObligations: VERPLICHTINGEN,
    now: NU,
  });
  const s = betaalmatchingSamenvatting({ facturen, vrijgave });

  assert.deepEqual(s.facturen, {
    betaald: { count: 1, total: 5000 },
    open: { count: 1, total: 3000 },
    teLaat: { count: 1, total: 2000 },
    totaal: { count: 3, total: 10000 },
  });
  assert.deepEqual(s.verplichtingen, {
    vrijgeven: { count: 1, total: 3800 },
    wachtOpKlant: { count: 1, total: 2400 },
    klantTeLaat: { count: 1, total: 1600 },
    nietGekoppeld: { count: 1, total: 900 },
    alBetaald: { count: 0, total: 0 },
    totaal: { count: 4, total: 8700 },
  });
});

test("de samenvatting van lege lijsten is overal nul", () => {
  const s = betaalmatchingSamenvatting({ facturen: [], vrijgave: [] });

  assert.deepEqual(s.facturen.totaal, { count: 0, total: 0 });
  assert.deepEqual(s.verplichtingen.totaal, { count: 0, total: 0 });
  assert.deepEqual(s.facturen.teLaat, { count: 0, total: 0 });
  assert.deepEqual(s.verplichtingen.vrijgeven, { count: 0, total: 0 });
});

test("de bedragen in de samenvatting worden op twee decimalen afgerond", () => {
  const centen = [
    factuur({ id: "c1", total: 0.1 }),
    factuur({ id: "c2", total: 0.2 }),
  ];
  const facturen = matchClientPayments({ salesInvoices: centen, now: NU });

  assert.equal(betaalmatchingSamenvatting({ facturen, vrijgave: [] }).facturen.totaal.total, 0.3);
});

// ---------------------------------------------------------------------------
// Samenstelling + zuiverheid
// ---------------------------------------------------------------------------

test("buildBetaalmatching levert de facturen, de vrijgave, de samenvatting en Nederlandse labels", () => {
  const overzicht = buildBetaalmatching({
    salesInvoices: FACTUREN,
    purchaseObligations: VERPLICHTINGEN,
    now: NU,
  });

  assert.equal(overzicht.generatedAt, NU);
  assert.deepEqual(overzicht.facturen, matchClientPayments({ salesInvoices: FACTUREN, now: NU }));
  assert.deepEqual(
    overzicht.vrijgave,
    freelancerReleaseStatus({ salesInvoices: FACTUREN, purchaseObligations: VERPLICHTINGEN, now: NU }),
  );
  assert.deepEqual(
    overzicht.samenvatting,
    betaalmatchingSamenvatting({ facturen: overzicht.facturen, vrijgave: overzicht.vrijgave }),
  );
  assert.equal(overzicht.labels, BETAALMATCHING_LABELS);
  assert.equal(BETAALMATCHING_LABELS.vrijgeven, "Vrijgeven");
  assert.match(BETAALMATCHING_LABELS.cashflowNote, /pas.*klant/i);
});

test("de rekenfuncties zijn zuiver: zelfde invoer geeft zelfde uitvoer en de invoer blijft ongemoeid", () => {
  const facturen = FACTUREN.map((f) => Object.freeze({ ...f })) as VerkoopFactuur[];
  const verplichtingen = VERPLICHTINGEN.map((v) => Object.freeze({ ...v })) as Uitbetaalverplichting[];
  const voor = JSON.stringify({ facturen, verplichtingen });

  assert.deepEqual(
    matchClientPayments({ salesInvoices: facturen, now: NU }),
    matchClientPayments({ salesInvoices: facturen, now: NU }),
  );
  assert.deepEqual(
    freelancerReleaseStatus({ salesInvoices: facturen, purchaseObligations: verplichtingen, now: NU }),
    freelancerReleaseStatus({ salesInvoices: facturen, purchaseObligations: verplichtingen, now: NU }),
  );
  assert.deepEqual(
    buildBetaalmatching({ salesInvoices: facturen, purchaseObligations: verplichtingen, now: NU }),
    buildBetaalmatching({ salesInvoices: facturen, purchaseObligations: verplichtingen, now: NU }),
  );

  assert.equal(JSON.stringify({ facturen, verplichtingen }), voor);
  assert.equal(facturen.length, FACTUREN.length);
  assert.equal(verplichtingen.length, VERPLICHTINGEN.length);
});
