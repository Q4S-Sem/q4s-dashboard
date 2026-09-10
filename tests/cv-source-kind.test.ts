import { test } from "node:test";
import assert from "node:assert/strict";
import { sniffSourceKind, resolveSourceKind } from "../src/lib/cv-extract";

// Een PDF/afbeelding uit een mail- of browser-preview belandt soms als
// "application/octet-stream" zonder .pdf in de naam in het sleepvak. Dan moet de
// inhoud (magische bytes) alsnog het juiste type bepalen.

test("sniffSourceKind herkent PDF aan %PDF-header", () => {
  const pdf = Buffer.from("%PDF-1.7\n...", "latin1");
  assert.equal(sniffSourceKind(pdf), "pdf");
});

test("sniffSourceKind herkent PNG en JPEG", () => {
  assert.equal(sniffSourceKind(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0])), "image");
  assert.equal(sniffSourceKind(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0])), "image");
});

test("sniffSourceKind geeft null voor onbekende/te korte inhoud", () => {
  assert.equal(sniffSourceKind(Buffer.from([0x00, 0x01])), null);
  assert.equal(sniffSourceKind(Buffer.from("gewoon tekst")), null);
});

test("resolveSourceKind: naam/mediatype wint, inhoud is terugval", () => {
  const pdfBytes = Buffer.from("%PDF-1.4", "latin1");
  // Kale naam + octet-stream → valt terug op de bytes.
  assert.equal(resolveSourceKind(pdfBytes, "bijlage", "application/octet-stream"), "pdf");
  // Correcte naam werkt sowieso.
  assert.equal(resolveSourceKind(Buffer.from([0]), "cv.pdf", ""), "pdf");
  // .docx blijft docx (zip-bytes worden niet als iets anders gezien).
  assert.equal(
    resolveSourceKind(Buffer.from([0x50, 0x4b, 0x03, 0x04]), "cv.docx", ""),
    "docx",
  );
});
