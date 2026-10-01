import assert from "node:assert/strict";
import test from "node:test";
import {
  DEADLINE_LABEL,
  TOLERANTIE_EUR,
  evaluateFacturatieWeek,
  ondertekenaarBevoegd,
  parseApproverNames,
  weekDeadline,
  type FacturatieCheckInput,
  type Check,
  type ComparisonRow,
} from "../src/lib/facturatie-checks";
import { formatCurrency } from "../src/lib/utils";

// ---------------------------------------------------------------------------
// De controle-machine achter "Week verwerken": één persoon, één week, alle
// controles. Puur, dus hier volledig af te dekken — en dat is de bedoeling: dit
// is de enige plek waar bepaald wordt of een week groen, fout, wachtend of niet
// ingeleverd is, en de eigenaar wil "fouten goed opsporen".
// ---------------------------------------------------------------------------

/** Maandag van ISO-week 40 van 2026 (gecontroleerd: 28-09-2026 is een maandag). */
const MAANDAG = new Date(2026, 8, 28);
const WEEK_KEY = "2026-W40";
/** Ruim binnen de deadline (dinsdag 12:00 ná de gewerkte week). */
const NU = new Date(2026, 9, 5, 9, 0, 0);

function dag(offset: number): string {
  const d = new Date(MAANDAG);
  d.setDate(d.getDate() + offset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Ma t/m vr 8 uur = 40 reguliere uren, geen weekend. */
function werkweek(): { date: string; hours: number }[] {
  return [0, 1, 2, 3, 4].map((i) => ({ date: dag(i), hours: 8 }));
}

/**
 * Een week die ALLES goed heeft: 40 uur ma–vr, een getekende staat van een
 * bevoegde, en een factuur van 40 × €60 = €2.400 + 21% btw.
 */
function basis(): FacturatieCheckInput {
  return {
    weekKey: WEEK_KEY,
    weekMonday: MAANDAG,
    now: NU,
    company: { companyName: "Q4S Project Partners" },
    consultant: {
      firstName: "Michał",
      lastName: "Wójcik",
      employmentType: "ZZP",
      iban: "NL02ABNA0123456789",
      kvkNumber: "12345678",
      vatNumber: "NL001234567B01",
      companyName: "Wójcik Inspections",
    },
    placement: {
      costRate: 60,
      chargeRate: 75,
      weekendSurchargeBuy: 0,
      weekendSurchargeSell: 0,
      overtimeSurchargeBuy: 0,
      overtimeSurchargeSell: 0,
      kmRateBuy: 0.23,
      kmRateSell: 0.23,
      poNumber: "4500123",
      vatReverseCharge: false,
      maxPaidHoursPerDay: null,
      approverNames: ["P. Jansen"],
      currency: "EUR",
      clientName: "Sif",
      workLocation: "Maasvlakte",
      hasClient: true,
    },
    timesheet: {
      days: werkweek(),
      overtimeHours: 0,
      kilometers: 0,
      travelHours: null,
      expenses: null,
      signaturePresent: true,
      signerName: "Piet Jansen",
      typedWeekNumber: 40,
      name: "Michał Wójcik",
      clientName: "Sif",
      projectName: null,
      location: "Maasvlakte",
      poNumber: "4500123",
      confidence: "high",
      pagesComplete: true,
      receivedAt: new Date(2026, 9, 5, 8, 0, 0),
    },
    invoice: {
      number: "2026-014",
      issueDate: new Date(2026, 9, 5),
      periodStart: MAANDAG,
      periodEnd: new Date(2026, 9, 4),
      hours: 40,
      hourlyRate: 60,
      overtimeHours: 0,
      surchargeLines: [],
      kilometers: 0,
      vatPercent: 21,
      vatShifted: false,
      currency: "EUR",
      addressee: "Q4S Project Partners B.V.",
      kvkNumber: "12345678",
      vatId: "NL001234567B01",
      iban: "NL02ABNA0123456789",
      poNumber: "4500123",
      mentionsAttachment: true,
      amountExclVat: 2400,
      totalAmount: 2904,
    },
    prior: {
      otherTimesheetDays: [],
      priorInvoices: [],
      recentAvgHours: 40,
      recentWeeks: 6,
    },
  };
}

function check(checks: Check[], id: string): Check {
  const found = checks.find((c) => c.id === id);
  assert.ok(found, `controle "${id}" ontbreekt; aanwezig: ${checks.map((c) => c.id).join(", ")}`);
  return found;
}

function fouten(checks: Check[]): string[] {
  return checks.filter((c) => c.level === "error").map((c) => c.id);
}

function rij(rows: ComparisonRow[], key: string): ComparisonRow {
  const found = rows.find((r) => r.key === key);
  assert.ok(found, `vergelijkingsregel "${key}" ontbreekt`);
  return found;
}

// ===========================================================================
// Deadline + losse hulpstukken
// ===========================================================================

test("deadline is de dinsdag 12:00 ná de gewerkte week", () => {
  const d = weekDeadline(MAANDAG);
  assert.equal(d.getDay(), 2, "moet een dinsdag zijn");
  assert.equal(d.getDate(), 6);
  assert.equal(d.getMonth(), 9); // oktober
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getHours(), 12);
  assert.equal(d.getMinutes(), 0);
  assert.match(DEADLINE_LABEL, /dinsdag/);
});

test("bevoegde ondertekenaars worden uit één komma-veld gelezen", () => {
  assert.deepEqual(parseApproverNames("P. Jansen, M. de Boer"), ["P. Jansen", "M. de Boer"]);
  assert.deepEqual(parseApproverNames("  P. Jansen ;; M. de Boer "), ["P. Jansen", "M. de Boer"]);
  assert.deepEqual(parseApproverNames(""), []);
  assert.deepEqual(parseApproverNames(null), []);
});

test("ondertekenaar matcht op achternaam + voorletter, niet op losse achternaam", () => {
  assert.equal(ondertekenaarBevoegd("Piet Jansen", ["P. Jansen"]), true);
  assert.equal(ondertekenaarBevoegd("P. Jansen", ["Piet Jansen"]), true);
  assert.equal(ondertekenaarBevoegd("Jansen", ["Piet Jansen"]), true);
  assert.equal(ondertekenaarBevoegd("Klaas Jansen", ["Piet Jansen"]), false);
  assert.equal(ondertekenaarBevoegd("Piet de Vries", ["Piet Jansen"]), false);
  assert.equal(ondertekenaarBevoegd("", ["Piet Jansen"]), false);
  assert.equal(ondertekenaarBevoegd("Piet Jansen", []), false);
});

// ===========================================================================
// De gelukkige week
// ===========================================================================

test("een volledig kloppende ZZP-week is KLAAR zonder fouten en zonder waarschuwingen", () => {
  const res = evaluateFacturatieWeek(basis());
  assert.equal(res.status, "KLAAR");
  assert.deepEqual(fouten(res.checks), []);
  assert.deepEqual(
    res.checks.filter((c) => c.level === "warn").map((c) => c.id),
    [],
  );
  assert.ok(res.checks.length > 10, "er horen alle controles in te zitten, niet alleen de fouten");
  assert.ok(res.comparison.every((r) => r.ok));
});

test("alle controles hebben een id, een Nederlandse titel en een concrete toelichting", () => {
  const res = evaluateFacturatieWeek(basis());
  const ids = new Set<string>();
  for (const c of res.checks) {
    assert.ok(c.id && !ids.has(c.id), `dubbel of leeg controle-id: ${c.id}`);
    ids.add(c.id);
    assert.ok(["timesheet", "factuur", "match", "contract", "fraude"].includes(c.group));
    assert.ok(["ok", "warn", "error"].includes(c.level));
    assert.ok(c.title.trim().length > 0);
    assert.ok(c.detail.trim().length > 0);
  }
});

test("de vergelijkingstabel bevat de regels uit het ontwerp", () => {
  const res = evaluateFacturatieWeek(basis());
  const keys = res.comparison.map((r) => r.key);
  for (const k of ["uren", "overuren", "weekend", "kilometers", "reiskosten", "uurtarief"]) {
    assert.ok(keys.includes(k), `regel ${k} ontbreekt (${keys.join(", ")})`);
  }
  assert.equal(rij(res.comparison, "uren").timesheet, "40");
  assert.equal(rij(res.comparison, "uren").invoice, "40");
  assert.equal(rij(res.comparison, "uurtarief").contract, formatCurrency(60));
});

// ===========================================================================
// Statusregels
// ===========================================================================

test("niets ingeleverd = NIET_INGELEVERD, met de verstreken deadline als waarschuwing", () => {
  const input = { ...basis(), timesheet: null, invoice: null, now: new Date(2026, 9, 7, 9, 0) };
  const res = evaluateFacturatieWeek(input);
  assert.equal(res.status, "NIET_INGELEVERD");
  assert.equal(check(res.checks, "timesheet-tijdig").level, "warn");
});

test("ZZP met urenstaat maar zonder factuur = WACHT (waarschuwing, geen fout)", () => {
  const res = evaluateFacturatieWeek({ ...basis(), invoice: null });
  assert.equal(res.status, "WACHT");
  assert.deepEqual(fouten(res.checks), []);
  assert.equal(check(res.checks, "factuur-ontbreekt").level, "warn");
});

test("een medewerker in dienst heeft geen factuur nodig en is dus KLAAR", () => {
  const input = basis();
  input.consultant.employmentType = "LOONDIENST";
  input.invoice = null;
  const res = evaluateFacturatieWeek(input);
  assert.equal(res.status, "KLAAR");
  assert.deepEqual(fouten(res.checks), []);
  assert.ok(
    !res.checks.some((c) => c.group === "factuur"),
    "voor loondienst horen er geen factuurcontroles te zijn",
  );
});

test("een fout maakt de week FOUT; waarschuwingen alleen blokkeren niet", () => {
  const input = basis();
  input.timesheet!.signaturePresent = false;
  const res = evaluateFacturatieWeek(input);
  assert.equal(res.status, "FOUT");
  assert.equal(check(res.checks, "timesheet-handtekening").level, "error");
});

test("bewust geaccepteerde fouten blokkeren niet meer, maar blijven zichtbaar", () => {
  const input = basis();
  input.timesheet!.signaturePresent = false;
  input.acceptedErrors = true;
  const res = evaluateFacturatieWeek(input);
  assert.equal(res.status, "KLAAR");
  assert.equal(check(res.checks, "timesheet-handtekening").level, "error");
});

test("iets ingeleverd zonder actieve plaatsing is FOUT met 'geen actieve plaatsing'", () => {
  const res = evaluateFacturatieWeek({ ...basis(), placement: null });
  assert.equal(res.status, "FOUT");
  const c = check(res.checks, "contract-plaatsing");
  assert.equal(c.level, "error");
  assert.match(c.title.toLowerCase(), /plaatsing/);
});

// ===========================================================================
// Timesheet-controles
// ===========================================================================

test("geen handtekening is een fout; een onbekende handtekening een waarschuwing", () => {
  const zonder = basis();
  zonder.timesheet!.signaturePresent = false;
  assert.equal(check(evaluateFacturatieWeek(zonder).checks, "timesheet-handtekening").level, "error");

  const onbekend = basis();
  onbekend.timesheet!.signaturePresent = null;
  assert.equal(
    check(evaluateFacturatieWeek(onbekend).checks, "timesheet-handtekening").level,
    "warn",
  );
});

test("een ondertekenaar die niet op de plaatsing staat is een fout", () => {
  const input = basis();
  input.timesheet!.signerName = "Henk Willems";
  const c = check(evaluateFacturatieWeek(input).checks, "timesheet-ondertekenaar");
  assert.equal(c.level, "error");
  assert.match(c.detail, /Henk Willems/);
  assert.match(c.detail, /P\. Jansen/);
});

test("zonder vastgelegde bevoegden kan bevoegdheid niet gecontroleerd worden: waarschuwing", () => {
  const input = basis();
  input.placement!.approverNames = [];
  const c = check(evaluateFacturatieWeek(input).checks, "timesheet-ondertekenaar");
  assert.equal(c.level, "warn");
});

test("een afwijkend getypt weeknummer is een waarschuwing met beide nummers", () => {
  const input = basis();
  input.timesheet!.typedWeekNumber = 41;
  const c = check(evaluateFacturatieWeek(input).checks, "timesheet-weeknummer");
  assert.equal(c.level, "warn");
  assert.match(c.detail, /41/);
  assert.match(c.detail, /40/);
  assert.equal(evaluateFacturatieWeek(input).status, "KLAAR", "een weeknummer blokkeert niet");
});

test("een weektotaal buiten de bandbreedte is een fout, een uitschieter een waarschuwing", () => {
  const buiten = basis();
  buiten.timesheet!.days = [0, 1, 2, 3, 4, 5, 6].map((i) => ({ date: dag(i), hours: 10 }));
  const c = check(evaluateFacturatieWeek(buiten).checks, "timesheet-urenband");
  assert.equal(c.level, "error");
  assert.match(c.detail, /70/);

  const uitschieter = basis();
  uitschieter.timesheet!.days = [0, 1, 2, 3, 4, 5].map((i) => ({ date: dag(i), hours: 9 }));
  uitschieter.prior.recentAvgHours = 20;
  uitschieter.prior.recentWeeks = 8;
  assert.equal(
    check(evaluateFacturatieWeek(uitschieter).checks, "timesheet-urenband").level,
    "warn",
  );
});

test("met te weinig historie wordt er niet tegen het eigen gemiddelde gemeten", () => {
  const input = basis();
  input.prior.recentAvgHours = 10;
  input.prior.recentWeeks = 2;
  assert.equal(check(evaluateFacturatieWeek(input).checks, "timesheet-urenband").level, "ok");
});

test("pauze niet verrekend: een dag boven het contractmaximum is een fout", () => {
  const input = basis();
  input.placement!.maxPaidHoursPerDay = 11.5;
  input.timesheet!.days = [0, 1, 2, 3, 4, 5].map((i) => ({ date: dag(i), hours: 12 }));
  const c = check(evaluateFacturatieWeek(input).checks, "timesheet-pauze");
  assert.equal(c.level, "error");
  assert.match(c.detail, /12/);
  assert.match(c.detail, /11,5/);
});

test("zonder contractmaximum wordt er niet op pauze gecontroleerd", () => {
  const input = basis();
  input.timesheet!.days = [0, 1, 2, 3, 4].map((i) => ({ date: dag(i), hours: 12 }));
  assert.equal(check(evaluateFacturatieWeek(input).checks, "timesheet-pauze").level, "ok");
});

test("lange dagen zonder opgegeven overuren is een waarschuwing als het contract overuren kent", () => {
  const input = basis();
  input.placement!.overtimeSurchargeBuy = 10;
  input.placement!.overtimeSurchargeSell = 10;
  input.timesheet!.days = [0, 1, 2, 3, 4].map((i) => ({ date: dag(i), hours: 9 }));
  input.timesheet!.overtimeHours = 0;
  input.invoice!.hours = 45;
  input.invoice!.amountExclVat = 2700;
  input.invoice!.totalAmount = 3267;
  const c = check(evaluateFacturatieWeek(input).checks, "timesheet-overuren");
  assert.equal(c.level, "warn");
  assert.match(c.detail, /9/);
});

test("zonder overuren-afspraak levert een lange dag geen overuren-waarschuwing op", () => {
  const input = basis();
  input.timesheet!.days = [0, 1, 2, 3, 4].map((i) => ({ date: dag(i), hours: 9 }));
  input.invoice!.hours = 45;
  input.invoice!.amountExclVat = 2700;
  input.invoice!.totalAmount = 3267;
  assert.equal(check(evaluateFacturatieWeek(input).checks, "timesheet-overuren").level, "ok");
});

test("weekenduren worden automatisch gesplitst en gemeld als het contract een toeslag kent", () => {
  const input = basis();
  input.placement!.saturdaySurchargeBuy = 50;
  input.placement!.saturdaySurchargeSell = 50;
  input.timesheet!.days = [...werkweek(), { date: dag(5), hours: 8 }];
  input.invoice!.hours = 48;
  input.invoice!.amountExclVat = 3120; // 48 × 60 + 8 × 30 zaterdagtoeslag
  input.invoice!.totalAmount = 3775.2;
  input.invoice!.surchargeLines = [
    { label: "Zaterdagtoeslag 50%", quantity: 8, unit: "uur", amount: 240 },
  ];
  const c = check(evaluateFacturatieWeek(input).checks, "timesheet-weekend");
  assert.equal(c.level, "warn");
  assert.match(c.detail, /8/);
  assert.equal(rij(evaluateFacturatieWeek(input).comparison, "weekend").timesheet, "8");
});

test("feestdaguren tellen mee als weekend-/feestdaguren (Tweede Kerstdag)", () => {
  const input = basis();
  // Week 52 van 2026: maandag 21-12-2026; Eerste Kerstdag valt op vrijdag 25-12.
  const kerstMaandag = new Date(2026, 11, 21);
  input.weekKey = "2026-W52";
  input.weekMonday = kerstMaandag;
  input.placement!.saturdaySurchargeBuy = 50;
  input.timesheet!.typedWeekNumber = 52;
  input.timesheet!.days = [0, 1, 2, 3, 4].map((i) => {
    const d = new Date(kerstMaandag);
    d.setDate(d.getDate() + i);
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      hours: 8,
    };
  });
  input.invoice = null;
  const c = check(evaluateFacturatieWeek(input).checks, "timesheet-weekend");
  assert.equal(c.level, "warn");
  assert.match(c.detail, /feestdag/i);
});

