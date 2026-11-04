// Webpagina (HTML) → leesbare platte tekst voor de AI. Puur, zonder IO (testbaar).
// JobPosting-JSON-LD (structured data van vacaturesites) gaat vooraan mee: daar
// staat de vacature vaak het netst in.

const ENTITEITEN: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", euro: "€" };

function ontsnap(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITEITEN[n.toLowerCase()] ?? m);
}

export function webpaginaTekst(html: string, max = 30_000): string {
  const jsonLd = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1].trim())
    .filter((j) => /JobPosting/i.test(j))
    .join("\n");
  const titel = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
  const body = html
    .replace(/<(script|style|noscript|svg|nav|footer|header|form|iframe)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ");
  const tekst = ontsnap([titel && `Paginatitel: ${titel}`, jsonLd && `Structured data:\n${jsonLd}`, body].filter(Boolean).join("\n\n"))
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
  return tekst.slice(0, max);
}

/** "www.werkzoeken.nl" → "werkzoeken" (om de bron-site ook uit de tekst te houden). */
export function siteNaam(hostname: string): string {
  const delen = hostname.toLowerCase().replace(/^www\./, "").split(".");
  return delen.length >= 2 ? delen[delen.length - 2] : delen[0];
}
