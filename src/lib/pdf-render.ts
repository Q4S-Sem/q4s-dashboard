// ---------------------------------------------------------------------------
// PDF → hoge-resolutie PNG (server-side rastering).
//
// WAAROM: gescande urenstaten (image-only PDF, geen tekstlaag) worden door de
// vision-modellen zelf op lage resolutie gerenderd. Kolommen schuiven dan door
// elkaar: een lege maandag werd 8 uur, zaterdaguren belandden bij de overuren en
// "25" werd als 2015 gelezen. Sturen we in plaats daarvan zélf een scherpe
// 300dpi-PNG van dezelfde pagina, dan leest het model de tabel wél goed.
//
// WAAROM pdfjs-dist + @napi-rs/canvas: dit is een commercieel product, dus de
// hele keten moet permissief gelicenseerd zijn. mupdf (de vorige implementatie)
// is AGPL-3.0-or-later en valt daarmee af. `pdfjs-dist` (Apache-2.0, Mozilla)
// parseert + rastert, `@napi-rs/canvas` (MIT) is de canvas-backend. Er zijn géén
// systeembinaries nodig (poppler/ImageMagick/`canvas` linken tegen system-libs en
// bestaan niet op Vercel serverless); @napi-rs/canvas is een self-contained
// prebuilt N-API addon die per platform als losse npm-package meekomt.
//
// LET OP (Vercel): de Linux-x64 binary van @napi-rs/canvas moet mee de functie-
// bundel in. Zie next.config.ts (outputFileTracingIncludes) en de
// optionalDependencies in package.json.
//
// Alleen de EERSTE pagina wordt gerenderd: urenstaten zijn één pagina.
// ---------------------------------------------------------------------------

import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";

/** Een PNG in base64, met zijn afmetingen in pixels. */
export type PngImage = {
  base64: string;
  mediaType: "image/png";
  width: number;
  height: number;
};

export type RenderedPng = PngImage & {
  /** Totaal toegepaste draaiing in graden: `pageRotate` + `extraRotation`. */
  rotation: QuarterTurn;
  /** Wat de PDF zelf verklaarde (`/Rotate`); pdfjs past dit toe bij het renderen. */
  pageRotate: QuarterTurn;
  /** Wat de heuristiek (of een opgelegde `forceExtraRotation`) er bovenop deed. */
  extraRotation: QuarterTurn;
};

/** Een kwartslag; iets anders draaien we bewust niet (geen deskew). */
export type QuarterTurn = 0 | 90 | 180 | 270;

export const DEFAULT_PDF_RENDER_DPI = 300;
const MIN_DPI = 72;
const MAX_DPI = 600;
/** Bovengrens op het aantal pixels: A4 op 300dpi (~8,7 MP) past ruim; een poster-
 *  formaat pagina wordt teruggeschaald i.p.v. het geheugen op te blazen. */
const MAX_PIXELS = 12_000_000;

/** Is dit een PDF? Tolerant voor een meegestuurde charset (`application/pdf; …`). */
export function isPdfMediaType(mediaType: string | null | undefined): boolean {
  return (mediaType ?? "").trim().toLowerCase().split(";")[0] === "application/pdf";
}

/** Geldige dpi binnen [72, 600]; onzin/leeg → de standaard. */
export function clampDpi(dpi?: number | null): number {
  if (typeof dpi !== "number" || !Number.isFinite(dpi) || dpi <= 0) return DEFAULT_PDF_RENDER_DPI;
  return Math.min(MAX_DPI, Math.max(MIN_DPI, Math.round(dpi)));
}

/**
 * Schaalfactor van PDF-punten (72dpi) naar pixels, teruggeschroefd zodra de
 * pagina boven {@link MAX_PIXELS} zou uitkomen. Puur — testbaar zonder PDF.
 */
export function renderScale(widthPt: number, heightPt: number, dpi?: number | null): number {
  const base = clampDpi(dpi) / 72;
  if (!(widthPt > 0) || !(heightPt > 0)) return base;
  const pixels = widthPt * heightPt * base * base;
  if (pixels <= MAX_PIXELS) return base;
  return base * Math.sqrt(MAX_PIXELS / pixels);
}