test("een andere klant of locatie op de staat dan op de plaatsing is een fout", () => {
  const input = basis();
  input.timesheet!.clientName = "Heerema";
  const c = check(evaluateFacturatieWeek(input).checks, "timesheet-project");
  assert.equal(c.level, "error");
  assert.match(c.detail, /Heerema/);
  assert.match(c.detail, /Sif/);
});

test("een afwijkende PO op de staat is een fout, maar 'Sif Group' naast 'Sif' niet", () => {
  const po = basis();
  po.timesheet!.poNumber = "4500999";
  assert.equal(check(evaluateFacturatieWeek(po).checks, "timesheet-project").level, "error");

  const ruimer = basis();
  ruimer.timesheet!.clientName = "Sif Group B.V.";
  assert.equal(check(evaluateFacturatieWeek(ruimer).checks, "timesheet-project").level, "ok");
});

test("kilometers zonder kilometervergoeding in het contract is een waarschuwing", () => {
  const input = basis();
  input.placement!.kmRateBuy = 0;
  input.placement!.kmRateSell = 0;
  input.timesheet!.kilometers = 220;
  input.invoice!.kilometers = 220;
  const c = check(evaluateFacturatieWeek(input).checks, "timesheet-reiskosten");
  assert.equal(c.level, "warn");
  assert.match(c.detail, /220/);
});

