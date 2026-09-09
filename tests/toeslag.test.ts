import assert from "node:assert/strict";
import test from "node:test";
import {
  buildTimesheetLines,
  computeTimesheetMoney,
  sideSurcharges,
  surchargeUnit,
  upliftedRate,
  weekendHoursOf,
  type SurchargeConfig,
} from "../src/lib/toeslag";
import { round2 } from "../src/lib/utils";

// ---------------------------------------------------------------------------
// Het rekenmodel achter iedere factuur:
//   • WEEKEND-uren zitten al in de dagregels → alleen het toeslagdeel erbovenop.
//   • OVERUREN staan NIET in de dagregels → volledige uren × opgehoogd tarief,
//     precies zoals de freelancer ze zelf factureert.
// De regels van buildTimesheetLines moeten tot op de cent optellen tot het
// totaal van computeTimesheetMoney, anders wijkt de wizard af van de factuur.
// ---------------------------------------------------------------------------

/** Maandag 6 januari 2025 (ISO-week 2) + n dagen. */
function dag(n: number): Date {
  return new Date(2025, 0, 6 + n);
}

const NUL: SurchargeConfig = {
  costRate: 0,
  chargeRate: 0,
  weekendSurchargeBuy: 0,
  weekendSurchargeSell: 0,
  overtimeSurchargeBuy: 0,
  overtimeSurchargeSell: 0,
  kmRateBuy: 0,
  kmRateSell: 0,
};

function config(over: Partial<SurchargeConfig>): SurchargeConfig {
  return { ...NUL, ...over };
}

/** Dezelfde invoer als computeTimesheetMoney, maar dan als factuurregels (inkoop). */
function inkoopRegels(
  entries: { date: Date; hours: number }[],
  t: { overtimeHours: number | null; kilometers: number | null },
  p: SurchargeConfig,
) {
  return buildTimesheetLines({
    timesheetId: "ts-1",
    placementId: "pl-1",
    weekNumber: 2,
    location: null,
    baseDescription: "Totaal uren",
    entries,
    overtimeHours: t.overtimeHours,
    kilometers: t.kilometers,
    rate: p.costRate,
    weekendPct: p.weekendSurchargeBuy,
    overtimePct: p.overtimeSurchargeBuy,
    kmRate: p.kmRateBuy,
    surcharges: sideSurcharges(p, "buy"),
  });
}

/** Dezelfde invoer, maar dan de verkoopregels (zoals invoicing.ts ze bouwt). */
function verkoopRegels(
  entries: { date: Date; hours: number }[],
  t: { overtimeHours: number | null; kilometers: number | null },
  p: SurchargeConfig,
) {
  return buildTimesheetLines({
    timesheetId: "ts-1",
    placementId: "pl-1",
    weekNumber: 2,
    location: null,
    baseDescription: "Total hours",
    entries,
    overtimeHours: t.overtimeHours,
    kilometers: t.kilometers,
    rate: p.chargeRate,
    weekendPct: p.weekendSurchargeSell,
    overtimePct: p.overtimeSurchargeSell,
    overtimeRate: p.overtimeChargeRate,
    kmRate: p.kmRateSell,
    surcharges: sideSurcharges(p, "sell"),
  });
}

function regelTotaal(regels: { amount: number }[]): number {
  return round2(regels.reduce((s, r) => s + r.amount, 0));
}

// ---------------------------------------------------------------------------
// surchargeUnit / upliftedRate
// ---------------------------------------------------------------------------

test("het opgehoogde uurtarief is tarief + toeslag, op centen afgerond", () => {
  assert.equal(surchargeUnit(77, 10), 7.7);
  assert.equal(upliftedRate(77, 10), 84.7);
  assert.equal(upliftedRate(77, 0), 77);
  assert.equal(upliftedRate(66.67, 12.5), round2(66.67 + surchargeUnit(66.67, 12.5)));
});

// ---------------------------------------------------------------------------
// Overuren = EXTRA uren tegen het volle opgehoogde tarief (de bug-case)
// ---------------------------------------------------------------------------

