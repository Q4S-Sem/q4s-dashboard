import assert from "node:assert/strict";
import test from "node:test";
import {
  DUBBELE_FACTUUR_LABEL,
  DUBBELE_WEEKSTAAT_LABEL,
  EERST_CORRIGEREN_LABEL,
  WACHT_OP_MENS_LABEL,
  bouwControleRegel,
  magScanVerwijderen,
  veiligTerugPad,
  type ControleRijInvoer,
} from "../src/lib/week-detail";

// ---------------------------------------------------------------------------
// magScanVerwijderen — mag deze binnengekomen scan weg?
//
// Alleen de RUWE scan (het inbox-item + het bestand) mag verdwijnen, en alleen
// zolang er nog geen urenstaat aan hangt. Een geboekte/gefactureerde week raken
// we nooit aan.
// ---------------------------------------------------------------------------

test("een uitgelezen scan zonder urenstaat mag weg", () => {
  const oordeel = magScanVerwijderen({
    status: "EXTRACTED",
    timesheetId: null,
    timesheetStatus: null,
  });
  assert.equal(oordeel.mag, true);
  assert.notEqual(oordeel.reden.trim(), "");
});

test("een nog niet uitgelezen of afgewezen scan mag ook weg", () => {
  assert.equal(
    magScanVerwijderen({ status: "NEW", timesheetId: null, timesheetStatus: null }).mag,
    true,
  );
  assert.equal(
    magScanVerwijderen({ status: "REJECTED", timesheetId: null, timesheetStatus: null }).mag,
    true,
  );
});

test("een scan die al tot een urenstaat is bevestigd mag NIET weg", () => {
  const oordeel = magScanVerwijderen({
    status: "CONFIRMED",
    timesheetId: null,
    timesheetStatus: null,
  });
  assert.equal(oordeel.mag, false);
  assert.match(oordeel.reden, /urenstaat/i);
});

test("een goedgekeurde urenstaat blokkeert het verwijderen", () => {
  const oordeel = magScanVerwijderen({
    status: "CONFIRMED",
    timesheetId: "ts_1",
    timesheetStatus: "APPROVED",
  });
  assert.equal(oordeel.mag, false);
  assert.match(oordeel.reden, /goedgekeurd/i);
});

test("een gefactureerde week blokkeert het verwijderen en zegt dat het om een factuur gaat", () => {
  const oordeel = magScanVerwijderen({
    status: "CONFIRMED",
    timesheetId: "ts_1",
    timesheetStatus: "INVOICED",
  });
  assert.equal(oordeel.mag, false);
  assert.match(oordeel.reden, /factuur/i);
});

test("ook een concept-urenstaat blokkeert: er hangt dan al iets aan de scan", () => {
  for (const timesheetStatus of ["DRAFT", "SUBMITTED", null]) {
    const oordeel = magScanVerwijderen({
      status: "EXTRACTED",
      timesheetId: "ts_1",
      timesheetStatus,
    });
    assert.equal(oordeel.mag, false, `status ${timesheetStatus} zou moeten blokkeren`);
  }
});

test("een onbekende of ontbrekende status is behoudend: niet verwijderen", () => {
  assert.equal(magScanVerwijderen({ status: null, timesheetId: null, timesheetStatus: null }).mag, false);
  assert.equal(magScanVerwijderen({ status: "", timesheetId: null, timesheetStatus: null }).mag, false);
  assert.equal(
    magScanVerwijderen({ status: "GEBOEKT", timesheetId: null, timesheetStatus: null }).mag,
    false,
  );
});

test("de status wordt hoofdletterongevoelig en zonder spaties gelezen", () => {
  assert.equal(
    magScanVerwijderen({ status: " extracted ", timesheetId: "  ", timesheetStatus: "" }).mag,
    true,
  );
});

// ---------------------------------------------------------------------------
// veiligTerugPad — waar de verwijderknop je daarna heen stuurt
// ---------------------------------------------------------------------------

test("een gewoon pad binnen de app blijft staan", () => {
  assert.equal(veiligTerugPad("/verwerken/week?verwijderd=1", "/inbox"), "/verwerken/week?verwijderd=1");
  assert.equal(veiligTerugPad("/", "/inbox"), "/");
});

test("een adres buiten de app valt terug op de standaard", () => {
  assert.equal(veiligTerugPad("https://voorbeeld.test/x", "/inbox"), "/inbox");
  assert.equal(veiligTerugPad("//voorbeeld.test/x", "/inbox"), "/inbox");
  assert.equal(veiligTerugPad("/\\voorbeeld.test", "/inbox"), "/inbox");
  assert.equal(veiligTerugPad("verwerken/week", "/inbox"), "/inbox");
});

test("leeg, niet-tekst of met witruimte/regeleinde → standaard", () => {
  assert.equal(veiligTerugPad("", "/inbox"), "/inbox");
  assert.equal(veiligTerugPad(null, "/inbox"), "/inbox");
  assert.equal(veiligTerugPad(undefined, "/inbox"), "/inbox");
  assert.equal(veiligTerugPad(42, "/inbox"), "/inbox");
  assert.equal(veiligTerugPad("/verwerken/week\nSet-Cookie: x", "/inbox"), "/inbox");
  assert.equal(veiligTerugPad("/verwerken week", "/inbox"), "/inbox");
});