test("kilometers én reisuren/onkosten door elkaar levert een waarschuwing op", () => {
  const input = basis();
  input.timesheet!.kilometers = 220;
  input.timesheet!.travelHours = 4;
  input.invoice!.kilometers = 220;
  input.invoice!.amountExclVat = 2450.6;
  input.invoice!.totalAmount = 2965.23;
  const c = check(evaluateFacturatieWeek(input).checks, "timesheet-reiskosten");
  assert.equal(c.level, "warn");
  assert.match(c.detail, /reis/i);
});

test("dezelfde dag al op een andere urenstaat is een fout", () => {
  const input = basis();
  input.prior.otherTimesheetDays = [dag(2)];
  const c = check(evaluateFacturatieWeek(input).checks, "timesheet-dubbel");
  assert.equal(c.level, "error");
  assert.match(c.detail, /30-09-2026/);
});

test("na de deadline ingeleverd is alleen een waarschuwing", () => {
  const input = basis();
  input.timesheet!.receivedAt = new Date(2026, 9, 6, 13, 0); // di 13:00, net te laat
  input.now = new Date(2026, 9, 7, 10, 0);
  const c = check(evaluateFacturatieWeek(input).checks, "timesheet-tijdig");
  assert.equal(c.level, "warn");
  assert.equal(evaluateFacturatieWeek(input).status, "KLAAR");
});

