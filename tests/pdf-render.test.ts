import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PDF_RENDER_DPI,
  clampDpi,
  envRenderDpi,
  isPdfMediaType,
  renderPdfFirstPageToPng,
  renderScale,
} from "../src/lib/pdf-render";
import { shouldRasterizePdf } from "../src/lib/ai";

// ---------------------------------------------------------------------------
// Gescande urenstaten worden fout uitgelezen als de PDF ruw naar het vision-model
// gaat (het model rendert intern op lage resolutie → kolommen schuiven). We
// rasteren PDF's daarom zelf op hoge dpi. Hier testen we de pure beslislogica:
// PDF → renderen, afbeelding → ongewijzigd doorsturen, plus de dpi/schaal-grenzen.
// Onderaan staat een echte smoke-test: pdf-lib maakt een A4'tje, pdfjs +
// @napi-rs/canvas rasteren dat naar PNG.
// ---------------------------------------------------------------------------

/** Klein A4'tje met tekst — genoeg om de hele keten (parsen → rasteren) te raken. */
async function smallPdf(): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4 in punten
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("Urenstaat week 25", { x: 60, y: 760, size: 24, font, color: rgb(0, 0, 0) });
  page.drawRectangle({ x: 60, y: 600, width: 400, height: 120, borderWidth: 2 });
  return doc.save();
}

test("PDF wordt gerasterd, een afbeelding gaat ongewijzigd door", () => {
  assert.equal(shouldRasterizePdf("application/pdf"), true);
  assert.equal(shouldRasterizePdf("image/png"), false);
  assert.equal(shouldRasterizePdf("image/jpeg"), false);
  assert.equal(shouldRasterizePdf(""), false);
});

test("PDF_VISION_RASTER=0 zet het rasteren uit (oud gedrag)", () => {
  const prev = process.env.PDF_VISION_RASTER;
  try {
    process.env.PDF_VISION_RASTER = "0";
    assert.equal(shouldRasterizePdf("application/pdf"), false);
    process.env.PDF_VISION_RASTER = "1";
    assert.equal(shouldRasterizePdf("application/pdf"), true);
  } finally {
    if (prev === undefined) delete process.env.PDF_VISION_RASTER;
    else process.env.PDF_VISION_RASTER = prev;
  }
});

test("isPdfMediaType tolereert hoofdletters en een charset-suffix", () => {
  assert.equal(isPdfMediaType("Application/PDF"), true);
  assert.equal(isPdfMediaType(" application/pdf; charset=binary "), true);
  assert.equal(isPdfMediaType("application/pdfx"), false);
  assert.equal(isPdfMediaType(null), false);
});

test("clampDpi houdt de dpi binnen 72–600 en valt terug op de standaard", () => {
  assert.equal(clampDpi(300), 300);
  assert.equal(clampDpi(10), 72);
  assert.equal(clampDpi(5000), 600);
  assert.equal(clampDpi(220.4), 220);
  assert.equal(clampDpi(undefined), DEFAULT_PDF_RENDER_DPI);
  assert.equal(clampDpi(Number.NaN), DEFAULT_PDF_RENDER_DPI);
  assert.equal(clampDpi(0), DEFAULT_PDF_RENDER_DPI);
});

test("renderScale geeft dpi/72 voor een A4 op 300dpi", () => {
  // A4 = 595 × 842 punten → ~8,7 MP op 300dpi: ruim onder de pixel-grens.
  assert.equal(renderScale(595.28, 841.89, 300), 300 / 72);
});

test("renderScale schaalt een extreem grote pagina terug", () => {
  // A0-formaat op 300dpi zou ~70 MP zijn; de grens knijpt dat af.
  const s = renderScale(2384, 3370, 300);
  assert.ok(s < 300 / 72, "moet kleiner zijn dan de gevraagde schaal");
  assert.ok(2384 * s * 3370 * s <= 12_000_000 + 1, "moet onder de pixel-grens blijven");
  // Nog steeds ruim boven schermresolutie — anders leest het model de cijfers niet.
  assert.ok(s > 1);
});

test("renderScale valt terug op de kale schaal bij onbekende paginamaat", () => {
  assert.equal(renderScale(0, 0, 300), 300 / 72);
});

test("envRenderDpi leest PDF_RENDER_DPI en klemt die af", () => {
  const prev = process.env.PDF_RENDER_DPI;
  try {
    process.env.PDF_RENDER_DPI = "200";
    assert.equal(envRenderDpi(), 200);
    process.env.PDF_RENDER_DPI = "onzin";
    assert.equal(envRenderDpi(), DEFAULT_PDF_RENDER_DPI);
    delete process.env.PDF_RENDER_DPI;
    assert.equal(envRenderDpi(), DEFAULT_PDF_RENDER_DPI);
  } finally {
    if (prev === undefined) delete process.env.PDF_RENDER_DPI;
    else process.env.PDF_RENDER_DPI = prev;
  }
});

test("smoke: een echte PDF wordt een PNG van de juiste afmeting", async () => {
  const pdf = await smallPdf();

  for (const dpi of [200, 300]) {
    const png = await renderPdfFirstPageToPng(pdf, { dpi });
    const bytes = Buffer.from(png.base64, "base64");

    assert.equal(png.mediaType, "image/png");
    // PNG-magic: \x89 P N G \r \n \x1a \n
    assert.deepEqual(
      [...bytes.subarray(0, 8)],
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
      `dpi ${dpi}: geen geldige PNG-header`,
    );

    // A4 (595,28 × 841,89 pt) op dpi/72 — afgerond naar boven op hele pixels.
    const s = dpi / 72;
    assert.equal(png.width, Math.ceil(595.28 * s), `dpi ${dpi}: breedte`);
    assert.equal(png.height, Math.ceil(841.89 * s), `dpi ${dpi}: hoogte`);
    assert.ok(bytes.length > 1000, `dpi ${dpi}: PNG verdacht klein (${bytes.length} bytes)`);
  }
});
