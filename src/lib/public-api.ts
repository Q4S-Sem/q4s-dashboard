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

// ---------------------------------------------------------------------------
// SEO — vacature-inhoud als HTML + schema.org JobPosting (Google for Jobs).
// Zo blijft de SEO "top" ongeacht hoe q4s.nl het rendert: de structured data
// wordt hier correct-by-construction opgebouwd; q4s.nl injecteert 'm alleen.
// ---------------------------------------------------------------------------

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Vrije-tekst contractvorm → schema.org employmentType-enum. */
export function schemaEmploymentType(raw: string | null | undefined): string {
  const s = (raw ?? "").toLowerCase();
  if (/full|voltijd/.test(s)) return "FULL_TIME";
  if (/part|deeltijd/.test(s)) return "PART_TIME";
  if (/zzp|freelanc|interim|detach|contract/.test(s)) return "CONTRACTOR";
  if (/tijdelijk|temporary|uitzend/.test(s)) return "TEMPORARY";
  if (/stage|intern/.test(s)) return "INTERN";
  return "OTHER";
}

/** Composeer de vacature-inhoud tot nette, semantische HTML (voor rendering én
 *  voor JobPosting.description — Google wil een volledige HTML-omschrijving). */
export function composeDescriptionHtml(v: {
  summary: string | null;
  responsibilities: string[];
  requirements: string[];
  niceToHave: string[];
}): string {
  const parts: string[] = [];
  if (v.summary) parts.push(`<p>${esc(v.summary)}</p>`);
  const section = (title: string, items: string[]) => {
    if (!items.length) return;
    parts.push(`<h2>${title}</h2><ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`);
  };
  section("Werkzaamheden", v.responsibilities);
  section("Functie-eisen", v.requirements);
  section("Pré", v.niceToHave);
  return parts.join("\n");
}

/** Bouw een schema.org JobPosting (Google for Jobs) — kant-en-klaar om als
 *  <script type="application/ld+json"> te injecteren op de vacaturepagina. */
export function buildJobPosting(
  v: {
    slug: string;
    title: string;
    descriptionHtml: string;
    location: string | null;
    employmentType: string | null;
    publishedAt: Date | null;
  },
  org: { name: string; url: string | null; fallbackCity: string; fallbackCountry: string },
  siteUrl: string,
): Record<string, unknown> {
  const loc = (v.location ?? "").trim();
  const country = /netherlands|nederland|\bNL\b/i.test(loc + " " + org.fallbackCountry) ? "NL" : "NL";
  const locality =
    loc.replace(/,?\s*(nederland|netherlands|international|internationaal)\s*$/i, "").trim() ||
    org.fallbackCity ||
    "Nederland";
  return {
    "@context": "https://schema.org/",
    "@type": "JobPosting",
    title: v.title,
    description: v.descriptionHtml || `<p>${esc(v.title)}</p>`,
    datePosted: (v.publishedAt ?? new Date()).toISOString(),
    employmentType: schemaEmploymentType(v.employmentType),
    hiringOrganization: {
      "@type": "Organization",
      name: org.name,
      ...(org.url ? { sameAs: org.url } : {}),
    },
    jobLocation: {
      "@type": "Place",
      address: { "@type": "PostalAddress", addressLocality: locality, addressCountry: country },
    },
    directApply: true,
    identifier: { "@type": "PropertyValue", name: org.name, value: v.slug },
    // Canonieke vacature-URL op de website; overschrijf desnoods op q4s.nl.
    url: `${siteUrl}/vacatures/${v.slug}`,
  };
}