test("een onleesbare of incomplete staat is een fout", () => {
  const laag = basis();
  laag.timesheet!.confidence = "low";
  assert.equal(check(evaluateFacturatieWeek(laag).checks, "timesheet-leesbaar").level, "error");

  const paginas = basis();
  paginas.timesheet!.pagesComplete = false;
  assert.equal(check(evaluateFacturatieWeek(paginas).checks, "timesheet-leesbaar").level, "error");
});

test("een naam op de staat die niet bij de medewerker hoort is een fout", () => {
  const input = basis();
  input.timesheet!.name = "Jan Bakker";
  const c = check(evaluateFacturatieWeek(input).checks, "timesheet-naam");
  assert.equal(c.level, "error");
  assert.match(c.detail, /Jan Bakker/);
});

test("diakrieten in de naam zijn geen afwijking", () => {
  const input = basis();
  input.timesheet!.name = "Michal Wojcik";
  assert.equal(check(evaluateFacturatieWeek(input).checks, "timesheet-naam").level, "ok");
});

// ===========================================================================
// Factuur-controles (alleen ZZP)
// ===========================================================================

test("een ontbrekende of afwijkende PO op de factuur is een fout", () => {
  const leeg = basis();
  leeg.invoice!.poNumber = null;
  const a = check(evaluateFacturatieWeek(leeg).checks, "factuur-po");
  assert.equal(a.level, "error");
  assert.match(a.detail, /4500123/);

  const anders = basis();
  anders.invoice!.poNumber = "4500999";
  assert.equal(check(evaluateFacturatieWeek(anders).checks, "factuur-po").level, "error");
});