test("Jordy: 32 reguliere uren + 3 overuren à €77 +10% = €2.718,10 inkoop", () => {
  // Dinsdag t/m vrijdag 8 uur; maandag niet gewerkt, geen weekend.
  const entries = [1, 2, 3, 4].map((i) => ({ date: dag(i), hours: 8 }));
  const p = config({ costRate: 77, overtimeSurchargeBuy: 10 });
  const geld = computeTimesheetMoney(
    { entries, overtimeHours: 3, kilometers: null },
    p,
  );

  assert.equal(geld.hours, 32);
  assert.equal(geld.workedHours, 35);
  assert.equal(geld.weekendHours, 0);
  assert.equal(geld.buy.base, 2464); // 32 × 77
  assert.equal(geld.buy.weekend, 0);
  assert.equal(geld.buy.overtime, 254.1); // 3 × 84,70 — inclusief basistarief
  assert.equal(geld.buy.km, 0);
  assert.equal(geld.buy.total, 2718.1);

  // Precies wat de freelancer factureert → de wizard mag dit niet als afwijking
  // markeren, want zijn factuurbedrag is exact buy.total.
  const regels = inkoopRegels(entries, { overtimeHours: 3, kilometers: null }, p);
  assert.equal(regels.length, 2);
  assert.equal(regels[1].description, "Overuren +10%");
  assert.equal(regels[1].quantity, 3);
  assert.equal(regels[1].unitPrice, 84.7);
  assert.equal(regels[1].amount, 254.1);
  assert.equal(regelTotaal(regels), 2718.1);
});

test("zonder overurentoeslag worden overuren nog steeds tegen het basistarief betaald", () => {
  const entries = [{ date: dag(0), hours: 8 }];
  const p = config({ costRate: 50, chargeRate: 70 });
  const geld = computeTimesheetMoney(
    { entries, overtimeHours: 4, kilometers: null },
    p,
  );

  assert.equal(geld.buy.overtime, 200); // 4 × 50, niet 0
  assert.equal(geld.buy.total, 600); // 400 basis + 200 overuren
  assert.equal(geld.sell.overtime, 280); // 4 × 70
  assert.equal(geld.sell.total, 840);

  const regels = inkoopRegels(entries, { overtimeHours: 4, kilometers: null }, p);
  assert.equal(regels[1].description, "Overuren");
  assert.equal(regels[1].unitPrice, 50);
  assert.equal(regelTotaal(regels), geld.buy.total);
});

test("geen overuren → geen overurenregel en geen overurenbedrag", () => {
  const entries = [{ date: dag(0), hours: 8 }];
  const p = config({ costRate: 60, overtimeSurchargeBuy: 25 });
  const geld = computeTimesheetMoney(
    { entries, overtimeHours: null, kilometers: null },
    p,
  );

  assert.equal(geld.buy.overtime, 0);
  assert.equal(geld.buy.total, 480);
  assert.equal(inkoopRegels(entries, { overtimeHours: null, kilometers: null }, p).length, 1);
});

// ---------------------------------------------------------------------------
// Weekend blijft toeslag-only (de uren zitten al in de dagregels)
// ---------------------------------------------------------------------------

test("weekenduren tellen mee in de basis en krijgen alléén de toeslag erbovenop", () => {
  // Maandag t/m vrijdag 8 u + zaterdag 4 u = 44 u, waarvan 4 weekenduren.
  const entries = [
    ...[0, 1, 2, 3, 4].map((i) => ({ date: dag(i), hours: 8 })),
    { date: dag(5), hours: 4 },
  ];
  const p = config({ costRate: 50, weekendSurchargeBuy: 50 });
  const geld = computeTimesheetMoney(
    { entries, overtimeHours: null, kilometers: null },
    p,
  );

  assert.equal(weekendHoursOf(entries), 4);
  assert.equal(geld.hours, 44);
  assert.equal(geld.weekendHours, 4);
  assert.equal(geld.buy.base, 2200); // 44 × 50, inclusief de zaterdaguren
  assert.equal(geld.buy.weekend, 100); // 4 × 25 toeslag, géén tweede basis
  assert.equal(geld.buy.total, 2300);

  const regels = inkoopRegels(entries, { overtimeHours: null, kilometers: null }, p);
  assert.equal(regels[1].description, "Weekendtoeslag 50%");
  assert.equal(regels[1].unitPrice, 25);
  assert.equal(regelTotaal(regels), 2300);
});

