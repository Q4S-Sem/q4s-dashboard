// Gedeelde helpers voor de PUBLIEKE website-endpoints (q4s.nl ↔ dashboard):
// de CV-/sollicitatie-intake en de vacature-feed. Publiek = geen sessie; CORS
// staat standaard de request-origin toe (of vastzetten met PUBLIC_SITE_ORIGIN).

/** CORS-headers voor de publieke endpoints. */
export function corsHeaders(req: Request): Record<string, string> {
  const configured = process.env.PUBLIC_SITE_ORIGIN?.trim();
  const origin = req.headers.get("origin") ?? "";
  return {
    "access-control-allow-origin": configured || origin || "*",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    "access-control-allow-headers": "content-type",
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}

/** Publieke basis-URL van dit dashboard (voor links naar /vacature/<slug>). */
export function dashboardBaseUrl(): string {
  return (process.env.PUBLIC_DASHBOARD_URL?.trim() || "https://q4s-dashboard-eta.vercel.app").replace(
    /\/+$/,
    "",
  );
}

/** Splits een newline-veld (werkzaamheden/eisen/pré) in nette regels (bullets weg). */
export function splitLines(s: string | null | undefined): string[] {
  if (!s) return [];
  return s
    .split("\n")
    .map((x) => x.trim().replace(/^[-•*]\s*/, ""))
    .filter(Boolean);
}
