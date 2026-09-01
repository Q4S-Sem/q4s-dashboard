import assert from "node:assert/strict";
import test from "node:test";
import {
  DEFAULT_PDF_RENDER_DPI,
  LANDSCAPE_RATIO,
  ORIENTATION_PROBE_LONG_EDGE,
  clampDpi,
  combineRotation,
  decideExtraRotation,
  downscalePngBase64,
  envRenderDpi,
  isPdfMediaType,
  normalizeRotation,
  probeScale,
  renderPdfFirstPageToPng,
  renderScale,
  rotationTransform,
} from "../src/lib/pdf-render";
import {
  orientationRotation,
  parsePageOrientation,
  pdfAutoRotateEnabled,
  shouldRasterizePdf,
} from "../src/lib/ai";

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

/** Zelfde inhoud, maar op een LIGGENDE pagina zonder /Rotate — de "scheve scan". */
async function landscapePdf(): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const page = doc.addPage([841.89, 595.28]); // A4 liggend
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("Urenstaat week 25", { x: 60, y: 520, size: 24, font, color: rgb(0, 0, 0) });
  page.drawRectangle({ x: 60, y: 360, width: 600, height: 120, borderWidth: 2 });
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

// --- oriëntatie ------------------------------------------------------------

test("normalizeRotation geeft alleen 0/90/180/270 terug", () => {
  assert.equal(normalizeRotation(0), 0);
  assert.equal(normalizeRotation(90), 90);
  assert.equal(normalizeRotation(180), 180);
  assert.equal(normalizeRotation(270), 270);
});

test("normalizeRotation wikkelt rond en accepteert negatieve hoeken", () => {
  assert.equal(normalizeRotation(360), 0);
  assert.equal(normalizeRotation(450), 90);
  assert.equal(normalizeRotation(-90), 270);
  assert.equal(normalizeRotation(-450), 270);
  assert.equal(normalizeRotation(720), 0);
});

test("normalizeRotation valt terug op 0 bij onzin", () => {
  assert.equal(normalizeRotation(45), 0);
  assert.equal(normalizeRotation(1), 0);
  assert.equal(normalizeRotation(Number.NaN), 0);
  assert.equal(normalizeRotation(Number.POSITIVE_INFINITY), 0);
  assert.equal(normalizeRotation(undefined), 0);
  assert.equal(normalizeRotation(null), 0);
});

test("decideExtraRotation laat een staande pagina met rotate 0 met rust", () => {
  // A4 staand op 300dpi.
  assert.equal(decideExtraRotation({ width: 2481, height: 3508, pageRotate: 0 }), 0);
  // Ook zonder expliciete pageRotate.
  assert.equal(decideExtraRotation({ width: 2481, height: 3508 }), 0);
});

test("decideExtraRotation draait een liggende pagina zonder /Rotate rechtop", () => {
  // A4 liggend op 300dpi → verhouding 1,41.
  assert.equal(decideExtraRotation({ width: 3508, height: 2481, pageRotate: 0 }), 90);
});

test("decideExtraRotation is conservatief rond de grenswaarde", () => {
  const h = 1000;
  // Precies op de grens telt niet mee (strikt groter dan).
  assert.equal(decideExtraRotation({ width: h * LANDSCAPE_RATIO, height: h, pageRotate: 0 }), 0);
  assert.equal(decideExtraRotation({ width: h * LANDSCAPE_RATIO + 1, height: h, pageRotate: 0 }), 90);
  // Vierkant en licht-liggend (bv. een bijgesneden scan) blijven ongemoeid.
  assert.equal(decideExtraRotation({ width: 1000, height: 1000, pageRotate: 0 }), 0);
  assert.equal(decideExtraRotation({ width: 1200, height: 1000, pageRotate: 0 }), 0);
});