// ---------------------------------------------------------------------------
// De harde garantie: regels === totaal, altijd
// ---------------------------------------------------------------------------

test("de som van de factuurregels is exact gelijk aan het zijtotaal", () => {
  const entries = [
    ...[0, 1, 2, 3, 4].map((i) => ({ date: dag(i), hours: 7.5 })),
    { date: dag(6), hours: 5.25 }, // zondag
  ];
  const p = config({
    costRate: 77,
    chargeRate: 92.5,
    weekendSurchargeBuy: 50,
    weekendSurchargeSell: 50,
    overtimeSurchargeBuy: 10,
    overtimeSurchargeSell: 15,
    kmRateBuy: 0.23,
    kmRateSell: 0.23,
  });
  const t = { overtimeHours: 3.25, kilometers: 187 };
  const geld = computeTimesheetMoney({ entries, ...t }, p);

  const inkoop = inkoopRegels(entries, t, p);
  assert.equal(inkoop.length, 4); // uren + weekend + overuren + km
  assert.equal(regelTotaal(inkoop), geld.buy.total);

  const verkoop = buildTimesheetLines({
    timesheetId: "ts-1",
    placementId: "pl-1",
    weekNumber: 2,
    location: null,
    baseDescription: "Total hours",
    entries,
    overtimeHours: t.overtimeHours,
    kilometers: t.kilometers,
    rate: p.chargeRate,
    weekendPct: p.weekendSurchargeSell,
    overtimePct: p.overtimeSurchargeSell,
    kmRate: p.kmRateSell,
  });
  assert.equal(regelTotaal(verkoop), geld.sell.total);
  assert.equal(round2(regelTotaal(verkoop) - regelTotaal(inkoop)), geld.margin);
});

// ---------------------------------------------------------------------------
// EXPLICIETE overuren-tarieven (€/u), los van het percentage-model.
// De eigenaar wil per plaatsing een eigen overuren-inkoop en -verkoop kunnen
// vastleggen; leeg = terugvallen op de normale rate (geen uplift).
// ---------------------------------------------------------------------------

test("expliciete overuren-rate wint van het percentage (inkoop én verkoop)", () => {
  const entries = [1, 2, 3, 4].map((i) => ({ date: dag(i), hours: 8 })); // 32 u
  // Jordy: betaalt €84,70/overuur, factureert €93,70/overuur → €9 marge/overuur.
  const p = config({
    costRate: 77,
    chargeRate: 86,
    overtimeSurchargeBuy: 999, // moet genegeerd worden zodra de expliciete rate staat
    overtimeSurchargeSell: 999,
    overtimeCostRate: 84.7,
    overtimeChargeRate: 93.7,
  });
  const geld = computeTimesheetMoney({ entries, overtimeHours: 3, kilometers: null }, p);

  assert.equal(geld.buy.overtime, 254.1); // 3 × 84,70 (niet via het percentage)
  assert.equal(geld.sell.overtime, 281.1); // 3 × 93,70
  // Marge op de overuren = 3 × (93,70 − 84,70) = €27; regulier = 32 × (86 − 77) = €288.
  assert.equal(geld.margin, round2(32 * (86 - 77) + 3 * (93.7 - 84.7)));

  const verkoop = buildTimesheetLines({
    timesheetId: "ts-1",
    placementId: "pl-1",
    weekNumber: 2,
    location: null,
    baseDescription: "Total hours",
    entries,
    overtimeHours: 3,
    kilometers: null,
    rate: p.chargeRate,
    weekendPct: p.weekendSurchargeSell,
    overtimePct: p.overtimeSurchargeSell,
    overtimeRate: p.overtimeChargeRate,
    kmRate: p.kmRateSell,
  });
  const otRegel = verkoop.find((r) => r.quantity === 3 && r.lineKind === "SURCHARGE")!;
  assert.equal(otRegel.unitPrice, 93.7);
  assert.equal(otRegel.amount, 281.1);
  assert.equal(regelTotaal(verkoop), geld.sell.total);
});

