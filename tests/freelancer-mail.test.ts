import assert from "node:assert/strict";
import test from "node:test";
import {
  buildFreelancerDiscrepancyEmail,
  type FreelancerDiscrepancyInput,
} from "../src/lib/freelancer-mail";
import { formatCurrency, formatHours } from "../src/lib/utils";

// ---------------------------------------------------------------------------
// buildFreelancerDiscrepancyEmail — de INHOUD van de mail aan de freelancer.
//
// Puur: gestructureerde gegevens in, Nederlandse tekst uit. Geen Prisma, geen
// verzending, geen datum-van-nu. Deze tests leggen de vier takken vast die het
// weekoverzicht kan opleveren (bedrag klopt niet / uren kloppen niet / met en
// zonder eigen bevinding / met en zonder kilometers) plus de puurheid zelf.
// ---------------------------------------------------------------------------

/** Een volledig gevuld geval; elke test past aan wat hij nodig heeft. */
function invoer(overrides: Partial<FreelancerDiscrepancyInput> = {}): FreelancerDiscrepancyInput {
  return {
    freelancerName: "Jan de Vries",
    weekLabel: "Week 12 · 2026",
    invoiceNumber: "2026-014",
    hoursTimesheet: 38,
    hoursInvoice: 42,
    expectedAmount: 1710,
    invoiceAmount: 1890,
    expectedRate: 45,
    impliedRate: 45,
    kmInfo: null,
    autoFlags: [],
    eigenNotitie: null,
    ...overrides,
  };
}

/** Alle tekstregels van de mail als één blok — makkelijk zoeken in een test. */
function tekst(mail: ReturnType<typeof buildFreelancerDiscrepancyEmail>): string {
  return [
    mail.subject,
    mail.greeting,
    ...mail.bodyLines,
    ...mail.sections.flatMap((s) => [s.title, ...s.lines]),
    ...mail.summary.map((r) => `${r.label}: ${r.value}`),
    mail.signature,
  ].join("\n");
}

// ---------------------------------------------------------------------------
// Onderwerp, aanhef en afsluiting
// ---------------------------------------------------------------------------

test("onderwerp en aanhef gebruiken het factuurnummer, de week en de voornaam", () => {
  const mail = buildFreelancerDiscrepancyEmail(invoer());

  assert.equal(mail.subject, "Vraag over je factuur 2026-014 — Week 12 · 2026");
  assert.equal(mail.greeting, "Beste Jan,");
  assert.equal(mail.signature, "Met vriendelijke groet,\nTeam Q4S");
});

test("zonder factuurnummer gaat de mail over de weekstaat en niet over een factuur", () => {
  const mail = buildFreelancerDiscrepancyEmail(invoer({ invoiceNumber: null }));

  assert.equal(mail.subject, "Vraag over je weekstaat — Week 12 · 2026");
  assert.ok(!tekst(mail).includes("factuur 2026-014"));
  assert.ok(!mail.summary.some((r) => r.label === "Factuurnummer"));
});

test("een lege naam levert een nette aanhef op in plaats van 'Beste ,'", () => {
  const mail = buildFreelancerDiscrepancyEmail(invoer({ freelancerName: "   " }));

  assert.equal(mail.greeting, "Beste,");
});

// ---------------------------------------------------------------------------
// Tak 1 — het bedrag klopt niet
// ---------------------------------------------------------------------------

test("een verschil in bedrag noemt beide bedragen én het verschil", () => {
  const mail = buildFreelancerDiscrepancyEmail(
    invoer({ hoursInvoice: null, expectedAmount: 1710, invoiceAmount: 1890 }),
  );
  const alles = tekst(mail);

  assert.ok(alles.includes(formatCurrency(1710)), "verwacht bedrag ontbreekt");
  assert.ok(alles.includes(formatCurrency(1890)), "gefactureerd bedrag ontbreekt");
  assert.ok(alles.includes(formatCurrency(180)), "het verschil ontbreekt");
  assert.deepEqual(
    mail.summary.find((r) => r.label === "Verschil"),
    { label: "Verschil", value: formatCurrency(180) },
  );
});

test("gelijke bedragen leveren geen verschil-zin en geen verschil-regel op", () => {
  const mail = buildFreelancerDiscrepancyEmail(
    invoer({ hoursInvoice: 38, expectedAmount: 1710, invoiceAmount: 1710, impliedRate: 45 }),
  );

  assert.ok(!mail.bodyLines.some((l) => l.includes("een verschil van")));
  assert.ok(!mail.summary.some((r) => r.label === "Verschil"));
});

// ---------------------------------------------------------------------------
// Tak 2 — de uren kloppen niet
// ---------------------------------------------------------------------------

test("een verschil in uren wordt apart benoemd, ook zonder bedragen", () => {
  const mail = buildFreelancerDiscrepancyEmail(
    invoer({
      hoursTimesheet: 38,
      hoursInvoice: 42,
      expectedAmount: null,
      invoiceAmount: null,
      expectedRate: null,
      impliedRate: null,
    }),
  );
  const alles = tekst(mail);

  assert.ok(alles.includes(`${formatHours(38)} uur`), "uren van de weekstaat ontbreken");
  assert.ok(alles.includes(`${formatHours(42)} uur`), "uren van de factuur ontbreken");
  assert.ok(alles.includes(`${formatHours(4)} uur`), "het urenverschil ontbreekt");
  assert.ok(!alles.includes("€"), "zonder bedragen hoort er geen bedrag in de mail te staan");
});