test("decideExtraRotation respecteert een expliciete /Rotate en doet er niets bij", () => {
  // De PDF verklaart zélf een draaiing; pdfjs heeft die al toegepast. Niet nóg eens.
  for (const pageRotate of [90, 180, 270]) {
    assert.equal(
      decideExtraRotation({ width: 3508, height: 2481, pageRotate }),
      0,
      `liggend met /Rotate ${pageRotate}`,
    );
    assert.equal(
      decideExtraRotation({ width: 2481, height: 3508, pageRotate }),
      0,
      `staand met /Rotate ${pageRotate}`,
    );
  }
});

test("decideExtraRotation normaliseert de meegegeven /Rotate", () => {
  // 360 en 45 zijn effectief "geen draaiing" → de heuristiek mag wél aan.
  assert.equal(decideExtraRotation({ width: 3508, height: 2481, pageRotate: 360 }), 90);
  assert.equal(decideExtraRotation({ width: 3508, height: 2481, pageRotate: 45 }), 90);
  // -90 is een echte draaiing (270) → afblijven.
  assert.equal(decideExtraRotation({ width: 3508, height: 2481, pageRotate: -90 }), 0);
});

test("decideExtraRotation valt terug op 0 bij onbruikbare afmetingen", () => {
  assert.equal(decideExtraRotation({ width: 0, height: 0, pageRotate: 0 }), 0);
  assert.equal(decideExtraRotation({ width: 3508, height: 0, pageRotate: 0 }), 0);
  assert.equal(decideExtraRotation({ width: -3508, height: 2481, pageRotate: 0 }), 0);
  assert.equal(decideExtraRotation({ width: Number.NaN, height: 2481, pageRotate: 0 }), 0);
  assert.equal(
    decideExtraRotation({ width: Number.POSITIVE_INFINITY, height: 2481, pageRotate: 0 }),
    0,
  );
});

test("rotationTransform: 0 graden is de identiteit", () => {
  assert.deepEqual(rotationTransform(0, 400, 800), [1, 0, 0, 1, 0, 0]);
});

test("rotationTransform beeldt de hoeken van de bron op het doelcanvas af", () => {
  const w = 400;
  const h = 800;
  // (x,y) → (a·x + c·y + e, b·x + d·y + f)
  const apply = (m: readonly number[], x: number, y: number) =>
    [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]] as const;

  // 90° met de klok mee: doelcanvas is h × w.
  const m90 = rotationTransform(90, w, h);
  assert.deepEqual(apply(m90, 0, 0), [h, 0]); // linksboven → rechtsboven
  assert.deepEqual(apply(m90, w, h), [0, w]); // rechtsonder → linksonder
  assert.deepEqual(apply(m90, 0, h), [0, 0]);

  // 180°: doelcanvas blijft w × h.
  const m180 = rotationTransform(180, w, h);
  assert.deepEqual(apply(m180, 0, 0), [w, h]);
  assert.deepEqual(apply(m180, w, h), [0, 0]);

  // 270° (= 90° tegen de klok in): doelcanvas is h × w.
  const m270 = rotationTransform(270, w, h);
  assert.deepEqual(apply(m270, 0, 0), [0, w]);
  assert.deepEqual(apply(m270, w, h), [h, 0]);
});

test("rotationTransform blijft binnen het doelcanvas voor elke kwartslag", () => {
  const w = 400;
  const h = 800;
  for (const deg of [0, 90, 180, 270] as const) {
    const m = rotationTransform(deg, w, h);
    const quarter = deg === 90 || deg === 270;
    const destW = quarter ? h : w;
    const destH = quarter ? w : h;
    for (const [x, y] of [
      [0, 0],
      [w, 0],
      [0, h],
      [w, h],
    ]) {
      const dx = m[0] * x + m[2] * y + m[4];
      const dy = m[1] * x + m[3] * y + m[5];
      assert.ok(dx >= 0 && dx <= destW, `${deg}°: x ${dx} buiten [0, ${destW}]`);
      assert.ok(dy >= 0 && dy <= destH, `${deg}°: y ${dy} buiten [0, ${destH}]`);
    }
  }
});