test("lege overuren-rate valt terug op de normale rate (geen margeverlies)", () => {
  const entries = [{ date: dag(0), hours: 8 }];
  // Geen expliciete overuren-rate en geen percentage → overuren tegen de basis.
  const p = config({
    costRate: 77,
    chargeRate: 86,
    overtimeCostRate: null,
    overtimeChargeRate: null,
  });
  const geld = computeTimesheetMoney({ entries, overtimeHours: 3, kilometers: null }, p);

  assert.equal(geld.buy.overtime, 231); // 3 × 77
  assert.equal(geld.sell.overtime, 258); // 3 × 86
  // De overuren houden dus dezelfde marge als reguliere uren (€9/u), geen verlies.
  assert.equal(round2(geld.sell.overtime - geld.buy.overtime), 27);
});

// ---------------------------------------------------------------------------
// De ZES losse toeslagen per plaatsing: doordeweeks, zaterdag, zondag, offshore,
// ploegendienst en buitenland — elk met een eigen schakelaar percentage (%) of
// vast tarief (€/u), op inkoop én verkoop.
//   • doordeweeks/zaterdag/zondag volgen uit de DATUMS van de dagregels;
//   • offshore/ploegendienst/buitenland zijn niet af te leiden → een AAN/UIT-vlag
//     per plaatsing; staat hij aan, dan geldt de toeslag over ALLE reguliere uren.
// Elke toeslag is (net als weekend) een EXTRA bedrag bovenop de basis-uren.
// ---------------------------------------------------------------------------

/** Alle zes toeslagen expliciet uit — de backcompat-nulstand. */
const TOESLAGEN_UIT = {
  weekdaySurchargeBuy: 0,
  weekdaySurchargeSell: 0,
  weekdaySurchargeUnit: "PCT",
  saturdaySurchargeBuy: 0,
  saturdaySurchargeSell: 0,
  saturdaySurchargeUnit: "PCT",
  sundaySurchargeBuy: 0,
  sundaySurchargeSell: 0,
  sundaySurchargeUnit: "PCT",
  offshoreEnabled: false,
  offshoreSurchargeBuy: 0,
  offshoreSurchargeSell: 0,
  offshoreSurchargeUnit: "PCT",
  shiftEnabled: false,
  shiftSurchargeBuy: 0,
  shiftSurchargeSell: 0,
  shiftSurchargeUnit: "PCT",
  abroadEnabled: false,
  abroadSurchargeBuy: 0,
  abroadSurchargeSell: 0,
  abroadSurchargeUnit: "PCT",
} satisfies Partial<SurchargeConfig>;

/** Ma..vr 8 u + za 6 u + zo 4 u = 58 u (40 doordeweeks, 6 zaterdag, 4 zondag). */
const WEEK = [
  ...[0, 1, 2, 3, 4].map((i) => ({ date: dag(i), hours: 8 })),
  { date: dag(5), hours: 6 },
  { date: dag(6), hours: 4 },
];

test("alle toeslagen op 0/uit → precies uren × tarief (backwards compatibel)", () => {
  const p = config({ costRate: 50, chargeRate: 70, ...TOESLAGEN_UIT });
  const geld = computeTimesheetMoney(
    { entries: WEEK, overtimeHours: null, kilometers: null },
    p,
  );

  assert.equal(geld.hours, 50); // 40 + 6 + 4
  assert.equal(geld.buy.total, 2500); // 50 × 50, geen cent extra
  assert.equal(geld.sell.total, 3500); // 50 × 70
  assert.equal(geld.buy.surcharges.length, 0);
  assert.equal(geld.sell.surchargeTotal, 0);
  assert.equal(geld.sell.weekend, 0);

  const regels = inkoopRegels(WEEK, { overtimeHours: null, kilometers: null }, p);
  assert.equal(regels.length, 1); // alleen de urenregel
  assert.equal(regelTotaal(regels), 2500);
});