test("zonder PO op de plaatsing is er geen PO-controle", () => {
  const input = basis();
  input.placement!.poNumber = null;
  input.invoice!.poNumber = null;
  assert.equal(check(evaluateFacturatieWeek(input).checks, "factuur-po").level, "ok");
});

test("een factuur die niet aan Q4S gericht is, is een fout", () => {
  const input = basis();
  input.invoice!.addressee = "Heerema Marine Contractors";
  const c = check(evaluateFacturatieWeek(input).checks, "factuur-geadresseerde");
  assert.equal(c.level, "error");
  assert.match(c.detail, /Heerema/);
});

test("een ontbrekend factuurnummer is een fout, een hergebruikt nummer ook", () => {
  const leeg = basis();
  leeg.invoice!.number = null;
  assert.equal(check(evaluateFacturatieWeek(leeg).checks, "factuur-nummer").level, "error");

  const dubbel = basis();
  dubbel.prior.priorInvoices = [
    { number: "2026-014", periodStart: new Date(2026, 8, 21), periodEnd: new Date(2026, 8, 27) },
  ];
  const c = check(evaluateFacturatieWeek(dubbel).checks, "factuur-nummer");
  assert.equal(c.level, "error");
  assert.match(c.detail, /2026-014/);
});

test("een uurtarief dat afwijkt van het contract is een fout met beide tarieven", () => {
  const input = basis();
  input.invoice!.hourlyRate = 65;
  input.invoice!.amountExclVat = 2600;
  input.invoice!.totalAmount = 3146;
  const c = check(evaluateFacturatieWeek(input).checks, "factuur-tarief");
  assert.equal(c.level, "error");
  assert.ok(c.detail.includes(formatCurrency(65)));
  assert.ok(c.detail.includes(formatCurrency(60)));
  assert.equal(rij(evaluateFacturatieWeek(input).comparison, "uurtarief").ok, false);
});

test("afwijkende uren op de factuur zijn een fout met 'x vs y'", () => {
  const input = basis();
  input.invoice!.hours = 44;
  input.invoice!.amountExclVat = 2640;
  input.invoice!.totalAmount = 3194.4;
  const c = check(evaluateFacturatieWeek(input).checks, "factuur-uren");
  assert.equal(c.level, "error");
  assert.match(c.detail, /40/);
  assert.match(c.detail, /44/);
  assert.equal(rij(evaluateFacturatieWeek(input).comparison, "uren").ok, false);
});

