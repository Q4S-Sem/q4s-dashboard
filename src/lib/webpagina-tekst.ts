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

export function webpaginaTekst(html: string, max = 45_000): string {
  const jsonLd = [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => m[1].trim())
    .filter((j) => /JobPosting/i.test(j))
    .join("\n");
  // Uitklapbare blokken (accordeons) staan vaak niet als HTML maar in de
  // pagina-data (Next.js __next_f / __NEXT_DATA__, Nuxt, JSON-scripts). Haal
  // daar de lange tekst-strings uit zodat ook die inhoud meegaat.
  const data = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(([, attrs, body]) => /application\/json|__NEXT_DATA__/i.test(attrs) || /self\.__next_f|__NUXT__|window\.__/.test(body))
    .flatMap(([, , body]) => [...body.matchAll(/"((?:[^"\\]|\\.){40,})"/g)].map((m) => m[1]))
    .map((s) => {
      try {
        return JSON.parse(`"${s}"`) as string;
      } catch {
        return s;
      }
    })
    .map((s) => s.replace(/<[^>]+>/g, " ").trim())
    .filter((s) => s.includes(" ") && !/^(https?:|\$|[\w-]+:\s*[\w-]+;)/.test(s) && !/[{};]\s*$/.test(s));
  const titel = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.trim() ?? "";
  const body = html
    // Accordeon-inhoud (<details>, hidden, aria-hidden) blijft gewoon staan; alleen echte ruis eruit.
    .replace(/<(script|style|noscript|svg|nav|footer|iframe|template)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6]|tr|section|article)>/gi, "\n")
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, " ");
  const extra = [...new Set(data)].filter((s) => !body.includes(s.slice(0, 60))).join("\n");
  const tekst = ontsnap([titel && `Paginatitel: ${titel}`, jsonLd && `Structured data:\n${jsonLd}`, body, extra && `Uitklapbare/verborgen tekst:\n${extra}`].filter(Boolean).join("\n\n"))
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