test("een afwijkend uurtarief wordt uitgelegd naast het afgesproken tarief", () => {
  const mail = buildFreelancerDiscrepancyEmail(invoer({ expectedRate: 45, impliedRate: 49.74 }));
  const tarief = mail.bodyLines.find((l) => l.includes("uurtarief"));

  assert.ok(tarief, "er hoort een zin over het uurtarief in te staan");
  assert.ok(tarief!.includes(formatCurrency(49.74)));
  assert.ok(tarief!.includes(formatCurrency(45)));
});

test("een gelijk uurtarief levert geen tariefzin op", () => {
  const mail = buildFreelancerDiscrepancyEmail(invoer({ expectedRate: 45, impliedRate: 45 }));

  assert.ok(!mail.bodyLines.some((l) => l.includes("uurtarief")));
});

// ---------------------------------------------------------------------------
// Tak 3 — de eigen bevinding van HR
// ---------------------------------------------------------------------------

test("de eigen bevinding van HR komt als apart geciteerd blok in de mail", () => {
  const mail = buildFreelancerDiscrepancyEmail(
    invoer({ eigenNotitie: "  Je hebt zaterdag 8 uur geschreven,\n\nmaar er was geen weekenddienst.  " }),
  );
  const blok = mail.sections.find((s) => s.quoted);

  assert.ok(blok, "er hoort een geciteerd blok te staan");
  assert.equal(blok!.title, "Onze eigen bevinding");
  assert.deepEqual(blok!.lines, [
    "Je hebt zaterdag 8 uur geschreven,",
    "maar er was geen weekenddienst.",
  ]);
});

test("zonder eigen bevinding staat er geen leeg notitieblok in de mail", () => {
  const zonder = buildFreelancerDiscrepancyEmail(invoer({ eigenNotitie: null }));
  const leeg = buildFreelancerDiscrepancyEmail(invoer({ eigenNotitie: "   \n  " }));

  assert.ok(!zonder.sections.some((s) => s.quoted));
  assert.ok(!leeg.sections.some((s) => s.quoted));
});

test("de automatische controlemeldingen komen ongewijzigd in een eigen blok", () => {
  const flags = ["uren 42 u wijken af van het gemiddelde 38 u", "factuurnummer 2026-014 kwam eerder langs"];
  const mail = buildFreelancerDiscrepancyEmail(invoer({ autoFlags: flags }));
  const blok = mail.sections.find((s) => s.title === "Wat onze controle opmerkte");

  assert.ok(blok, "de controlemeldingen horen in een eigen blok");
  assert.deepEqual(blok!.lines, flags);
  assert.ok(!blok!.quoted);
});

test("zonder controlemeldingen en zonder verschillen blijft de mail neutraal", () => {
  const mail = buildFreelancerDiscrepancyEmail(
    invoer({
      hoursInvoice: 38,
      expectedAmount: null,
      invoiceAmount: null,
      expectedRate: null,
      impliedRate: null,
      autoFlags: [],
    }),
  );

  assert.equal(mail.sections.length, 0);
  assert.ok(mail.bodyLines.some((l) => l.includes("even met je afstemmen")));
});

// ---------------------------------------------------------------------------
// Tak 4 — kilometers
// ---------------------------------------------------------------------------

test("kilometers komen alleen in de mail als ze zijn meegegeven", () => {
  const met = buildFreelancerDiscrepancyEmail(invoer({ kmInfo: "312 km gemeld op de weekstaat" }));
  const zonder = buildFreelancerDiscrepancyEmail(invoer({ kmInfo: null }));

  assert.ok(tekst(met).includes("312 km gemeld op de weekstaat"));
  assert.deepEqual(
    met.summary.find((r) => r.label === "Kilometers"),
    { label: "Kilometers", value: "312 km gemeld op de weekstaat" },
  );
  assert.ok(!zonder.summary.some((r) => r.label === "Kilometers"));
  assert.ok(!tekst(zonder).toLowerCase().includes("kilometer"));
});

// ---------------------------------------------------------------------------
// De samenvattingstabel
// ---------------------------------------------------------------------------

test("de samenvatting laat onbekende velden weg in plaats van een streepje te tonen", () => {
  const mail = buildFreelancerDiscrepancyEmail(
    invoer({
      invoiceNumber: null,
      hoursInvoice: null,
      expectedAmount: null,
      invoiceAmount: null,
      expectedRate: null,
      impliedRate: null,
    }),
  );

  assert.deepEqual(
    mail.summary.map((r) => r.label),
    ["Week", "Uren op de weekstaat"],
  );
});

// ---------------------------------------------------------------------------
// Puurheid
// ---------------------------------------------------------------------------

test("de functie is puur: gelijke invoer geeft gelijke uitvoer en raakt de invoer niet aan", () => {
  const input = invoer({
    autoFlags: ["uren wijken af van het gemiddelde"],
    eigenNotitie: "Graag een aangepaste factuur.",
    kmInfo: "312 km",
  });
  const kopie = JSON.parse(JSON.stringify(input));

  const eerste = buildFreelancerDiscrepancyEmail(input);
  const tweede = buildFreelancerDiscrepancyEmail(input);

  assert.deepEqual(eerste, tweede);
  assert.deepEqual(JSON.parse(JSON.stringify(input)), kopie, "de invoer is gewijzigd");

  // De uitvoer is van de aanroeper: eraan sleutelen mag de volgende mail niet raken.
  eerste.bodyLines.push("gesleutel");
  eerste.sections[0].lines.push("gesleutel");
  assert.deepEqual(buildFreelancerDiscrepancyEmail(input), tweede);
});