test("afwijkende overuren op de factuur zijn een fout (8 vs 10)", () => {
  const input = basis();
  input.placement!.overtimeSurchargeBuy = 10;
  input.placement!.overtimeSurchargeSell = 10;
  input.timesheet!.overtimeHours = 8;
  input.invoice!.overtimeHours = 10;
  const c = check(evaluateFacturatieWeek(input).checks, "factuur-overuren");
  assert.equal(c.level, "error");
  assert.match(c.detail, /8/);
  assert.match(c.detail, /10/);
  assert.equal(rij(evaluateFacturatieWeek(input).comparison, "overuren").ok, false);
});

test("21% btw is de norm; verlegde btw zonder afspraak is een fout", () => {
  const input = basis();
  input.invoice!.vatShifted = true;
  input.invoice!.vatPercent = 0;
  input.invoice!.totalAmount = 2400;
  const c = check(evaluateFacturatieWeek(input).checks, "factuur-btw");
  assert.equal(c.level, "error");
  assert.match(c.detail, /verlegd/i);
});

test("met btw-verlegd op de plaatsing is 21% btw juist de fout", () => {
  const verlegd = basis();
  verlegd.placement!.vatReverseCharge = true;
  verlegd.invoice!.vatShifted = true;
  verlegd.invoice!.vatPercent = 0;
  verlegd.invoice!.totalAmount = 2400;
  assert.equal(check(evaluateFacturatieWeek(verlegd).checks, "factuur-btw").level, "ok");

  const metBtw = basis();
  metBtw.placement!.vatReverseCharge = true;
  assert.equal(check(evaluateFacturatieWeek(metBtw).checks, "factuur-btw").level, "error");
});

test("een buitenlands btw-nummer verwacht ook verlegde btw", () => {
  const input = basis();
  input.consultant.vatNumber = "PL1234567890";
  input.invoice!.vatId = "PL1234567890";
  const c = check(evaluateFacturatieWeek(input).checks, "factuur-btw");
  assert.equal(c.level, "error");
  assert.match(c.detail, /verlegd/i);
});

test("ontbrekende KvK- of btw-gegevens op de factuur zijn een fout", () => {
  const input = basis();
  input.invoice!.kvkNumber = null;
  input.invoice!.vatId = "   ";
  const c = check(evaluateFacturatieWeek(input).checks, "factuur-bedrijfsgegevens");
  assert.equal(c.level, "error");
  assert.match(c.detail, /KvK/);
  assert.match(c.detail, /btw/i);
});

test("een factuurperiode over meerdere weken zonder specificatie is een waarschuwing", () => {
  const input = basis();
  input.invoice!.periodStart = new Date(2026, 8, 14);
  input.invoice!.periodEnd = new Date(2026, 9, 4);
  const c = check(evaluateFacturatieWeek(input).checks, "factuur-periode");
  assert.equal(c.level, "warn");
  assert.match(c.detail, /3/);
});

test("een periode die deze week al eerder gefactureerd is, is een fout", () => {
  const input = basis();
  input.prior.priorInvoices = [
    { number: "2026-001", periodStart: MAANDAG, periodEnd: new Date(2026, 9, 4) },
  ];
  const c = check(evaluateFacturatieWeek(input).checks, "factuur-dubbele-facturatie");
  assert.equal(c.level, "error");
  assert.match(c.detail, /2026-001/);
});

test("een andere valuta dan afgesproken is een fout", () => {
  const input = basis();
  input.invoice!.currency = "GBP";
  const c = check(evaluateFacturatieWeek(input).checks, "factuur-valuta");
  assert.equal(c.level, "error");
  assert.match(c.detail, /GBP/);
  assert.match(c.detail, /EUR/);
});

test("een factuur zonder urenstaat van die week mist zijn onderbouwing: fout", () => {
  const res = evaluateFacturatieWeek({ ...basis(), timesheet: null });
  assert.equal(res.status, "FOUT");
  assert.equal(check(res.checks, "factuur-bijlage").level, "error");
});

test("toeslag-dagen die afwijken van de staat zijn een fout (offshore 4 vs 5)", () => {
  const input = basis();
  input.placement!.offshoreEnabled = true;
  input.placement!.offshoreSurchargeBuy = 25;
  input.placement!.offshoreSurchargeUnit = "FIXED";
  input.placement!.offshoreSurchargeSell = 30;
  input.placement!.offshoreSurchargeSellUnit = "FIXED";
  // Vier gewerkte dagen van 10 uur = dezelfde 40 uur, maar hij factureert 5 dagen.
  input.timesheet!.days = [0, 1, 2, 3].map((i) => ({ date: dag(i), hours: 10 }));
  input.invoice!.surchargeLines = [
    { label: "Offshoretoeslag", quantity: 5, unit: "dagen", amount: 1000 },
  ];
  const res = evaluateFacturatieWeek(input);
  const c = check(res.checks, "factuur-toeslagen");
  assert.equal(c.level, "error");
  assert.match(c.detail, /5/);
  assert.match(c.detail, /offshore/i);
  const r = rij(res.comparison, "toeslag-offshore");
  assert.equal(r.timesheet, "4 dagen");
  assert.equal(r.invoice, "5 dagen");
  assert.equal(r.ok, false);
});

