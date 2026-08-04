// Gratis bedrijfsdata-verrijking vanaf een bedrijfswebsite. Nederlandse B2B-sites
// vermelden KvK/BTW/e-mail/telefoon meestal in de footer of op /contact. We halen
// die er met regex uit — geen AI-sleutel nodig, gratis, en betrouwbaar voor deze
// vaste formaten. Adres blijft via PDOK; de gebruiker controleert altijd vóór opslaan.

export type WebEnrichment = {
  companyName: string | null;
  kvkNumber: string | null;
  vatNumber: string | null;
  email: string | null; // beste gok (facturatie/info)
  phone: string | null;
  emails: string[];
  phones: string[];
  sourceUrl: string | null;
};

/** Normaliseer + SSRF-guard: alleen publieke http(s)-hosts. */
function safeUrl(input: string): URL | null {
  let s = (input || "").trim();
  if (!s) return null;
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  try {
    const u = new URL(s);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    const host = u.hostname.toLowerCase();
    if (!host.includes(".")) return null;
    if (
      host === "localhost" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      /^(127\.|10\.|0\.|169\.254\.|192\.168\.)/.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host)
    ) {
      return null;
    }
    return u;
  } catch {
    return null;
  }
}

/** Haal één pagina op (met timeout + grootte-cap). Faalt stil → lege string. */
async function fetchText(url: string): Promise<string> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 6000);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      redirect: "follow",
      headers: { "user-agent": "Q4S-Dashboard/1.0 (+enrichment)", accept: "text/html,application/xhtml+xml" },
    });
    if (!res.ok) return "";
    const ct = res.headers.get("content-type") ?? "";
    if (!/text\/html|xml/i.test(ct)) return "";
    const buf = await res.arrayBuffer();
    return new TextDecoder("utf-8", { fatal: false }).decode(buf.slice(0, 900_000));
  } catch {
    return "";
  } finally {
    clearTimeout(t);
  }
}

function textOf(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ");
}

const EMAIL_NOISE = /\.(png|jpe?g|gif|webp|svg)$|(^|@)(sentry|example|wixpress|sentry-next)\./i;

function bestEmail(emails: string[]): string | null {
  if (!emails.length) return null;
  const rank = (e: string) =>
    /factu|invoice|administrat|boekhoud|debiteur/i.test(e) ? 0 : /info|contact|sales|office/i.test(e) ? 1 : 2;
  return [...emails].sort((a, b) => rank(a) - rank(b))[0];
}

/** Verrijk vanaf een bedrijfswebsite (homepage + contact/footer-pagina's). */
export async function enrichFromWebsite(input: string): Promise<WebEnrichment | null> {
  const u = safeUrl(input);
  if (!u) return null;
  const base = `${u.protocol}//${u.host}`;
  const pages = Array.from(
    new Set([u.toString(), `${base}/contact`, `${base}/over-ons`, `${base}/algemene-voorwaarden`]),
  );
  const parts = await Promise.all(pages.map(fetchText));
  const html = parts.join("\n");
  if (!html.trim()) return null;
  const text = textOf(html);

  // Bedrijfsnaam: og:site_name → <title> (schoongemaakt).
  let companyName: string | null = null;
  const og = html.match(/property=["']og:site_name["'][^>]*content=["']([^"']+)["']/i);
  if (og) companyName = og[1].trim();
  if (!companyName) {
    const title = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    if (title) companyName = title[1].split(/[|–—\-]/)[0].trim();
  }
  if (companyName && companyName.length > 80) companyName = null;

  // KvK: 8 cijfers in de buurt van "KvK"/"handelsregister".
  let kvkNumber: string | null = null;
  const kvk =
    text.match(/(?:kvk|handelsregister)(?:[\s.:-]*(?:nummer|nr|no)?)?[\s.:#-]*([0-9]{8})\b/i) ||
    text.match(/\b([0-9]{8})\b(?=[^0-9]{0,15}kvk)/i);
  if (kvk) kvkNumber = kvk[1];

  // BTW/VAT: NL + 9 cijfers + B + 2 cijfers (spaties/punten toegestaan).
  let vatNumber: string | null = null;
  const vat = text.match(/\bNL[\s.]?([0-9]{9})[\s.]?B[\s.]?([0-9]{2})\b/i);
  if (vat) vatNumber = `NL${vat[1]}B${vat[2]}`;

  // E-mails: uit mailto-links + platte tekst; elke match strak opschonen.
  const rawEmails = new Set<string>();
  for (const m of html.matchAll(/mailto:([^"'?>\s]+)/gi)) rawEmails.add(m[1]);
  for (const m of text.matchAll(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi)) rawEmails.add(m[0]);
  const emailSet = new Set<string>();
  for (const raw of rawEmails) {
    const m = raw.toLowerCase().match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/);
    if (m && !EMAIL_NOISE.test(m[0])) emailSet.add(m[0]);
  }
  const emails = [...emailSet].slice(0, 10);

  // Telefoons: NL-nummers (+31 of 0..).
  const phoneSet = new Set<string>();
  for (const m of text.matchAll(/(?:\+31[\s-]?|0)(?:[1-9][\s-]?)(?:\d[\s-]?){8}/g)) {
    const cleaned = m[0].replace(/[\s-]/g, "");
    if (cleaned.replace(/\D/g, "").length >= 9) phoneSet.add(m[0].replace(/\s{2,}/g, " ").trim());
  }
  const phones = [...phoneSet].slice(0, 5);

  const found =
    companyName || kvkNumber || vatNumber || emails.length > 0 || phones.length > 0;
  if (!found) return null;

  return {
    companyName,
    kvkNumber,
    vatNumber,
    email: bestEmail(emails),
    phone: phones[0] ?? null,
    emails,
    phones,
    sourceUrl: u.toString(),
  };
}
