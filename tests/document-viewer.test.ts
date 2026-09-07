import assert from "node:assert/strict";
import test from "node:test";
import {
  documentSoort,
  mimeVanBestandsnaam,
  veiligeBestandsnaam,
  veiligeWeergavenaam,
  wizardBestandUrl,
} from "../src/lib/document-viewer";

// ===========================================================================
// 1) SLEUTEL-CONTROLE — veiligeBestandsnaam
// ===========================================================================

const OPGESLAGEN = "0b7b7a0c-2f2a-4a10-9d9e-5f2b1c3d4e5f.pdf";

test("sleutel: een opgeslagen bestandsnaam (uuid + extensie) is geldig", () => {
  assert.equal(veiligeBestandsnaam(OPGESLAGEN), OPGESLAGEN);
  assert.equal(veiligeBestandsnaam(`  ${OPGESLAGEN}  `), OPGESLAGEN);
  assert.equal(veiligeBestandsnaam("factuur_2026-08.xlsx"), "factuur_2026-08.xlsx");
});

test("sleutel: alles wat uit de map kan wijzen wordt geweigerd", () => {
  for (const kwaad of [
    "../.env",
    "..\\..\\prisma\\dev.db",
    "_inbox/geheim.pdf",
    "sub/map/factuur.pdf",
    "sub\\map\\factuur.pdf",
    "/etc/passwd",
    "C:\\Windows\\win.ini",
    "..",
    "...",
    "a/../b.pdf",
    "%2e%2e%2fgeheim.pdf",
    "map%2Ffactuur.pdf",
    "factuur.pdf:stream",
    "a..b.pdf",
  ]) {
    assert.equal(veiligeBestandsnaam(kwaad), null, `moet geweigerd worden: ${kwaad}`);
  }
});

test("sleutel: leeg, ontbrekend of onzichtbaar is null", () => {
  assert.equal(veiligeBestandsnaam(""), null);
  assert.equal(veiligeBestandsnaam("   "), null);
  assert.equal(veiligeBestandsnaam(null), null);
  assert.equal(veiligeBestandsnaam(undefined), null);
  assert.equal(veiligeBestandsnaam("factuur\u0000.pdf"), null);
  assert.equal(veiligeBestandsnaam("factuur\n.pdf"), null);
  assert.equal(veiligeBestandsnaam(".verborgen"), null);
});

test("sleutel: absurd lange namen worden geweigerd", () => {
  assert.equal(veiligeBestandsnaam(`${"a".repeat(200)}.pdf`), null);
});

// ===========================================================================
// 2) MIME UIT DE EXTENSIE — mimeVanBestandsnaam
// ===========================================================================

test("mime: de bekende voorbeeldbare types komen uit de extensie", () => {
  assert.equal(mimeVanBestandsnaam("a.pdf"), "application/pdf");
  assert.equal(mimeVanBestandsnaam("a.PDF"), "application/pdf");
  assert.equal(mimeVanBestandsnaam("a.png"), "image/png");
  assert.equal(mimeVanBestandsnaam("a.jpg"), "image/jpeg");
  assert.equal(mimeVanBestandsnaam("a.jpeg"), "image/jpeg");
  assert.equal(mimeVanBestandsnaam("a.webp"), "image/webp");
  assert.equal(mimeVanBestandsnaam("a.gif"), "image/gif");
});

test("mime: alles wat we niet inline tonen blijft een download", () => {
  for (const naam of ["a.xlsx", "a.xls", "a.csv", "a.html", "a.svg", "a", "a.exe"]) {
    assert.equal(mimeVanBestandsnaam(naam), "application/octet-stream");
  }
});

// ===========================================================================
// 3) WELKE WEERGAVE — documentSoort
// ===========================================================================

test("weergave: pdf uit het mimetype én uit de bestandsnaam", () => {
  assert.equal(documentSoort("application/pdf", "staat.pdf"), "pdf");
  assert.equal(documentSoort("", "staat.PDF"), "pdf");
  assert.equal(documentSoort("application/octet-stream", "staat.pdf"), "pdf");
});

test("weergave: afbeeldingen worden als afbeelding getoond", () => {
  assert.equal(documentSoort("image/png", "scan.png"), "afbeelding");
  assert.equal(documentSoort("image/jpeg", "scan.jpg"), "afbeelding");
  assert.equal(documentSoort("", "scan.webp"), "afbeelding");
});

test("weergave: Excel, CSV en onbekend krijgen de terugvalkaart", () => {
  assert.equal(documentSoort("application/vnd.ms-excel", "uren.xls"), "geen-voorbeeld");
  assert.equal(documentSoort("text/csv", "uren.csv"), "geen-voorbeeld");
  assert.equal(documentSoort(null, null), "geen-voorbeeld");
  assert.equal(documentSoort("", ""), "geen-voorbeeld");
});

test("weergave: een gevaarlijk type wordt nooit inline getoond", () => {
  // text/html zou in een iframe uitgevoerd kunnen worden — altijd terugvallen.
  assert.equal(documentSoort("text/html", "factuur.html"), "geen-voorbeeld");
  assert.equal(documentSoort("image/svg+xml", "logo.svg"), "geen-voorbeeld");
});

// ===========================================================================
// 4) NAAM OM TE TONEN — veiligeWeergavenaam
// ===========================================================================

test("naam: een gewone bestandsnaam blijft staan", () => {
  assert.equal(veiligeWeergavenaam("Factuur augustus.pdf", "x.pdf"), "Factuur augustus.pdf");
});

test("naam: paden en regeleindes worden weggehaald, leeg valt terug", () => {
  assert.equal(veiligeWeergavenaam("../../geheim.pdf", "x.pdf"), "geheim.pdf");
  assert.equal(veiligeWeergavenaam("C:\\map\\factuur.pdf", "x.pdf"), "factuur.pdf");
  assert.equal(veiligeWeergavenaam("regel\r\neinde.pdf", "x.pdf"), "regeleinde.pdf");
  assert.equal(veiligeWeergavenaam("", "x.pdf"), "x.pdf");
  assert.equal(veiligeWeergavenaam(null, "x.pdf"), "x.pdf");
  assert.equal(veiligeWeergavenaam("   ", "x.pdf"), "x.pdf");
});

// ===========================================================================
// 5) DE URL VOOR DE WIZARD — wizardBestandUrl
// ===========================================================================

test("url: bouwt de route met sleutel en nette naam", () => {
  const url = wizardBestandUrl({ fileName: OPGESLAGEN, originalName: "Factuur augustus.pdf" });
  assert.equal(url, `/api/wizard-bestand?key=${OPGESLAGEN}&naam=Factuur%20augustus.pdf`);
});

test("url: zonder originele naam blijft de sleutel over", () => {
  assert.equal(wizardBestandUrl({ fileName: OPGESLAGEN }), `/api/wizard-bestand?key=${OPGESLAGEN}`);
});

test("url: een onveilige sleutel levert geen url op", () => {
  assert.equal(wizardBestandUrl({ fileName: "../.env" }), null);
  assert.equal(wizardBestandUrl({ fileName: "" }), null);
});