// --- AI-oriëntatieprobe -----------------------------------------------------
//
// De vorm-heuristiek ziet niets als de PAGINA staand is maar de INHOUD dwars
// staat (bewezen geval: de scan van J. Balder — 2481×3507 staand, tekst gekanteld).
// Daar vragen we het vision-model zelf om de oriëntatie. Hier de pure logica:
// antwoord → graden, graden combineren met wat de render al deed, en de
// verkleining die de probe goedkoop houdt.

test("combineRotation telt kwartslagen op en wikkelt rond", () => {
  assert.equal(combineRotation(0, 0), 0);
  assert.equal(combineRotation(0, 270), 270);
  assert.equal(combineRotation(90, 270), 0);
  assert.equal(combineRotation(180, 270), 90);
  assert.equal(combineRotation(270, 270), 180);
  assert.equal(combineRotation(90, 90), 180);
});

test("combineRotation normaliseert beide termen apart", () => {
  // 45° is geen kwartslag → telt als 0; niet 45+90 = 135 (dat zou 0 worden).
  assert.equal(combineRotation(45, 90), 90);
  assert.equal(combineRotation(90, 45), 90);
  assert.equal(combineRotation(-90, 180), 90);
  assert.equal(combineRotation(360, 90), 90);
  assert.equal(combineRotation(Number.NaN, 90), 90);
  assert.equal(combineRotation(90, null), 90);
  assert.equal(combineRotation(undefined, undefined), 0);
});

test("probeScale verkleint tot de gevraagde lange zijde", () => {
  // Staande 300dpi-A4 → de lange zijde (3507) moet 1000 worden.
  assert.equal(probeScale(2481, 3507, 1000), 1000 / 3507);
  // Liggend: de breedte is nu de lange zijde.
  assert.equal(probeScale(3507, 2481, 1000), 1000 / 3507);
});

test("probeScale vergroot nooit", () => {
  assert.equal(probeScale(400, 600, 1000), 1);
  assert.equal(probeScale(1000, 1000, 1000), 1);
});

test("probeScale valt terug op 1 bij onzin", () => {
  assert.equal(probeScale(0, 0, 1000), 1);
  assert.equal(probeScale(2481, Number.NaN, 1000), 1);
  assert.equal(probeScale(-2481, 3507, 1000), 1);
  assert.equal(probeScale(2481, 3507, 0), 1);
  assert.equal(probeScale(2481, 3507, Number.NaN), 1);
});

test("probeScale gebruikt standaard ORIENTATION_PROBE_LONG_EDGE", () => {
  assert.ok(ORIENTATION_PROBE_LONG_EDGE > 0);
  assert.equal(probeScale(2481, 3507), ORIENTATION_PROBE_LONG_EDGE / 3507);
});

test("parsePageOrientation leest een kaal antwoord", () => {
  assert.equal(parsePageOrientation("UPRIGHT"), "UPRIGHT");
  assert.equal(parsePageOrientation("ROTATE_CW_90"), "ROTATE_CW_90");
  assert.equal(parsePageOrientation("ROTATE_CCW_90"), "ROTATE_CCW_90");
  assert.equal(parsePageOrientation("UPSIDE_DOWN"), "UPSIDE_DOWN");
});

test("parsePageOrientation tolereert opmaak van het model", () => {
  assert.equal(parsePageOrientation(" rotate_ccw_90 \n"), "ROTATE_CCW_90");
  assert.equal(parsePageOrientation('"ROTATE_CW_90"'), "ROTATE_CW_90");
  assert.equal(parsePageOrientation("```\nUPSIDE_DOWN\n```"), "UPSIDE_DOWN");
  assert.equal(parsePageOrientation('{"orientation": "ROTATE_CCW_90"}'), "ROTATE_CCW_90");
  assert.equal(parsePageOrientation("De tekst staat zijwaarts: ROTATE_CCW_90."), "ROTATE_CCW_90");
});

test("parsePageOrientation verwart CW en CCW niet", () => {
  assert.equal(parsePageOrientation("ROTATE_CCW_90"), "ROTATE_CCW_90");
  assert.equal(parsePageOrientation("antwoord=ROTATE_CW_90"), "ROTATE_CW_90");
});

