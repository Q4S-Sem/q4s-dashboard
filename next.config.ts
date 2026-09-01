import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // xlsx (SheetJS) is a CommonJS lib used only in server actions (timesheet
  // intake) — keep it external so it isn't bundled for the browser.
  // pdfjs-dist laadt op runtime bestanden uit zijn eigen map (pdf.worker.mjs,
  // standard_fonts, cmaps, de JBIG2/JPX-wasm) via paden die relatief zijn aan
  // pdf.mjs. Bundelen verplaatst dat bestand en breekt die paden — extern houden.
  // @napi-rs/canvas is een native N-API addon (.node): die kan sowieso niet
  // gebundeld worden en moet als require() blijven staan.
  serverExternalPackages: ["xlsx", "pdfjs-dist", "@napi-rs/canvas"],
  // Build verification can target a separate output dir (set NEXT_DIST_DIR) so a
  // `next build` never clobbers the running dev server's `.next` — keeps
  // localhost up while iterating. Dev/prod use `.next` by default.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Deze bestanden worden op de server via `fs` gelezen (logo in de topbar/PDF's,
  // factuur-briefpapier + evaluatie-templates, Inter-fonts voor het CV), maar niet
  // als import getraceerd. Op Vercel serverless mist zo'n bestand anders in de
  // functie-bundel — daarom expliciet meepakken voor alle routes.
  //
  // Idem voor de PDF-rasteraar (src/lib/pdf-render.ts):
  //  - pdfjs-dist: alleen `legacy/build/pdf.mjs` wordt geïmporteerd. De worker-
  //    module, standard_fonts, cmaps, iccs en wasm worden op runtime van schijf
  //    gelezen en dus NIET getraceerd → expliciet meenemen.
  //  - @napi-rs/canvas: de prebuilt binary zit in een los platform-pakket
  //    (@napi-rs/canvas-linux-x64-gnu / -musl). npm installeert op Vercel alleen
  //    de Linux-variant, maar de trace ziet de `require` van de .node niet →
  //    de glob `@napi-rs/canvas*` pakt het hoofdpakket én elk platform-pakket mee.
  outputFileTracingIncludes: {
    "/**": [
      "./public/logo/**",
      "./public/templates/**",
      "./public/fonts/**",
      "./node_modules/pdfjs-dist/legacy/build/**",
      "./node_modules/pdfjs-dist/standard_fonts/**",
      "./node_modules/pdfjs-dist/cmaps/**",
      "./node_modules/pdfjs-dist/iccs/**",
      "./node_modules/pdfjs-dist/wasm/**",
      "./node_modules/pdfjs-dist/package.json",
      "./node_modules/@napi-rs/canvas*/**",
    ],
  },
};

export default nextConfig;