/** Dpi uit de omgeving (PDF_RENDER_DPI), zodat je zonder code-wijziging kunt bijstellen. */
export function envRenderDpi(): number {
  return clampDpi(Number(process.env.PDF_RENDER_DPI));
}

// --- oriëntatie ------------------------------------------------------------
//
// Een scheve scan (landscape / op z'n kop) laat het vision-model de tabel fout
// lezen: kolommen worden rijen. Twee bronnen van waarheid, in deze volgorde:
//
//  1. De PDF zelf. `/Rotate` op de pagina zegt hoe hij bekeken hoort te worden;
//     pdfjs verwerkt dat in de viewport. Dat dekt de meeste "zijwaartse" scans,
//     want scanners/telefoons zetten de draaiing in de metadata i.p.v. in de
//     pixels. We geven `page.rotate` expliciet mee — pdfjs doet dat standaard
//     ook, maar zo staat de aanname in de code i.p.v. in een default.
//  2. De vorm van het resultaat. Zegt de PDF niets (`/Rotate 0`) maar is de
//     pagina duidelijk liggend, dan is het vrijwel zeker een staande urenstaat
//     die zijwaarts gefotografeerd/gescand is → een kwartslag erbij.
//
// Bewust NIET: deskew over willekeurige kleine hoeken. Alleen kwartslagen.

/** Vanaf deze breedte/hoogte-verhouding noemen we een pagina "liggend". */
export const LANDSCAPE_RATIO = 1.3;

/** Elke hoek terug naar 0/90/180/270; onzin (45°, NaN, leeg) → 0. */
export function normalizeRotation(deg: number | null | undefined): QuarterTurn {
  if (typeof deg !== "number" || !Number.isFinite(deg) || deg % 90 !== 0) return 0;
  return (((deg % 360) + 360) % 360) as QuarterTurn;
}

/**
 * Hoeveel we ná pdfjs' eigen `/Rotate`-afhandeling nog moeten bijdraaien.
 * Puur — testbaar zonder PDF.
 *
 * Conservatief: alleen als de PDF géén draaiing verklaart én de gerenderde
 * pagina duidelijk liggend is. Een normale staande A4 blijft dus onaangeroerd,
 * en een pagina die zelf al 90/180/270 zegt vertrouwen we (die is door pdfjs al
 * rechtgezet — er nóg een kwartslag bovenop zou hem juist scheef zetten).
 *
 * @param width  breedte van de gerenderde pagina in pixels (ná `/Rotate`)
 * @param height hoogte van de gerenderde pagina in pixels (ná `/Rotate`)
 * @param pageRotate de `/Rotate` van de pagina zelf
 */
export function decideExtraRotation({
  width,
  height,
  pageRotate,
}: {
  width: number;
  height: number;
  pageRotate?: number | null;
}): QuarterTurn {
  if (normalizeRotation(pageRotate) !== 0) return 0;
  if (!Number.isFinite(width) || !Number.isFinite(height)) return 0;
  if (!(width > 0) || !(height > 0)) return 0;
  // Met de klok mee. Of het 90 of 270 moet zijn is uit de pixels niet te zien;
  // rechtsom is de afspraak, en staand-maar-ondersteboven leest het model nog
  // altijd beter dan zijwaarts.
  return width / height > LANDSCAPE_RATIO ? 90 : 0;
}

/**
 * Twee kwartslagen achter elkaar → één kwartslag. Beide termen worden apart
 * genormaliseerd (45° telt dus als 0, niet als een halve slag die het totaal
 * onbruikbaar maakt). Puur.
 *
 * Gebruikt om de draaiing die de render al deed te combineren met wat de
 * AI-oriëntatieprobe er nog bovenop wil (zie `orientationRotation` in ai.ts).
 */
export function combineRotation(
  a: number | null | undefined,
  b: number | null | undefined,
): QuarterTurn {
  return normalizeRotation(normalizeRotation(a) + normalizeRotation(b));
}

/**
 * Canvas-matrix `[a, b, c, d, e, f]` die een bron van `width × height` een
 * kwartslag gedraaid in het doelcanvas zet (bij 90/270 zijn de doelafmetingen
 * verwisseld). Een punt (x, y) gaat naar (a·x + c·y + e, b·x + d·y + f).
 */
