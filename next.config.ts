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
      "./assets/handtekening/**",
      "./assets/excel/**",
      "./public/templates/**",
      "./public/fonts/**",
      // Alleen wat pdf-render.ts echt laadt — de .map/min/sandbox-varianten
      // (~10 MB) zaten anders in élke functie van élke deployment.
      "./node_modules/pdfjs-dist/legacy/build/pdf.mjs",
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/pdfjs-dist/standard_fonts/**",
      "./node_modules/pdfjs-dist/cmaps/**",
      "./node_modules/pdfjs-dist/iccs/**",
      "./node_modules/pdfjs-dist/wasm/**",
      "./node_modules/pdfjs-dist/package.json",
      // Vercel draait Linux/glibc: alleen het hoofdpakket + de gnu-binary. De
      // musl-variant meenemen verdubbelde de canvas-grootte per functie.
      "./node_modules/@napi-rs/canvas/**",
      "./node_modules/@napi-rs/canvas-linux-x64-gnu/**",
    ],
  },
  // Bronmappen en lokale bestanden horen nooit in een functie-bundel.
  outputFileTracingExcludes: {
    "/**": [
      "./node_modules/**/*.map",
      "./node_modules/@napi-rs/canvas-linux-x64-musl/**",
      "./node_modules/@napi-rs/canvas-win32-*/**",
      "./node_modules/@napi-rs/canvas-darwin-*/**",
      "./tests/**",
      "./scripts/**",
    ],
  },

  // De facturatie is herbouwd tot vijf schermen onder /facturatie. De oude
  // paden blijven werken via een TIJDELIJKE omleiding (permanent: false), zodat
  // bladwijzers, links in al verstuurde e-mails en oude tabbladen niet
  // doodlopen — en we de doelen later nog kunnen bijstellen zonder dat browsers
  // een 308 gecachet hebben.
  //
  // Volgorde telt: het meest specifieke pad staat BOVEN zijn catch-all, anders
  // vangt die laatste de PDF-route of de detailpagina af.
  async redirects() {
    return [
      // --- Audits (verhuisd uit Instellingen) ------------------------------
      { source: "/gebruikers/dossiercheck", destination: "/audits/nen-4400", permanent: false },
      { source: "/gebruikers/audit", destination: "/audits/nen-4400/facturen", permanent: false },

      // --- Verkoopfacturen -------------------------------------------------
      // De PDF-route zit in verstuurde mails en bladwijzers: als eerste.
      { source: "/verzenden/verkoop/:id/pdf", destination: "/facturatie/verkoop/:id/pdf", permanent: false },
      { source: "/facturen/nieuw", destination: "/facturatie/verkoop", permanent: false },
      { source: "/facturen/:id/bewerken", destination: "/facturatie/verkoop/:id", permanent: false },
      { source: "/facturen/:id/voorbeeld", destination: "/facturatie/verkoop/:id/voorbeeld", permanent: false },
      { source: "/facturen/:id", destination: "/facturatie/verkoop/:id", permanent: false },
      { source: "/facturen", destination: "/facturatie/verkoop", permanent: false },
      { source: "/verzenden", destination: "/facturatie/verkoop?tab=klaar", permanent: false },
      { source: "/verzenden/:path*", destination: "/facturatie/verkoop?tab=klaar", permanent: false },

      // --- Inkoop & betalingen ---------------------------------------------
      { source: "/declaraties/:id/bewerken", destination: "/facturatie/inkoop/declaraties/:id", permanent: false },
      { source: "/declaraties", destination: "/facturatie/inkoop?tab=declaraties", permanent: false },
      { source: "/declaraties/:path*", destination: "/facturatie/inkoop?tab=declaraties", permanent: false },
      { source: "/ontvangen-facturen/importeren", destination: "/facturatie", permanent: false },
      { source: "/ontvangen-facturen/:id", destination: "/facturatie/inkoop/:id", permanent: false },
      { source: "/ontvangen-facturen", destination: "/facturatie/inkoop", permanent: false },
      { source: "/betalingen", destination: "/facturatie/inkoop", permanent: false },
      { source: "/betaalmonitor", destination: "/facturatie/inkoop", permanent: false },
      { source: "/betaalmonitor/:path*", destination: "/facturatie/inkoop", permanent: false },
      // Self-billing bestaat niet meer (Optie A): de freelancerfactuur is de inkoop.
      { source: "/inkoopfacturen", destination: "/facturatie/inkoop", permanent: false },
      { source: "/inkoopfacturen/:path*", destination: "/facturatie/inkoop", permanent: false },

      // --- Week verwerken (urenstaten) -------------------------------------
      { source: "/verwerken", destination: "/facturatie", permanent: false },
      { source: "/verwerken/:path*", destination: "/facturatie", permanent: false },
      { source: "/inbox", destination: "/facturatie", permanent: false },
      { source: "/inbox/:path*", destination: "/facturatie", permanent: false },
      { source: "/uren", destination: "/facturatie", permanent: false },
      { source: "/uren/:path*", destination: "/facturatie", permanent: false },

      // --- Rapportage -------------------------------------------------------
      { source: "/totaaloverzicht", destination: "/facturatie/rapportage", permanent: false },
      { source: "/boekhouding", destination: "/facturatie/rapportage", permanent: false },
      { source: "/boekhouding/:path*", destination: "/facturatie/rapportage", permanent: false },
      { source: "/dashboard/facturatie", destination: "/facturatie/rapportage", permanent: false },

      // --- Instellingen & regels -------------------------------------------
      { source: "/instellingen", destination: "/facturatie/instellingen", permanent: false },
    ];
  },
};

export default nextConfig;