test("parsePageOrientation geeft null bij onbruikbaar of dubbelzinnig antwoord", () => {
  assert.equal(parsePageOrientation(""), null);
  assert.equal(parsePageOrientation("   "), null);
  assert.equal(parsePageOrientation("weet ik niet"), null);
  assert.equal(parsePageOrientation(null), null);
  assert.equal(parsePageOrientation(undefined), null);
  // Het model herhaalt de keuzelijst i.p.v. te kiezen → niets doen is veiliger.
  assert.equal(parsePageOrientation("UPRIGHT of ROTATE_CW_90?"), null);
});

test("orientationRotation zet het antwoord om in graden met de klok mee", () => {
  assert.equal(orientationRotation("UPRIGHT"), 0);
  assert.equal(orientationRotation("ROTATE_CW_90"), 90);
  assert.equal(orientationRotation("UPSIDE_DOWN"), 180);
  // Tegen de klok in draaien = 270° met de klok mee (rotationTransform is rechtsom).
  assert.equal(orientationRotation("ROTATE_CCW_90"), 270);
  assert.equal(orientationRotation(null), 0);
});

test("PDF_VISION_AUTOROTATE=0 zet de oriëntatieprobe uit", () => {
  const prev = process.env.PDF_VISION_AUTOROTATE;
  try {
    delete process.env.PDF_VISION_AUTOROTATE;
    assert.equal(pdfAutoRotateEnabled(), true, "standaard aan");
    process.env.PDF_VISION_AUTOROTATE = "0";
    assert.equal(pdfAutoRotateEnabled(), false);
    process.env.PDF_VISION_AUTOROTATE = "1";
    assert.equal(pdfAutoRotateEnabled(), true);
  } finally {
    if (prev === undefined) delete process.env.PDF_VISION_AUTOROTATE;
    else process.env.PDF_VISION_AUTOROTATE = prev;
  }
});

test("smoke: forceExtraRotation overrulet de vorm-heuristiek", async () => {
  const dpi = 150;
  const s = dpi / 72;

  // Staande A4 die de heuristiek met rust zou laten → gedwongen kwartslag.
  const gedwongen = await renderPdfFirstPageToPng(await smallPdf(), {
    dpi,
    forceExtraRotation: 90,
  });
  assert.equal(gedwongen.extraRotation, 90);
  assert.equal(gedwongen.rotation, 90);
  assert.equal(gedwongen.width, Math.ceil(841.89 * s), "breedte = de lange zijde");
  assert.equal(gedwongen.height, Math.ceil(595.28 * s));

  // Liggende pagina die de heuristiek zou draaien → expliciet 0 laat hem liggen.
  const gelaten = await renderPdfFirstPageToPng(await landscapePdf(), {
    dpi,
    forceExtraRotation: 0,
  });
  assert.equal(gelaten.extraRotation, 0);
  assert.equal(gelaten.rotation, 0);
  assert.equal(gelaten.width, Math.ceil(841.89 * s));
  assert.equal(gelaten.height, Math.ceil(595.28 * s));

  // 180° houdt de afmetingen gelijk.
  const opzijnkop = await renderPdfFirstPageToPng(await smallPdf(), {
    dpi,
    forceExtraRotation: 180,
  });
  assert.equal(opzijnkop.extraRotation, 180);
  assert.equal(opzijnkop.width, Math.ceil(595.28 * s));
  assert.equal(opzijnkop.height, Math.ceil(841.89 * s));
});