test("een toeslag op de factuur die niet in het contract staat is een fout", () => {
  const input = basis();
  input.invoice!.surchargeLines = [
    { label: "Offshoretoeslag", quantity: 5, unit: "dagen", amount: 1000 },
  ];
  const c = check(evaluateFacturatieWeek(input).checks, "factuur-toeslagen");
  assert.equal(c.level, "error");
  assert.match(c.detail, /niet in het contract|niet afgesproken/i);
});

test("een afgesproken toeslag die hij vergat te factureren is een waarschuwing", () => {
  const input = basis();
  input.placement!.saturdaySurchargeBuy = 50;
  input.timesheet!.days = [...werkweek(), { date: dag(5), hours: 8 }];
  input.invoice!.hours = 48;
  input.invoice!.amountExclVat = 2880;
  input.invoice!.totalAmount = 3484.8;
  const c = check(evaluateFacturatieWeek(input).checks, "factuur-toeslagen");
  assert.equal(c.level, "warn");
  assert.match(c.detail, /zaterdag/i);
});

test("het factuurtotaal wordt tegen computeTimesheetMoney gelegd, met €1 tolerantie", () => {
  const binnen = basis();
  binnen.invoice!.amountExclVat = 2400.5;
  binnen.invoice!.totalAmount = 2904.6;
  assert.equal(check(evaluateFacturatieWeek(binnen).checks, "factuur-totaal").level, "ok");
  assert.equal(TOLERANTIE_EUR, 1);

  const buiten = basis();
  buiten.invoice!.amountExclVat = 2450;
  buiten.invoice!.totalAmount = 2964.5;
  const c = check(evaluateFacturatieWeek(buiten).checks, "factuur-totaal");
  assert.equal(c.level, "error");
  assert.ok(c.detail.includes(formatCurrency(2450)));
  assert.ok(c.detail.includes(formatCurrency(2400)));
});

test("het verwachte inkoopbedrag rekent de toeslagen en kilometers mee", () => {
  const input = basis();
  input.placement!.saturdaySurchargeBuy = 50;
  input.timesheet!.days = [...werkweek(), { date: dag(5), hours: 8 }];
  input.timesheet!.kilometers = 100;
  input.invoice!.kilometers = 100;
  input.invoice!.surchargeLines = [
    { label: "Zaterdagtoeslag 50%", quantity: 8, unit: "uur", amount: 240 },
  ];
  // 48 × 60 = 2880 + zaterdagtoeslag 8 × 30 = 240 + 100 km × 0,23 = 23 → 3143
  input.invoice!.hours = 48;
  input.invoice!.amountExclVat = 3143;
  input.invoice!.totalAmount = 3803.03;
  assert.equal(check(evaluateFacturatieWeek(input).checks, "factuur-totaal").level, "ok");
});

test("verlegde btw wordt niet dubbel van het factuurtotaal afgetrokken", () => {
  const input = basis();
  input.placement!.vatReverseCharge = true;
  input.invoice!.vatShifted = true;
  input.invoice!.vatPercent = 0;
  input.invoice!.amountExclVat = 0;
  input.invoice!.totalAmount = 2400;
  assert.equal(check(evaluateFacturatieWeek(input).checks, "factuur-totaal").level, "ok");
});

// ===========================================================================
// Koppeling + fraude
// ===========================================================================

test("een factuurperiode die de gewerkte week niet dekt is een fout", () => {
  const input = basis();
  input.invoice!.periodStart = new Date(2026, 9, 5);
  input.invoice!.periodEnd = new Date(2026, 9, 11);
  const c = check(evaluateFacturatieWeek(input).checks, "match-week");
  assert.equal(c.level, "error");
  assert.match(c.title.toLowerCase(), /periode|week/);
});

test("een ander IBAN dan geregistreerd is altijd een fout met een telefonische verificatie", () => {
  const input = basis();
  input.invoice!.iban = "NL91RABO0300000000";
  const c = check(evaluateFacturatieWeek(input).checks, "fraude-iban");
  assert.equal(c.level, "error");
  assert.equal(c.group, "fraude");
  assert.match(c.title, /IBAN/);
  assert.match(c.detail, /telefonisch/i);
  assert.equal(evaluateFacturatieWeek(input).status, "FOUT");
});

test("een IBAN met spaties of kleine letters is hetzelfde IBAN", () => {
  const input = basis();
  input.invoice!.iban = "nl02 abna 0123 4567 89";
  assert.equal(check(evaluateFacturatieWeek(input).checks, "fraude-iban").level, "ok");
});