export function rotationTransform(
  rotation: QuarterTurn,
  width: number,
  height: number,
): [number, number, number, number, number, number] {
  switch (rotation) {
    case 90: // (x, y) → (height − y, x)
      return [0, 1, -1, 0, height, 0];
    case 180: // (x, y) → (width − x, height − y)
      return [-1, 0, 0, -1, width, height];
    case 270: // (x, y) → (y, width − x)
      return [0, -1, 1, 0, 0, width];
    default:
      return [1, 0, 0, 1, 0, 0];
  }
}

// --- verkleinen voor de oriëntatieprobe -------------------------------------
//
// De vorm-heuristiek hierboven ziet niets als de PAGINA staand is maar de INHOUD
// dwars staat (bewezen geval: een gescande urenstaat die staand 2481×3507 rendert
// terwijl de tekst zijwaarts loopt). Daarvoor vragen we het vision-model zelf om
// de oriëntatie (zie `probePageOrientation` in ai.ts). Die vraag hoeft niet op
// 300dpi: een miniatuur is genoeg om te zien welke kant de tekst op loopt, en
// scheelt een veelvoud aan beeld-tokens.

/** Lange zijde (px) van het miniatuur dat naar de oriëntatieprobe gaat. */
export const ORIENTATION_PROBE_LONG_EDGE = 1000;

/**
 * Schaalfactor die de lange zijde terugbrengt naar `maxLongEdge`. Nooit groter
 * dan 1 (vergroten voegt geen informatie toe, alleen bytes); onbruikbare invoer
 * → 1 (ongewijzigd doorgeven). Puur.
 */
export function probeScale(
  width: number,
  height: number,
  maxLongEdge: number = ORIENTATION_PROBE_LONG_EDGE,
): number {
  if (!Number.isFinite(width) || !Number.isFinite(height)) return 1;
  if (!(width > 0) || !(height > 0)) return 1;
  if (!Number.isFinite(maxLongEdge) || !(maxLongEdge > 0)) return 1;
  const long = Math.max(width, height);
  return long <= maxLongEdge ? 1 : maxLongEdge / long;
}

/**
 * Verklein een PNG (base64) tot `maxLongEdge` op de lange zijde. Is hij al klein
 * genoeg, dan komt hij ongewijzigd terug (geen her-encoding).
 */
export async function downscalePngBase64(
  base64: string,
  maxLongEdge: number = ORIENTATION_PROBE_LONG_EDGE,
): Promise<PngImage> {
  const canvasLib = await import("@napi-rs/canvas");
  const img = await canvasLib.loadImage(Buffer.from(base64, "base64"));
  const scale = probeScale(img.width, img.height, maxLongEdge);
  if (scale >= 1) {
    return { base64, mediaType: "image/png", width: img.width, height: img.height };
  }
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = canvasLib.createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  const png = canvas.toBuffer("image/png");
  if (!png?.length) throw new Error("Verkleinen gaf een lege PNG terug.");
  return {
    base64: Buffer.from(png).toString("base64"),
    mediaType: "image/png",
    width,
    height,
  };
}

// --- pdfjs in Node ---------------------------------------------------------

/**
 * Map van de geïnstalleerde `pdfjs-dist`. pdfjs laadt zijn eigen hulpbestanden
 * (standaard-fonts, CMaps, de JBIG2/JPX-wasm van gescande pagina's) op runtime uit
 * die map; die paden moeten we expliciet meegeven, anders faalt een scan met
 * niet-ingesloten fonts of JBIG2-compressie. `createRequire` vanaf de project-root
 * werkt zowel in ESM als CJS (test via tsx, Next server-bundle, Vercel-functie).
 */
function pdfjsDir(): string | null {
  const bases = [
    typeof __dirname === "string" ? path.join(__dirname, "package.json") : null,
    path.join(process.cwd(), "package.json"),
  ];
  for (const base of bases) {
    if (!base) continue;
    try {
      const req = createRequire(pathToFileURL(base).href);
      return path.dirname(req.resolve("pdfjs-dist/package.json"));
    } catch {
      // volgende basis proberen
    }
  }
  return null;
}

