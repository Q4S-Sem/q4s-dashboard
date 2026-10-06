import { test } from "node:test";
import assert from "node:assert/strict";
import { strFromU8, unzipSync } from "fflate";
import { koppelFacturen, type Inkoop, type VerkoopDeel } from "../src/lib/factuuroverzicht";
import { excelDatum, vulBlad, vulSjabloon } from "../src/lib/excel-sjabloon";

const d = (s: string) => new Date(`${s}T00:00:00`);
const ink = (id: string, weken: number[], datum = "2026-09-20"): Inkoop => ({
  consultantId: id, naam: id, datum: d(datum), nummer: `F-${id}`, ex: 100, btw: 21, betaaldOp: null, weken,
});
const ver = (id: string, weken: number[]): VerkoopDeel => ({
  consultantId: id, naam: id, klant: "HSM", nummer: `V-${id}`, status: "SENT", ex: 150, btwPct: 0.21,
  datum: d("2026-09-25"), verstuurdOp: d("2026-09-25"), betaaldOp: null, weken,
});

test("koppelFacturen: zelfde persoon + overlappende week; rest krijgt eigen regel", () => {
  const r = koppelFacturen([ink("a", [38, 39]), ink("b", [39])], [ver("a", [39]), ver("c", [39])]);
  assert.equal(r.length, 3);
  assert.equal(r.find((x) => x.inkoop?.consultantId === "a")?.verkoop?.nummer, "V-a");
  assert.equal(r.find((x) => x.inkoop?.consultantId === "b")?.verkoop, null);
  assert.equal(r.find((x) => !x.inkoop)?.verkoop?.nummer, "V-c");
});

test("vulBlad: waarde in bestaande cel, opmaak blijft; tekst wordt ge-escaped", () => {
  const xml = '<row r="6"><c r="A6" s="45" t="n" /><c r="B6" s="9"><f>X</f><v></v></c><c r="C6" s="47" t="n" /></row>';
  const uit = vulBlad(xml, { A6: d("2026-01-01"), C6: "Jan & <Piet>" });
  assert.match(uit, new RegExp(`<c r="A6" s="45"><v>${excelDatum(d("2026-01-01"))}</v></c>`));
  assert.match(uit, /<c r="B6" s="9"><f>X<\/f>/);
  assert.match(uit, /Jan &amp; &lt;Piet&gt;/);
  assert.equal(excelDatum(d("2026-01-01")), 46023);
});

test("vulSjabloon: echt sjabloon wordt gevuld en blijft een geldig xlsx", () => {
  const z = unzipSync(vulSjabloon({ Overzicht: { C1: "Factuuroverzicht Q3 2026", H4: 2026 }, Facturen: { C6: "Jordy" } }));
  assert.match(strFromU8(z["xl/worksheets/sheet1.xml"]), /Factuuroverzicht Q3 2026/);
  assert.match(strFromU8(z["xl/worksheets/sheet2.xml"]), /<c r="C6" s="\d+" t="inlineStr"><is><t xml:space="preserve">Jordy/);
});
