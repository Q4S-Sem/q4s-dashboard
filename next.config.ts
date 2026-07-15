import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // xlsx (SheetJS) is a CommonJS lib used only in server actions (timesheet
  // intake) — keep it external so it isn't bundled for the browser.
  serverExternalPackages: ["xlsx"],
  // Build verification can target a separate output dir (set NEXT_DIST_DIR) so a
  // `next build` never clobbers the running dev server's `.next` — keeps
  // localhost up while iterating. Dev/prod use `.next` by default.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Deze bestanden worden op de server via `fs` gelezen (logo in de topbar/PDF's,
  // factuur-briefpapier + evaluatie-templates), maar niet als import getraceerd.
  // Op Vercel serverless mist zo'n bestand anders in de functie-bundel — daarom
  // expliciet meepakken voor alle routes.
  outputFileTracingIncludes: {
    "/**": ["./public/logo/**", "./public/templates/**"],
  },
};

export default nextConfig;