/**
 * `fs.readFile` slikt deze paden rechtstreeks; pdfjs plakt er de bestandsnaam
 * achter en eist een afsluitende `/` (ook op Windows — vandaar geen `path.sep`;
 * Node accepteert forward slashes in paden op elk platform).
 */
function assetDir(root: string | null, sub: string): string | undefined {
  return root ? `${path.join(root, sub).replaceAll("\\", "/")}/` : undefined;
}

type CanvasLike = { canvas: unknown; context: unknown };

/**
 * Minimale CanvasFactory bovenop @napi-rs/canvas. pdfjs gebruikt deze niet alleen
 * voor het doel-canvas maar ook voor tussen-canvassen (transparantiegroepen,
 * soft masks, tegel-patronen). pdfjs heeft er zelf ook één, maar die doet intern
 * `require("@napi-rs/canvas")` vanaf zijn eigen bestandslocatie — dat breekt zodra
 * de bundler het bestand verplaatst. Zelf meegeven is voorspelbaar.
 */
function makeCanvasFactory(createCanvas: (w: number, h: number) => unknown) {
  return class NodeCanvasFactory {
    create(width: number, height: number): CanvasLike {
      if (width <= 0 || height <= 0) throw new Error("Ongeldig canvas-formaat.");
      const canvas = createCanvas(Math.ceil(width), Math.ceil(height)) as {
        getContext(kind: "2d"): unknown;
      };
      return { canvas, context: canvas.getContext("2d") };
    }

    reset(canvasAndContext: CanvasLike, width: number, height: number): void {
      const canvas = canvasAndContext.canvas as { width: number; height: number } | null;
      if (!canvas) throw new Error("Canvas ontbreekt.");
      if (width <= 0 || height <= 0) throw new Error("Ongeldig canvas-formaat.");
      canvas.width = Math.ceil(width);
      canvas.height = Math.ceil(height);
    }

    destroy(canvasAndContext: CanvasLike): void {
      const canvas = canvasAndContext.canvas as { width: number; height: number } | null;
      if (canvas) {
        // Geheugen meteen vrijgeven: een 300dpi A4 is ~35MB aan pixels.
        canvas.width = 0;
        canvas.height = 0;
      }
      canvasAndContext.canvas = null;
      canvasAndContext.context = null;
    }
  };
}

/**
 * Render de EERSTE pagina van een PDF naar een PNG (base64), standaard op 300dpi.
 * Gooit als de PDF onleesbaar/leeg is — de aanroeper valt dan terug op de ruwe PDF.
 *
 * @param opts.forceExtraRotation Legt de extra draaiing vást i.p.v. hem door
 *   {@link decideExtraRotation} te laten bepalen (0 zet de heuristiek dus uit).
 *   Hiermee kan ai.ts opnieuw renderen op de stand die de AI-oriëntatieprobe
 *   vaststelde — scherper dan de PNG achteraf roteren.
 */