test("zaterdagtoeslag 50% raakt alléén de zaterdaguren", () => {
  const p = config({
    ...TOESLAGEN_UIT,
    costRate: 50,
    chargeRate: 70,
    saturdaySurchargeBuy: 50,
    saturdaySurchargeSell: 50,
    saturdaySurchargeUnit: "PCT",
  });
  const geld = computeTimesheetMoney(
    { entries: WEEK, overtimeHours: null, kilometers: null },
    p,
  );

  // 6 zaterdaguren × 50% van €50 = 6 × €25 = €150 extra; de 44 andere uren niet.
  assert.equal(geld.buy.base, 2500);
  assert.equal(geld.buy.surchargeTotal, 150);
  assert.equal(geld.buy.total, 2650);
  assert.equal(geld.sell.surchargeTotal, 210); // 6 × 50% van €70 = 6 × €35
  assert.equal(geld.sell.total, 3710);

  const rijen = geld.buy.surcharges;
  assert.equal(rijen.length, 1);
  assert.equal(rijen[0].type, "saturday");
  assert.equal(rijen[0].label, "Zaterdagtoeslag 50%");
  assert.equal(rijen[0].hours, 6);
  assert.equal(rijen[0].unitAmount, 25);
  assert.equal(rijen[0].amount, 150);
  // Het za/zo-deel blijft als `weekend` zichtbaar voor de bestaande schermen.
  assert.equal(geld.buy.weekend, 150);
  assert.equal(regelTotaal(inkoopRegels(WEEK, { overtimeHours: null, kilometers: null }, p)), 2650);
});

test("zondagtoeslag als VAST tarief telt €/u op, niet een percentage", () => {
  const p = config({
    ...TOESLAGEN_UIT,
    costRate: 50,
    chargeRate: 70,
    sundaySurchargeSell: 10,
    sundaySurchargeUnit: "FIXED",
  });
  const geld = computeTimesheetMoney(
    { entries: WEEK, overtimeHours: null, kilometers: null },
    p,
  );

  // 4 zondaguren × €10 vast = €40 — géén 10% (dat zou €28 zijn).
  assert.equal(geld.sell.surchargeTotal, 40);
  assert.equal(geld.sell.surcharges[0].type, "sunday");
  assert.equal(geld.sell.surcharges[0].label, "Zondagtoeslag");
  assert.equal(geld.sell.surcharges[0].unitAmount, 10);
  assert.equal(geld.sell.total, 3540);
  // Inkoop staat op 0 → de freelancer krijgt niets extra, de marge groeit met €40.
  assert.equal(geld.buy.total, 2500);
  assert.equal(geld.margin, 1040);
});

test("offshoretoeslag geldt over ALLE reguliere uren zodra hij aanstaat", () => {
  const aan = config({
    ...TOESLAGEN_UIT,
    costRate: 50,
    chargeRate: 70,
    offshoreEnabled: true,
    offshoreSurchargeBuy: 20,
    offshoreSurchargeSell: 20,
    offshoreSurchargeUnit: "PCT",
  });
  const geld = computeTimesheetMoney(
    { entries: WEEK, overtimeHours: null, kilometers: null },
    aan,
  );

  // Alle 50 uur (dus óók za/zo) × 20% van €50 = 50 × €10 = €500.
  assert.equal(geld.buy.surcharges[0].type, "offshore");
  assert.equal(geld.buy.surcharges[0].hours, 50);
  assert.equal(geld.buy.surchargeTotal, 500);
  assert.equal(geld.buy.total, 3000);
  assert.equal(geld.sell.surchargeTotal, 700); // 50 × 20% van €70

  // Uit = geen cent toeslag, ook al staan de percentages ingevuld.
  const uit = config({ ...aan, offshoreEnabled: false });
  const geldUit = computeTimesheetMoney(
    { entries: WEEK, overtimeHours: null, kilometers: null },
    uit,
  );
  assert.equal(geldUit.buy.surchargeTotal, 0);
  assert.equal(geldUit.buy.total, 2500);
});

