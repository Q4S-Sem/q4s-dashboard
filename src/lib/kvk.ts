// Gated KvK-koppeling (officiële KvK API, developers.kvk.nl). Zonder KVK_API_KEY
// staat de suggestie-functie netjes uit. We zoeken op bedrijfsnaam (Zoeken API)
// en halen bij het KIEZEN het adres op (Basisprofiel API). Zo hoeft de gebruiker
// de naam niet exact te typen — hij kiest het juiste bedrijf uit echte resultaten,
// dus een typfoutje leidt nooit tot "niks gevonden".

const KVK_BASE = (process.env.KVK_BASE_URL?.trim() || "https://api.kvk.nl/api").replace(/\/+$/, "");

export function isKvkConfigured(): boolean {
  return Boolean(process.env.KVK_API_KEY?.trim());
}

export type KvkHit = { kvkNumber: string; name: string; city: string };
export type KvkProfile = {
  kvkNumber: string;
  name: string;
  street: string;
  houseNumber: string;
  postcode: string;
  city: string;
};

function headers(): HeadersInit {
  return { apikey: process.env.KVK_API_KEY?.trim() ?? "", accept: "application/json" };
}

function fmtPostcode(pc: unknown): string {
  const raw = String(pc ?? "").toUpperCase().replace(/\s+/g, "");
  return /^\d{4}[A-Z]{2}$/.test(raw) ? `${raw.slice(0, 4)} ${raw.slice(4)}` : String(pc ?? "").trim();
}

/** Zoek bedrijven op (deel van) de naam. Best-effort: gooit nooit. */
export async function kvkSearch(query: string, max = 8): Promise<KvkHit[]> {
  const q = query.trim();
  if (!isKvkConfigured() || q.length < 2) return [];
  try {
    const url = `${KVK_BASE}/v2/zoeken?naam=${encodeURIComponent(q)}&resultatenPerPagina=${max}`;
    const res = await fetch(url, { headers: headers() });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      resultaten?: { kvkNummer?: string; naam?: string; plaats?: string; adres?: { binnenlandsAdres?: { plaats?: string } } }[];
    };
    const rows = data.resultaten ?? [];
    const out: KvkHit[] = [];
    for (const r of rows) {
      if (!r.kvkNummer || !r.naam) continue;
      out.push({
        kvkNumber: String(r.kvkNummer),
        name: r.naam,
        city: r.plaats ?? r.adres?.binnenlandsAdres?.plaats ?? "",
      });
    }
    return out.slice(0, max);
  } catch {
    return [];
  }
}

/** Diep zoeken naar het eerste bezoek-/vestigingsadres in een profiel-JSON. */
function findAddress(obj: unknown): { straatnaam?: string; huisnummer?: unknown; huisletter?: string; postcode?: string; plaats?: string } | null {
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (typeof o.straatnaam === "string" && (o.postcode || o.plaats)) return o as never;
  for (const v of Object.values(o)) {
    if (Array.isArray(v)) {
      for (const item of v) {
        const hit = findAddress(item);
        if (hit) return hit;
      }
    } else if (v && typeof v === "object") {
      const hit = findAddress(v);
      if (hit) return hit;
    }
  }
  return null;
}

/** Haal het volledige adres + officiële naam op bij een gekozen KvK-nummer. */
export async function kvkProfile(kvkNumber: string): Promise<KvkProfile | null> {
  const nr = kvkNumber.trim();
  if (!isKvkConfigured() || !/^\d{8}$/.test(nr)) return null;
  try {
    const res = await fetch(`${KVK_BASE}/v1/basisprofielen/${nr}`, { headers: headers() });
    if (!res.ok) return null;
    const data = (await res.json()) as { naam?: string };
    const a = findAddress(data) ?? {};
    return {
      kvkNumber: nr,
      name: (data.naam as string) ?? "",
      street: a.straatnaam ?? "",
      houseNumber: [a.huisnummer, a.huisletter].filter(Boolean).join("") || "",
      postcode: fmtPostcode(a.postcode),
      city: a.plaats ?? "",
    };
  } catch {
    return null;
  }
}