// ---------------------------------------------------------------------------
// bouwControleRegel — één compacte regel in de lijst "Te controleren"
// ---------------------------------------------------------------------------

const BASIS: ControleRijInvoer = {
  id: "inbox_1",
  name: "Jan de Vries",
  placementTitle: "QC-inspecteur",
  clientName: "Shell Moerdijk",
  weekLabel: "Week 12 · 2026",
  totalHours: 42,
  placementId: "pl_1",
  charge: 2100,
  flags: [{ level: "warn", message: "weektotaal 42 u wijkt af van het eigen gemiddelde (36 u)" }],
  duplicateExists: false,
  canApprove: true,
};

test("de regel wijst naar de detailpagina van dezelfde scan", () => {
  assert.equal(bouwControleRegel(BASIS).href, "/verwerken/week/inbox_1");
});

test("naam, initialen, rol en week staan klaar voor de lijst", () => {
  const regel = bouwControleRegel(BASIS);
  assert.equal(regel.naam, "Jan de Vries");
  assert.equal(regel.initialen, "JV");
  assert.equal(regel.rol, "QC-inspecteur · Shell Moerdijk");
  assert.equal(regel.weekLabel, "Week 12 · 2026");
  assert.equal(regel.uren, 42);
  assert.equal(regel.verkoop, 2100);
});

test("zonder plaatsing is er geen verkoopbedrag en zegt de regel dat er geen klant is", () => {
  const regel = bouwControleRegel({
    ...BASIS,
    placementId: null,
    placementTitle: null,
    clientName: null,
    charge: 0,
    weekLabel: null,
    canApprove: false,
  });
  assert.equal(regel.verkoop, null);
  assert.match(regel.rol, /nog niet gekoppeld/i);
  assert.match(regel.weekLabel, /onbekend/i);
});

test("een harde fout is herkenbaar aan de rand-kleur van de regel", () => {
  assert.equal(bouwControleRegel(BASIS).hardeFout, false);
  assert.equal(
    bouwControleRegel({
      ...BASIS,
      flags: [{ level: "error", message: "geen actieve plaatsing gevonden" }],
    }).hardeFout,
    true,
  );
});

test("de badge boven de regel is hetzelfde korte fouttype als op het weekoverzicht", () => {
  const regel = bouwControleRegel(BASIS);
  assert.deepEqual(regel.badges[0], { label: "uren wijken af", level: "warn" });
});

test("een dubbele weekstaat krijgt een eigen badge — maar nooit twee keer", () => {
  const uitGate = bouwControleRegel({
    ...BASIS,
    duplicateExists: true,
    flags: [{ level: "error", message: "dubbele weekstaat voor deze plaatsing en week" }],
  });
  assert.deepEqual(
    uitGate.badges.filter((b) => b.label === DUBBELE_WEEKSTAAT_LABEL),
    [{ label: DUBBELE_WEEKSTAAT_LABEL, level: "error" }],
  );

  // Ook als de gate er (nog) niets over zegt, hoort de dubbele staat op de regel.
  const alleenVlag = bouwControleRegel({ ...BASIS, duplicateExists: true });
  assert.ok(alleenVlag.badges.some((b) => b.label === DUBBELE_WEEKSTAAT_LABEL));
  assert.equal(alleenVlag.badges.length, 2);
});

test("een mogelijk dubbele factuur en een terugkerende fout komen er als extra badge bij", () => {
  const regel = bouwControleRegel(BASIS, {
    dubbeleFactuur: true,
    herhalingLabel: "3e keer uren wijken af",
  });
  const labels = regel.badges.map((b) => b.label);
  assert.ok(labels.includes(DUBBELE_FACTUUR_LABEL));
  assert.ok(labels.includes("3e keer uren wijken af"));
});

test("een week die eerst gecorrigeerd moet worden zegt dat met een badge", () => {
  const regel = bouwControleRegel({ ...BASIS, canApprove: false });
  assert.ok(regel.badges.some((b) => b.label === EERST_CORRIGEREN_LABEL && b.level === "error"));
});

test("zonder enige melding blijft er altijd één badge over: er moet een mens naar kijken", () => {
  const regel = bouwControleRegel({ ...BASIS, flags: [] });
  assert.deepEqual(regel.badges, [{ label: WACHT_OP_MENS_LABEL, level: "warn" }]);
});

test("dezelfde badge verschijnt nooit dubbel", () => {
  const regel = bouwControleRegel(
    { ...BASIS, duplicateExists: true, flags: [{ level: "error", message: "dubbele weekstaat" }] },
    { herhalingLabel: DUBBELE_WEEKSTAAT_LABEL },
  );
  const aantal = regel.badges.filter((b) => b.label === DUBBELE_WEEKSTAAT_LABEL).length;
  assert.equal(aantal, 1);
});