export async function renderPdfFirstPageToPng(
  bytes: Buffer | Uint8Array,
  opts?: { dpi?: number; forceExtraRotation?: QuarterTurn },
): Promise<RenderedPng> {
  // Dynamische imports: pdfjs (~4MB) en de native canvas-addon worden pas geladen
  // als er écht een PDF binnenkomt, en blijven zo buiten het opstartpad van elke
  // andere server-actie.
  const canvasLib = await import("@napi-rs/canvas");
  // pdfjs polyfillt DOMMatrix/Path2D zelf via een runtime-`require` naar
  // @napi-rs/canvas; die kan in een gebundelde functie misgaan. Vooraf zetten
  // (pdfjs laat bestaande globals met rust) haalt die onzekerheid weg.
  const g = globalThis as Record<string, unknown>;
  g.DOMMatrix ??= canvasLib.DOMMatrix;
  g.Path2D ??= canvasLib.Path2D;

  // LEGACY-build: de normale build gaat uit van een browser (top-level DOM-API's).
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  const root = pdfjsDir();
  // Geen web worker in een serverless functie. pdfjs zet in Node zelf al
  // `isWorkerDisabled`, maar laadt de worker-módule alsnog in-process via
  // `import(workerSrc)` — standaard het relatieve "./pdf.worker.mjs", wat breekt
  // zodra pdf.mjs gebundeld wordt. Een absoluut file:-pad is bundler-proof.
  if (root) {
    pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
      path.join(root, "legacy", "build", "pdf.worker.mjs"),
    ).href;
  }

  // pdfjs neemt de buffer over (detached na de "worker"-hop) → eigen kopie sturen.
  const data = new Uint8Array(bytes);

  const loadingTask = pdfjs.getDocument({
    data,
    // Geen fetch() in Node: hulpbestanden komen van schijf via de Node-factory.
    useWorkerFetch: false,
    // (De vroegere `isEvalSupported`-schakelaar bestaat niet meer: pdfjs 6 gebruikt
    // sowieso geen eval/new Function meer bij het uitvoeren van PDF-instructies.)
    // Er is geen document/FontFace op de server.
    disableFontFace: true,
    useSystemFonts: false,
    CanvasFactory: makeCanvasFactory(canvasLib.createCanvas),
    standardFontDataUrl: assetDir(root, "standard_fonts"),
    cMapUrl: assetDir(root, "cmaps"),
    cMapPacked: true,
    iccUrl: assetDir(root, "iccs"),
    wasmUrl: assetDir(root, "wasm"),
    // Alleen echte fouten loggen; pdfjs is anders erg spraakzaam per pagina.
    verbosity: 0,
  });

  const doc = await loadingTask.promise;
  try {
    if (doc.numPages < 1) throw new Error("PDF bevat geen pagina's.");
    const page = await doc.getPage(1);
    try {
      // Expliciet: de pagina bekijken zoals de PDF hem bedoeld heeft.
      const pageRotate = normalizeRotation(page.rotate);
      const unscaled = page.getViewport({ scale: 1, rotation: pageRotate });
      const scale = renderScale(unscaled.width, unscaled.height, opts?.dpi ?? envRenderDpi());
      const viewport = page.getViewport({ scale, rotation: pageRotate });
      const pageWidth = Math.max(1, Math.ceil(viewport.width));
      const pageHeight = Math.max(1, Math.ceil(viewport.height));

      // Staat hij ondanks (of bij gebrek aan) /Rotate nog steeds dwars? Kwartslag erbij.
      // Een opgelegde rotatie (van de AI-oriëntatieprobe) wint van de heuristiek.
      const extraRotation =
        opts?.forceExtraRotation === undefined
          ? decideExtraRotation({ width: pageWidth, height: pageHeight, pageRotate })
          : normalizeRotation(opts.forceExtraRotation);
      const quarter = extraRotation === 90 || extraRotation === 270;
      const width = quarter ? pageHeight : pageWidth;
      const height = quarter ? pageWidth : pageHeight;

      const canvas = canvasLib.createCanvas(width, height);
      const ctx = canvas.getContext("2d");
      // Een PDF-pagina is transparant; zonder witte ondergrond wordt de PNG bij
      // het model zwart. mupdf leverde (alpha=false) ook wit — gedrag gelijk houden.
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);

      const task = page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
        // Vóór de viewport-transform, dus de pagina wordt meteen gedraaid het
        // (al verwisselde) canvas in — geen tweede canvas van 12MP nodig.
        transform:
          extraRotation === 0
            ? undefined
            : rotationTransform(extraRotation, pageWidth, pageHeight),
        background: "#ffffff",
      });
      await task.promise;

      const png = canvas.toBuffer("image/png");
      if (!png?.length) throw new Error("Rasteren gaf een lege PNG terug.");
      const rotation = combineRotation(pageRotate, extraRotation);
      if (rotation !== 0) {
        const bron = opts?.forceExtraRotation === undefined ? "heuristiek" : "opgelegd";
        console.info(
          `[pdf-render] pagina rechtgezet: ${rotation}° (/Rotate ${pageRotate}° + ${bron} ${extraRotation}°) → PNG ${width}×${height}.`,
        );
      }
      return {
        base64: Buffer.from(png).toString("base64"),
        mediaType: "image/png",
        width,
        height,
        rotation,
        pageRotate,
        extraRotation,
      };
    } finally {
      page.cleanup();
    }
  } finally {
    // Ruimt het document én de (fake) worker op — anders blijft die per aanroep hangen.
    await loadingTask.destroy();
  }
}
