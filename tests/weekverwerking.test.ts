import assert from "node:assert/strict";
import test from "node:test";
import {
  controleLabel,
  foutTypeVanMelding,
  initialen,
  namenLijst,
  telWeekBedragen,
  type WeekBedragen,
} from "../src/lib/weekverwerking";

// ---------------------------------------------------------------------------
// foutTypeVanMelding — de letterlijke gate-melding terug naar een kort fouttype
// ---------------------------------------------------------------------------

test("een onzekere uitlezing levert altijd hetzelfde fouttype op", () => {
  assert.equal(foutTypeVanMelding("confidence laag"), "onzekere uitlezing");
  assert.equal(
    foutTypeVanMelding("confidence gemiddeld — alleen 'hoog' gaat automatisch door"),
    "onzekere uitlezing",
  );
  assert.equal(foutTypeVanMelding("confidence ontbreekt"), "onzekere uitlezing");
});

test("een ontbrekende plaatsing en een niet-eenduidige plaatsing zijn verschillende fouten", () => {
  assert.equal(foutTypeVanMelding("geen actieve plaatsing gevonden"), "geen plaatsing");
  assert.equal(
    foutTypeVanMelding("geen plaatsing gekoppeld aan deze weekstaat"),
    "geen plaatsing",
  );
  assert.equal(
    foutTypeVanMelding("meerdere actieve plaatsingen gevonden (2) — kies handmatig de juiste"),
    "plaatsing niet eenduidig",
  );
});

test("uren-meldingen splitsen in 'niet uitgelezen', 'buiten bandbreedte' en 'wijken af'", () => {
  assert.equal(foutTypeVanMelding("geen weektotaal uitgelezen"), "geen uren uitgelezen");
  assert.equal(
    foutTypeVanMelding("weektotaal 72 u valt buiten de bandbreedte 0–60 u"),
    "uren buiten bandbreedte",
  );
  assert.equal(
    foutTypeVanMelding("0 uren terwijl het gemiddelde 38 u is (laatste 4 weken)"),
    "uren wijken af",
  );
  assert.equal(
    foutTypeVanMelding(
      "uren 80 u is ~2,1x hoger dan het gemiddelde van 38 u (laatste 4 weken)",
    ),
    "uren wijken af",
  );
});

test("een dubbele weekstaat en een margeprobleem krijgen hun eigen fouttype", () => {
  assert.equal(
    foutTypeVanMelding("dubbele weekstaat voor deze plaatsing en week"),
    "dubbele weekstaat",
  );
  assert.equal(foutTypeVanMelding("tarieven onbekend — marge niet te bepalen"), "marge klopt niet");
  assert.equal(
    foutTypeVanMelding("marge niet positief (inkoop € 70,00 ≥ verkoop € 65,00)"),
    "marge klopt niet",
  );
});

test("hoofdletters en randspaties maken niet uit", () => {
  assert.equal(
    foutTypeVanMelding("  Dubbele Weekstaat voor deze plaatsing en week  "),
    "dubbele weekstaat",
  );
});

// De vlaggen van de AI-uitlezing (TimesheetInbox.reviewFlags, zie inbox-extract.ts)
// zijn de ENIGE fouten die bewaard blijven — daarop draait de herhaal-detectie.
test("de vlaggen van de AI-uitlezing krijgen dezelfde soort fouttypes", () => {
  assert.equal(
    foutTypeVanMelding("Opgeteld dagtotaal (38 u) wijkt af van het vermelde totaal (40 u)."),
    "dagtotaal wijkt af",
  );
  assert.equal(
    foutTypeVanMelding("Kilometer-optelling (220 km) wijkt af van het vermelde totaal (200 km)."),
    "kilometers wijken af",
  );
  assert.equal(
    foutTypeVanMelding("Geen gewerkte uren gevonden — controleer de staat."),
    "geen uren uitgelezen",
  );
  assert.equal(
    foutTypeVanMelding("Ongebruikelijk veel uren (85 u) voor één week — controleer."),
    "uren wijken af",
  );
  assert.equal(
    foutTypeVanMelding("Geen medewerker automatisch gematcht — controleer de naam/plaatsing."),
    "geen medewerker gematcht",
  );
  assert.equal(
    foutTypeVanMelding("De AI was onzeker over deze uitlezing — controleer alles goed."),
    "onzekere uitlezing",
  );
});

test("een melding die we niet kennen levert bewust géén fouttype op", () => {
  assert.equal(foutTypeVanMelding("de scan stond op z'n kop"), null);
  assert.equal(foutTypeVanMelding(""), null);
  assert.equal(foutTypeVanMelding("   "), null);
});

