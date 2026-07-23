// ---------------------------------------------------------------------------
// Gated SnelStart-koppeling (boekhoudpakket, https://www.snelstart.nl).
//
// Zelfde patroon als de andere externe koppelingen (OneDrive/Graph, mailbox):
// werkt zodra de sleutels in .env staan, en blijft daarvoor netjes "nog niet
// gekoppeld". Zo kun je 'm klaar hebben staan en later aanzetten zodra je zeker
// weet dat alles vloeiend loopt.
//
// SnelStart B2B-API auth = twee sleutels:
//   SNELSTART_SUBSCRIPTION_KEY  → header Ocp-Apim-Subscription-Key (jouw API-abonnement)
//   SNELSTART_CLIENT_KEY        → de koppelsleutel van jullie administratie
// Flow: POST auth.snelstart.nl/b2b/token met { clientKey } + subscription-header
//   → bearer-token (±1u geldig) → calls naar b2bapi.snelstart.nl/v2 met beide headers.
//
// Grootboek-/dagboek-/BTW-toewijzing is ADMINISTRATIE-SPECIFIEK (elke SnelStart-
// administratie heeft eigen grootboek-id's). Die zetten we bij het activeren vast
// (via env of instellingen); tot die tijd draait dit in klaarzet-modus.
// ---------------------------------------------------------------------------

const AUTH_URL = process.env.SNELSTART_AUTH_URL?.trim() || "https://auth.snelstart.nl/b2b/token";
const API_URL = (process.env.SNELSTART_API_URL?.trim() || "https://b2bapi.snelstart.nl/v2").replace(/\/$/, "");

export type SnelStartConfig = {
  subscriptionKey: string;
  clientKey: string;
  /** Optionele, administratie-specifieke grootboek-id's (bij activeren invullen). */
  ledgerSales: string | null; // omzet-grootboek (verkoop)
  ledgerPurchase: string | null; // inkoop-grootboek (kosten)
  ledgerExpense: string | null; // declaratie-/onkosten-grootboek
};

function snelStartConfig(): SnelStartConfig | null {
  const subscriptionKey = process.env.SNELSTART_SUBSCRIPTION_KEY?.trim();
  const clientKey = process.env.SNELSTART_CLIENT_KEY?.trim();
  if (!subscriptionKey || !clientKey) return null;
  return {
    subscriptionKey,
    clientKey,
    ledgerSales: process.env.SNELSTART_LEDGER_SALES?.trim() || null,
    ledgerPurchase: process.env.SNELSTART_LEDGER_PURCHASE?.trim() || null,
    ledgerExpense: process.env.SNELSTART_LEDGER_EXPENSE?.trim() || null,
  };
}

/** Gekoppeld zodra beide sleutels in .env staan. */
export function isSnelStartConnected(): boolean {
  return snelStartConfig() !== null;
}

// Token-cache (±1u geldig).
let cachedToken: { token: string; exp: number } | null = null;

async function getToken(cfg: SnelStartConfig): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && now < cachedToken.exp - 60_000) return cachedToken.token;
  try {
    const res = await fetch(AUTH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Ocp-Apim-Subscription-Key": cfg.subscriptionKey,
      },
      body: JSON.stringify({ clientKey: cfg.clientKey }),
    });
    if (!res.ok) {
      console.warn(`[snelstart] token-fout ${res.status}: ${await res.text().catch(() => "")}`);
      return null;
    }
    const j = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token) return null;
    cachedToken = { token: j.access_token, exp: now + (j.expires_in ?? 3600) * 1000 };
    return j.access_token;
  } catch (e) {
    console.warn("[snelstart] token niet op te halen:", (e as Error).message);
    return null;
  }
}

export type SnelStartResult<T = unknown> =
  | { ok: true; data: T }
  | { ok: false; connected: boolean; error: string };