test("zonder geregistreerd IBAN kan er niets vergeleken worden: waarschuwing", () => {
  const input = basis();
  input.consultant.iban = null;
  const c = check(evaluateFacturatieWeek(input).checks, "fraude-iban");
  assert.equal(c.level, "warn");
});

// ===========================================================================
// Contract-controles
// ===========================================================================

test("een niet-positieve marge is een contractfout", () => {
  const input = basis();
  input.placement!.chargeRate = 55;
  const c = check(evaluateFacturatieWeek(input).checks, "contract-marge");
  assert.equal(c.level, "error");
  assert.equal(c.group, "contract");
});

test("toeslagen en kilometers maken de marge niet vals negatief", () => {
  // Een offshore-week: de toeslag geldt aan BEIDE kanten, dus de marge blijft
  // gezond. Een "factuurbedrag ÷ uren"-benadering zou hier €85/u inkoop tegen
  // €75/u verkoop zetten en onterecht alarm slaan.
  const input = basis();
  input.placement!.offshoreEnabled = true;
  input.placement!.offshoreSurchargeBuy = 25;
  input.placement!.offshoreSurchargeUnit = "FIXED";
  input.placement!.offshoreSurchargeSell = 35;
  input.placement!.offshoreSurchargeSellUnit = "FIXED";
  input.timesheet!.kilometers = 500;
  input.invoice!.kilometers = 500;
  const c = check(evaluateFacturatieWeek(input).checks, "contract-marge");
  assert.equal(c.level, "ok");
  // 40 × (75 + 35) = 4400 verkoop tegenover 40 × (60 + 25) = 3400 inkoop,
  // kilometers 1-op-1 (500 × €0,23 aan beide kanten) → marge € 1.000,00.
  assert.ok(c.detail.includes(formatCurrency(1000)), c.detail);
});

test("zonder uren wordt alleen het tariefverschil getoetst", () => {
  const input = { ...basis(), timesheet: null, invoice: null };
  const c = check(evaluateFacturatieWeek(input).checks, "contract-marge");
  assert.equal(c.level, "ok");
  assert.match(c.detail, /geen uren/i);
});

test("een plaatsing zonder klant kan niet gefactureerd worden: fout", () => {
  const input = basis();
  input.placement!.hasClient = false;
  const c = check(evaluateFacturatieWeek(input).checks, "contract-klant");
  assert.equal(c.level, "error");
});

test("ontbrekende tarieven zijn een contractfout", () => {
  const input = basis();
  input.placement!.costRate = 0;
  const c = check(evaluateFacturatieWeek(input).checks, "contract-tarieven");
  assert.equal(c.level, "error");
});

// ===========================================================================
// Robuustheid — rommelige invoer mag nooit een uitzondering geven
// ===========================================================================

test("een lege uitlezing geeft nette controles in plaats van een crash", () => {
  const input = basis();
  input.timesheet = {
    days: [],
    overtimeHours: null,
    kilometers: null,
    travelHours: null,
    expenses: null,
    signaturePresent: null,
    signerName: null,
    typedWeekNumber: null,
    name: null,
    clientName: null,
    projectName: null,
    location: null,
    poNumber: null,
    confidence: null,
    pagesComplete: null,
    receivedAt: null,
  };
  input.invoice = {
    number: null,
    issueDate: null,
    periodStart: null,
    periodEnd: null,
    hours: null,
    hourlyRate: null,
    overtimeHours: null,
    surchargeLines: [],
    kilometers: null,
    vatPercent: null,
    vatShifted: null,
    currency: null,
    addressee: null,
    kvkNumber: null,
    vatId: null,
    iban: null,
    poNumber: null,
    mentionsAttachment: null,
    amountExclVat: null,
    totalAmount: null,
  };
  const res = evaluateFacturatieWeek(input);
  assert.equal(res.status, "FOUT");
  assert.ok(res.checks.length > 10);
  assert.ok(res.comparison.length > 0);
  // Geen enkele controle mag een lege of "undefined"-tekst opleveren.
  for (const c of res.checks) {
    assert.ok(!/undefined|NaN|null/.test(c.detail), `onnette toelichting: ${c.id} — ${c.detail}`);
  }
});

test("dezelfde invoer geeft altijd exact dezelfde uitkomst (puur en deterministisch)", () => {
  const a = evaluateFacturatieWeek(basis());
  const b = evaluateFacturatieWeek(basis());
  assert.deepEqual(a, b);
});

test("dinsdag 11:59 is op tijd, dinsdag 12:01 is te laat", () => {
  const leeg = { ...basis(), timesheet: null, invoice: null };
  assert.equal(check(evaluateFacturatieWeek({ ...leeg, now: new Date(2026, 9, 6, 11, 59) }).checks, "timesheet-tijdig").level, "ok");
  assert.equal(check(evaluateFacturatieWeek({ ...leeg, now: new Date(2026, 9, 6, 12, 1) }).checks, "timesheet-tijdig").level, "warn");
});
