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

export type RenderedPng = {
  base64: string;
  mediaType: "image/png";
  width: number;
  height: number;
};

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
 */
export async function renderPdfFirstPageToPng(
  bytes: Buffer | Uint8Array,
  opts?: { dpi?: number },
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
      const unscaled = page.getViewport({ scale: 1 });
      const scale = renderScale(unscaled.width, unscaled.height, opts?.dpi ?? envRenderDpi());
      const viewport = page.getViewport({ scale });
      const width = Math.max(1, Math.ceil(viewport.width));
      const height = Math.max(1, Math.ceil(viewport.height));

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
        background: "#ffffff",
      });
      await task.promise;

      const png = canvas.toBuffer("image/png");
      if (!png?.length) throw new Error("Rasteren gaf een lege PNG terug.");
      return {
        base64: Buffer.from(png).toString("base64"),
        mediaType: "image/png",
        width,
        height,
      };
    } finally {
      page.cleanup();
    }
  } finally {
    // Ruimt het document én de (fake) worker op — anders blijft die per aanroep hangen.
    await loadingTask.destroy();
  }
}