test("legacy weekendtoeslag blijft gelden zolang za/zo niet apart zijn gezet", () => {
  const p = config({ ...TOESLAGEN_UIT, chargeRate: 100, weekendSurchargeSell: 25 });
  const geld = computeTimesheetMoney(
    { entries: WEEK, overtimeHours: null, kilometers: null },
    p,
  );

  // 10 weekenduren (6 za + 4 zo) × 25% van €100 = €250 — zaterdag én zondag.
  assert.equal(geld.sell.weekend, 250);
  assert.equal(geld.sell.total, 5250);

  // Zodra zaterdag apart staat wint die; zondag valt nog terug op de legacy 25%.
  const gesplitst = config({ ...p, saturdaySurchargeSell: 50 });
  const geld2 = computeTimesheetMoney(
    { entries: WEEK, overtimeHours: null, kilometers: null },
    gesplitst,
  );
  assert.equal(geld2.sell.surcharges.length, 2);
  assert.equal(geld2.sell.surcharges[0].amount, 300); // za: 6 × 50% van €100
  assert.equal(geld2.sell.surcharges[1].type, "sunday");
  assert.equal(geld2.sell.surcharges[1].amount, 100); // zo: 4 × 25% van €100
  assert.equal(geld2.sell.weekend, 400);
});

test("elke toeslag krijgt zijn eigen factuurregel, en de regels tellen op tot het totaal", () => {
  const p = config({
    ...TOESLAGEN_UIT,
    costRate: 50,
    chargeRate: 70,
    weekdaySurchargeBuy: 5,
    weekdaySurchargeSell: 5,
    saturdaySurchargeBuy: 50,
    saturdaySurchargeSell: 50,
    sundaySurchargeBuy: 10,
    sundaySurchargeSell: 10,
    sundaySurchargeUnit: "FIXED",
    offshoreEnabled: true,
    offshoreSurchargeBuy: 20,
    offshoreSurchargeSell: 20,
    shiftEnabled: true,
    shiftSurchargeBuy: 2.5,
    shiftSurchargeSell: 2.5,
    shiftSurchargeUnit: "FIXED",
    abroadEnabled: true,
    abroadSurchargeBuy: 8,
    abroadSurchargeSell: 8,
  });
  const t = { overtimeHours: null, kilometers: null };
  const geld = computeTimesheetMoney({ entries: WEEK, ...t }, p);

  const regels = inkoopRegels(WEEK, t, p);
  const toeslagen = regels.filter((r) => r.lineKind === "SURCHARGE");
  assert.equal(regels.length, 7); // uren + zes toeslagen
  assert.deepEqual(
    toeslagen.map((r) => r.description),
    [
      "Toeslag doordeweeks 5%",
      "Zaterdagtoeslag 50%",
      "Zondagtoeslag",
      "Offshoretoeslag 20%",
      "Ploegendiensttoeslag",
      "Buitenlandtoeslag 8%",
    ],
  );
  assert.deepEqual(
    toeslagen.map((r) => [r.quantity, r.unitPrice, r.amount]),
    [
      [40, 2.5, 100], // doordeweeks: 40 u × 5% van €50
      [6, 25, 150], // zaterdag: 6 u × 50% van €50
      [4, 10, 40], // zondag: 4 u × €10 vast
      [50, 10, 500], // offshore: alle uren × 20% van €50
      [50, 2.5, 125], // ploegendienst: alle uren × €2,50 vast
      [50, 4, 200], // buitenland: alle uren × 8% van €50
    ],
  );
  assert.equal(geld.buy.surchargeTotal, 1115);
  assert.equal(regelTotaal(regels), geld.buy.total);
  assert.equal(regelTotaal(verkoopRegels(WEEK, t, p)), geld.sell.total);
});