// ---------------------------------------------------------------------------
// controleLabel — één korte badge boven de week
// ---------------------------------------------------------------------------

test("zonder vlaggen is er niets te labelen", () => {
  assert.equal(controleLabel([]), null);
});

test("de badge volgt de enige vlag die er is", () => {
  assert.deepEqual(
    controleLabel([
      { level: "warn", message: "uren 80 u is ~2,1x hoger dan het gemiddelde van 38 u (laatste 4 weken)" },
    ]),
    { label: "uren wijken af", level: "warn" },
  );
});

test("een harde fout wint van een waarschuwing, ook als die later staat", () => {
  assert.deepEqual(
    controleLabel([
      { level: "warn", message: "confidence gemiddeld — alleen 'hoog' gaat automatisch door" },
      { level: "error", message: "geen actieve plaatsing gevonden" },
    ]),
    { label: "geen plaatsing", level: "error" },
  );
});

test("bij meerdere harde fouten telt de eerste — de volgorde van de gate is de rangorde", () => {
  assert.deepEqual(
    controleLabel([
      { level: "error", message: "geen actieve plaatsing gevonden" },
      { level: "error", message: "dubbele weekstaat voor deze plaatsing en week" },
    ]),
    { label: "geen plaatsing", level: "error" },
  );
});

test("een onbekende melding krijgt een neutrale badge, geen verzonnen fouttype", () => {
  assert.deepEqual(controleLabel([{ level: "error", message: "de scan stond op z'n kop" }]), {
    label: "nakijken",
    level: "error",
  });
});

// ---------------------------------------------------------------------------
// telWeekBedragen — de weekcijfers optellen zonder Float-ruis
// ---------------------------------------------------------------------------

const NUL: WeekBedragen = { hours: 0, charge: 0, cost: 0, margin: 0 };

test("niets optellen levert nullen op", () => {
  assert.deepEqual(telWeekBedragen([]), NUL);
});

test("de delen worden opgeteld en op centen afgerond", () => {
  assert.deepEqual(
    telWeekBedragen([
      { hours: 0.1, charge: 0.1, cost: 0.2, margin: -0.1 },
      { hours: 0.2, charge: 0.2, cost: 0.1, margin: 0.1 },
    ]),
    { hours: 0.3, charge: 0.3, cost: 0.3, margin: 0 },
  );
});

test("een enkel deel komt er ongewijzigd uit", () => {
  const deel: WeekBedragen = { hours: 38.5, charge: 3080, cost: 2695, margin: 385 };
  assert.deepEqual(telWeekBedragen([deel]), deel);
});

// ---------------------------------------------------------------------------
// namenLijst — de namen in de "ontbreekt nog"-strip
// ---------------------------------------------------------------------------

test("geen namen levert een lege tekst op", () => {
  assert.equal(namenLijst([]), "");
});

test("één, twee en drie namen lezen als gewoon Nederlands", () => {
  assert.equal(namenLijst(["Jan de Vries"]), "Jan de Vries");
  assert.equal(namenLijst(["Jan de Vries", "Piet Bakker"]), "Jan de Vries en Piet Bakker");
  assert.equal(
    namenLijst(["Jan de Vries", "Piet Bakker", "Ahmed Ben Ali"]),
    "Jan de Vries, Piet Bakker en Ahmed Ben Ali",
  );
});

test("boven het maximum wordt de rest samengevat, enkelvoud en meervoud correct", () => {
  assert.equal(namenLijst(["Jan", "Piet", "Klaas"], 2), "Jan, Piet en 1 ander");
  assert.equal(namenLijst(["Jan", "Piet", "Klaas", "Ahmed"], 2), "Jan, Piet en 2 anderen");
});

test("lege en witruimte-namen tellen niet mee", () => {
  assert.equal(namenLijst(["Jan", "  ", "", "Piet"]), "Jan en Piet");
  assert.equal(namenLijst(["  ", ""]), "");
});

// ---------------------------------------------------------------------------
// initialen — het rondje vóór de naam in de controlelijst
// ---------------------------------------------------------------------------

test("initialen zijn de eerste letter van de voor- en achternaam", () => {
  assert.equal(initialen("Piet Jansen"), "PJ");
  assert.equal(initialen("Jan de Vries"), "JV");
  assert.equal(initialen("  jan   de   vries  "), "JV");
});

test("één naam levert de eerste twee letters op", () => {
  assert.equal(initialen("Ahmed"), "AH");
  assert.equal(initialen("X"), "X");
});

test("zonder naam blijft het rondje leeg maar niet stuk", () => {
  assert.equal(initialen(""), "?");
  assert.equal(initialen("   "), "?");
});