test("smoke: downscalePngBase64 verkleint de render voor de probe", async () => {
  const png = await renderPdfFirstPageToPng(await smallPdf(), { dpi: 200 });
  const klein = await downscalePngBase64(png.base64, 400);
  const bytes = Buffer.from(klein.base64, "base64");

  assert.deepEqual(
    [...bytes.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    "geen geldige PNG-header",
  );
  assert.equal(klein.mediaType, "image/png");
  assert.equal(Math.max(klein.width, klein.height), 400, "lange zijde teruggeschaald");
  assert.equal(bytes.readUInt32BE(16), klein.width, "IHDR-breedte");
  assert.equal(bytes.readUInt32BE(20), klein.height, "IHDR-hoogte");
  assert.ok(
    bytes.length < Buffer.from(png.base64, "base64").length,
    "de probe-PNG moet kleiner zijn dan het origineel",
  );

  // Al klein genoeg → onveranderd doorgeven (geen onnodige her-encoding).
  const zelfde = await downscalePngBase64(klein.base64, 4000);
  assert.equal(zelfde.base64, klein.base64);
  assert.equal(zelfde.width, klein.width);
  assert.equal(zelfde.height, klein.height);
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
    // Staande A4 zonder /Rotate: niets te corrigeren.
    assert.equal(png.rotation, 0, `dpi ${dpi}: rotatie`);
    assert.equal(png.pageRotate, 0, `dpi ${dpi}: /Rotate`);
    assert.equal(png.extraRotation, 0, `dpi ${dpi}: extra rotatie`);
  }
});

test("smoke: een liggende scan komt er staand uit", async () => {
  const pdf = await landscapePdf();
  const dpi = 200;
  const png = await renderPdfFirstPageToPng(pdf, { dpi });
  const bytes = Buffer.from(png.base64, "base64");

  assert.deepEqual(
    [...bytes.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    "geen geldige PNG-header",
  );
  assert.ok(bytes.length > 1000, `PNG verdacht klein (${bytes.length} bytes)`);

  // De pagina is 841,89 × 595,28 pt (liggend); na de kwartslag is de PNG staand.
  const s = dpi / 72;
  assert.equal(png.pageRotate, 0, "de PDF verklaart zelf geen draaiing");
  assert.equal(png.extraRotation, 90, "de heuristiek moet een kwartslag toevoegen");
  assert.equal(png.rotation, 90);
  assert.equal(png.width, Math.ceil(595.28 * s), "breedte = de korte zijde");
  assert.equal(png.height, Math.ceil(841.89 * s), "hoogte = de lange zijde");
  assert.ok(png.height > png.width, `PNG is niet staand: ${png.width}×${png.height}`);

  // De PNG-header draagt de afmetingen zelf ook: IHDR = breedte, hoogte (big-endian).
  assert.equal(bytes.readUInt32BE(16), png.width, "IHDR-breedte");
  assert.equal(bytes.readUInt32BE(20), png.height, "IHDR-hoogte");

  console.info(
    `[smoke] liggende A4 (841,89×595,28 pt) @ ${dpi}dpi → PNG ${png.width}×${png.height}, rotatie ${png.rotation}° (/Rotate ${png.pageRotate}° + extra ${png.extraRotation}°), ${bytes.length} bytes`,
  );
});

test("smoke: een staande pagina met /Rotate 90 wordt niet dubbel gedraaid", async () => {
  const { PDFDocument, StandardFonts, degrees, rgb } = await import("pdf-lib");
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText("Urenstaat week 25", { x: 60, y: 760, size: 24, font, color: rgb(0, 0, 0) });
  page.setRotation(degrees(90));
  const pdf = await doc.save();

  const dpi = 200;
  const png = await renderPdfFirstPageToPng(pdf, { dpi });
  const s = dpi / 72;

  // pdfjs past /Rotate zelf toe → de viewport is al gedraaid; wij doen er niets bij.
  assert.equal(png.pageRotate, 90);
  assert.equal(png.extraRotation, 0);
  assert.equal(png.rotation, 90);
  assert.equal(png.width, Math.ceil(841.89 * s));
  assert.equal(png.height, Math.ceil(595.28 * s));

  console.info(
    `[smoke] staande A4 met /Rotate 90 @ ${dpi}dpi → PNG ${png.width}×${png.height}, rotatie ${png.rotation}° (/Rotate ${png.pageRotate}° + extra ${png.extraRotation}°)`,
  );
});