/** Rauwe request naar de v2-API met beide vereiste headers. Best-effort. */
async function request<T = unknown>(
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  body?: unknown,
): Promise<SnelStartResult<T>> {
  const cfg = snelStartConfig();
  if (!cfg) return { ok: false, connected: false, error: "SnelStart niet gekoppeld — zet de sleutels in .env." };
  const token = await getToken(cfg);
  if (!token) return { ok: false, connected: true, error: "Geen toegangstoken (sleutels kloppen niet?)." };
  try {
    const res = await fetch(`${API_URL}/${path.replace(/^\//, "")}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Ocp-Apim-Subscription-Key": cfg.subscriptionKey,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, connected: true, error: `SnelStart ${res.status}: ${txt.slice(0, 300)}` };
    }
    const data = (await res.json().catch(() => ({}))) as T;
    return { ok: true, data };
  } catch (e) {
    return { ok: false, connected: true, error: (e as Error).message };
  }
}

/** Verbindingstest: haalt de eigen bedrijfsgegevens/BTW-tarieven op. */
export async function testSnelStart(): Promise<{ ok: boolean; connected: boolean; reason?: string }> {
  const cfg = snelStartConfig();
  if (!cfg) return { ok: false, connected: false, reason: "Nog niet gekoppeld (sleutels ontbreken)." };
  const res = await request("GET", "btwtarieven");
  return res.ok ? { ok: true, connected: true } : { ok: false, connected: res.connected, reason: res.error };
}

// ---------------------------------------------------------------------------
// Relaties (klanten/leveranciers) — een boeking heeft een relatie nodig.
// ---------------------------------------------------------------------------

type Relatie = { id: string; naam?: string };

/** Zoek een relatie op naam, of maak 'm aan. Best-effort; geeft de id terug. */
export async function findOrCreateRelation(
  naam: string,
  extra?: { email?: string | null; vatNumber?: string | null; kvk?: string | null; relatiesoort?: ("Klant" | "Leverancier")[] },
): Promise<SnelStartResult<Relatie>> {
  const safe = naam.replace(/'/g, "''");
  const found = await request<Relatie[]>("GET", `relaties?$filter=${encodeURIComponent(`Naam eq '${safe}'`)}&$top=1`);
  if (found.ok && Array.isArray(found.data) && found.data[0]?.id) {
    return { ok: true, data: found.data[0] };
  }
  const created = await request<Relatie>("POST", "relaties", {
    relatiesoort: extra?.relatiesoort ?? ["Klant"],
    naam,
    email: extra?.email || undefined,
    btwNummer: extra?.vatNumber || undefined,
    kvkNummer: extra?.kvk || undefined,
  });
  return created;
}

// ---------------------------------------------------------------------------
// Boekingen — verkoop (uitgaande factuur), inkoop (self-billing) en declaraties.
// De boekingsregel-mapping (grootboek + BTW-soort) is administratie-specifiek en
// wordt bij het activeren afgestemd; standaard best-effort.
// ---------------------------------------------------------------------------

/** BTW-percentage → SnelStart btwSoort (grove mapping; bij activeren verfijnen). */
function btwSoort(rate: number): "Hoog" | "Laag" | "Geen" {
  if (rate >= 20) return "Hoog";
  if (rate > 0) return "Laag";
  return "Geen";
}

function isoDate(d: Date): string {
  return new Date(d).toISOString().slice(0, 10);
}

export type BookingInput = {
  number: string;
  issueDate: Date;
  dueDate: Date;
  /** Naam van de klant (verkoop) of leverancier (inkoop/declaratie). */
  relationName: string;
  relationEmail?: string | null;
  relationVat?: string | null;
  vatRate: number;
  subtotal: number; // ex BTW
  total: number; // incl BTW
  description: string;
};

async function pushBooking(
  kind: "verkoop" | "inkoop",
  input: BookingInput,
): Promise<SnelStartResult<{ id?: string }>> {
  const cfg = snelStartConfig();
  if (!cfg) return { ok: false, connected: false, error: "SnelStart niet gekoppeld." };

  const rel = await findOrCreateRelation(input.relationName, {
    email: input.relationEmail,
    vatNumber: input.relationVat,
    relatiesoort: [kind === "verkoop" ? "Klant" : "Leverancier"],
  });
  if (!rel.ok) return rel;

  const ledger = kind === "verkoop" ? cfg.ledgerSales : cfg.ledgerPurchase;
  const payload: Record<string, unknown> = {
    factuurnummer: input.number,
    [kind === "verkoop" ? "klant" : "leverancier"]: { id: rel.data.id },
    factuurdatum: isoDate(input.issueDate),
    vervaldatum: isoDate(input.dueDate),
    factuurbedrag: input.total,
    boekingsregels: [
      {
        omschrijving: input.description,
        bedrag: input.subtotal,
        btwSoort: btwSoort(input.vatRate),
        ...(ledger ? { grootboek: { id: ledger } } : {}),
      },
    ],
  };

  return request<{ id?: string }>("POST", kind === "verkoop" ? "verkoopboekingen" : "inkoopboekingen", payload);
}

/** Boek een VERKOOPfactuur (uitgaand, naar de klant) in SnelStart. */
export function pushSalesInvoice(input: BookingInput) {
  return pushBooking("verkoop", input);
}

/** Boek een INKOOPfactuur (self-billing / ZZP) in SnelStart. */
export function pushPurchaseInvoice(input: BookingInput) {
  return pushBooking("inkoop", input);
}

/** Boek een DECLARATIE/onkostenbon in SnelStart (als inkoopboeking). */
export async function pushExpense(input: BookingInput): Promise<SnelStartResult<{ id?: string }>> {
  const cfg = snelStartConfig();
  if (!cfg) return { ok: false, connected: false, error: "SnelStart niet gekoppeld." };
  const rel = await findOrCreateRelation(input.relationName || "Onkosten", {
    relatiesoort: ["Leverancier"],
  });
  if (!rel.ok) return rel;
  const payload: Record<string, unknown> = {
    factuurnummer: input.number,
    leverancier: { id: rel.data.id },
    factuurdatum: isoDate(input.issueDate),
    vervaldatum: isoDate(input.dueDate),
    factuurbedrag: input.total,
    boekingsregels: [
      {
        omschrijving: input.description,
        bedrag: input.subtotal,
        btwSoort: btwSoort(input.vatRate),
        ...(cfg.ledgerExpense ? { grootboek: { id: cfg.ledgerExpense } } : {}),
      },
    ],
  };
  return request<{ id?: string }>("POST", "inkoopboekingen", payload);
}
