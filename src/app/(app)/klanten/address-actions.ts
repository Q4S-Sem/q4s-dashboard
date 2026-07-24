"use server";

import { isKvkConfigured, kvkSearch, kvkProfile, type KvkHit, type KvkProfile } from "@/lib/kvk";

// Nederlandse adres-opzoek via PDOK Locatieserver (gratis, geen API-sleutel).
// Zowel een volledig adres ("Hofweg 15, 3208 LE Spijkenisse") als postcode +
// huisnummer ("3208LE 15") levert straat/postcode/plaats op. Via de server
// aangeroepen zodat er geen CORS/sleutel-gedoe in de browser is.

const PDOK =
  "https://api.pdok.nl/bzk/locatieserver/search/v3_1/free";

export type AddressLookup = {
  street: string;
  houseNumber: string;
  postcode: string; // geformatteerd "3208 LE"
  city: string;
};

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function lookupDutchAddress(query: string): Promise<AddressLookup | null> {
  const q = query.trim();
  if (q.length < 5 || !/\d/.test(q)) return null; // een adres heeft minstens een huisnummer

  try {
    const url = `${PDOK}?q=${encodeURIComponent(q)}&rows=1&fq=${encodeURIComponent(
      "type:adres",
    )}&fl=straatnaam,huis_nlt,postcode,woonplaatsnaam`;
    const res = await fetch(url, { headers: { accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      response?: { docs?: { straatnaam?: string; huis_nlt?: string; postcode?: string; woonplaatsnaam?: string }[] };
    };
    const doc = data.response?.docs?.[0];
    if (!doc || !doc.straatnaam) return null;

    const street = doc.straatnaam;
    // Bewaar het door de gebruiker getypte huisnummer als dat direct na de
    // straatnaam staat (PDOK kan een net-andere match teruggeven, bv. 15 → 15A).
    let houseNumber = doc.huis_nlt ?? "";
    const after = q.replace(new RegExp(`.*${escapeRegex(street)}`, "i"), "").trim();
    const m = after.match(/^[,\s]*([0-9]{1,5}[a-zA-Z]?(?:[-\/][0-9]{1,5}[a-zA-Z]?)?)/);
    if (m) houseNumber = m[1];

    const raw = (doc.postcode ?? "").toUpperCase().replace(/\s+/g, "");
    const postcode = /^\d{4}[A-Z]{2}$/.test(raw) ? `${raw.slice(0, 4)} ${raw.slice(4)}` : (doc.postcode ?? "");

    return { street, houseNumber, postcode, city: doc.woonplaatsnaam ?? "" };
  } catch {
    return null;
  }
}

// --- KvK-suggesties (gated op KVK_API_KEY) ---

/** Zoek bedrijven in het KvK-register op (deel van) de naam. `enabled=false`
 *  wanneer er geen KvK-sleutel is → de UI toont dan gewoon geen suggesties. */
export async function kvkSuggest(query: string): Promise<{ enabled: boolean; results: KvkHit[] }> {
  if (!isKvkConfigured()) return { enabled: false, results: [] };
  return { enabled: true, results: await kvkSearch(query) };
}

/** Volledig profiel (naam + adres) bij een gekozen KvK-nummer. */
export async function kvkGetProfile(kvkNumber: string): Promise<KvkProfile | null> {
  return kvkProfile(kvkNumber);
}
