import assert from "node:assert/strict";
import test from "node:test";
import { documentSoort, mimeVanBestandsnaam } from "../src/lib/document-viewer";

// ===========================================================================
// 1) MIME UIT DE EXTENSIE — mimeVanBestandsnaam
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
// 2) WELKE WEERGAVE — documentSoort
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
