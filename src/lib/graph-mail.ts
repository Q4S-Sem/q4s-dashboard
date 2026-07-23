// ---------------------------------------------------------------------------
// Gated Microsoft Graph mail-read voor het intake-postvak (admin@q4s.nl).
// Hergebruikt de BESTAANDE Entra-app (MS_TENANT_ID / MS_CLIENT_ID /
// MS_CLIENT_SECRET, dezelfde als voor OneDrive) — voeg daar alleen de
// APPLICATIE-permissie `Mail.Read` aan toe (+ admin-consent). App-only, dus we
// lezen één specifiek postvak: /users/{adres}/mailFolders/inbox/messages.
//
// Gated volgens het app-patroon: zonder MS_*-gegevens "nog niet gekoppeld"; de
// intake-pijplijn (classificatie + routing) draait hier bovenop en schakelt
// automatisch aan zodra dit verbonden is.
// ---------------------------------------------------------------------------

const GRAPH = "https://graph.microsoft.com/v1.0";

/** Het uit te lezen postvak. Standaard admin@q4s.nl; override via env. */
export function mailIntakeAddress(): string {
  return process.env.MAIL_INTAKE_ADDRESS?.trim() || "admin@q4s.nl";
}

type MailConfig = { tenantId: string; clientId: string; clientSecret: string };

function mailConfig(): MailConfig | null {
  const tenantId = process.env.MS_TENANT_ID?.trim();
  const clientId = process.env.MS_CLIENT_ID?.trim();
  const clientSecret = process.env.MS_CLIENT_SECRET?.trim();
  if (!tenantId || !clientId || !clientSecret) return null;
  return { tenantId, clientId, clientSecret };
}

/** Gekoppeld zodra de MS_*-gegevens er zijn (Mail.Read moet in Azure verleend zijn). */
export function isMailIntakeConnected(): boolean {
  return mailConfig() !== null;
}

// App-only token-cache (~1u geldig). .default-scope = alle verleende app-permissies,
// dus zodra Mail.Read is geconsent, mag ditzelfde token mail lezen.
let cachedToken: { token: string; exp: number } | null = null;

async function getToken(cfg: MailConfig): Promise<string | null> {
  const now = Date.now();
  if (cachedToken && now < cachedToken.exp - 60_000) return cachedToken.token;
  try {
    const res = await fetch(
      `https://login.microsoftonline.com/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: cfg.clientId,
          client_secret: cfg.clientSecret,
          scope: "https://graph.microsoft.com/.default",
          grant_type: "client_credentials",
        }),
      },
    );
    if (!res.ok) {
      console.warn(`[mail] token-fout ${res.status}: ${await res.text().catch(() => "")}`);
      return null;
    }
    const j = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token) return null;
    cachedToken = { token: j.access_token, exp: now + (j.expires_in ?? 3600) * 1000 };
    return j.access_token;
  } catch (e) {
    console.warn("[mail] token niet op te halen:", (e as Error).message);
    return null;
  }
}

export type MailAttachment = { name: string; contentType: string; bytes: Uint8Array };

export type MailMessage = {
  id: string;
  subject: string;
  fromName: string;
  fromAddress: string;
  receivedAt: Date;
  bodyPreview: string;
  attachments: MailAttachment[];
};

export type FetchResult = {
  ok: boolean;
  connected: boolean;
  reason?: string;
  messages: MailMessage[];
};

type GraphMessage = {
  id: string;
  subject?: string;
  bodyPreview?: string;
  receivedDateTime?: string;
  from?: { emailAddress?: { name?: string; address?: string } };
};

type GraphAttachment = {
  "@odata.type"?: string;
  name?: string;
  contentType?: string;
  contentBytes?: string;
  size?: number;
};

/** Download de bestand-bijlagen (fileAttachment) van één bericht. */
async function fetchAttachments(
  token: string,
  address: string,
  messageId: string,
): Promise<MailAttachment[]> {
  const url = `${GRAPH}/users/${encodeURIComponent(address)}/messages/${encodeURIComponent(
    messageId,
  )}/attachments?$select=name,contentType,contentBytes,size`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) return [];
  const j = (await res.json().catch(() => null)) as { value?: GraphAttachment[] } | null;
  const out: MailAttachment[] = [];
  for (const a of j?.value ?? []) {
    // Alleen echte bestand-bijlagen met inline bytes (geen item-/referentie-bijlagen).
    if (a["@odata.type"] !== "#microsoft.graph.fileAttachment" || !a.contentBytes) continue;
    out.push({
      name: a.name || "bijlage",
      contentType: a.contentType || "application/octet-stream",
      bytes: new Uint8Array(Buffer.from(a.contentBytes, "base64")),
    });
  }
  return out;
}

/**
 * Haal berichten mét bijlagen uit het intake-postvak. Standaard alleen ongelezen
 * (zodat een verwerkt bericht niet opnieuw binnenkomt — markeer 'm daarna gelezen
 * met markRead). Best-effort: gooit niet, geeft een lege lijst bij een fout.
 */
export async function fetchInboxMessages(opts?: {
  unreadOnly?: boolean;
  max?: number;
}): Promise<FetchResult> {
  const cfg = mailConfig();
  if (!cfg) {
    return {
      ok: false,
      connected: false,
      reason:
        "Postvak nog niet gekoppeld — zet de MS_*-gegevens in .env en verleen Mail.Read in Azure.",
      messages: [],
    };
  }
  const token = await getToken(cfg);
  if (!token) {
    return { ok: false, connected: true, reason: "Geen toegangstoken (tenant/client/secret?).", messages: [] };
  }

  const address = mailIntakeAddress();
  const unreadOnly = opts?.unreadOnly ?? true;
  const top = Math.min(opts?.max ?? 25, 50);
  const filter = [`hasAttachments eq true`, unreadOnly ? `isRead eq false` : ""]
    .filter(Boolean)
    .join(" and ");
  // Let op: Graph staat $orderby NIET toe samen met een $filter op hasAttachments/
  // isRead ("InefficientFilter"). Dus filteren zónder sorteren, en client-side sorteren.
  const url =
    `${GRAPH}/users/${encodeURIComponent(address)}/mailFolders/inbox/messages` +
    `?$filter=${encodeURIComponent(filter)}` +
    `&$select=id,subject,bodyPreview,receivedDateTime,from` +
    `&$top=${top}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, Prefer: 'outlook.body-content-type="text"' },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      const hint =
        res.status === 403
          ? " (403 — is de app-permissie Mail.Read verleend + admin-consent gegeven?)"
          : "";
      return { ok: false, connected: true, reason: `Graph-fout ${res.status}${hint}: ${body.slice(0, 200)}`, messages: [] };
    }
    const j = (await res.json()) as { value?: GraphMessage[] };
    const messages: MailMessage[] = [];
    for (const m of j.value ?? []) {
      const attachments = await fetchAttachments(token, address, m.id);
      if (attachments.length === 0) continue; // niets bruikbaars
      messages.push({
        id: m.id,
        subject: m.subject || "(geen onderwerp)",
        fromName: m.from?.emailAddress?.name || "",
        fromAddress: m.from?.emailAddress?.address || "",
        receivedAt: m.receivedDateTime ? new Date(m.receivedDateTime) : new Date(),
        bodyPreview: m.bodyPreview || "",
        attachments,
      });
    }
    messages.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
    return { ok: true, connected: true, messages };
  } catch (e) {
    return { ok: false, connected: true, reason: (e as Error).message, messages: [] };
  }
}

/** Markeer een bericht als gelezen (zodat het niet opnieuw wordt opgehaald). */
export async function markRead(messageId: string): Promise<boolean> {
  const cfg = mailConfig();
  if (!cfg) return false;
  const token = await getToken(cfg);
  if (!token) return false;
  try {
    const res = await fetch(
      `${GRAPH}/users/${encodeURIComponent(mailIntakeAddress())}/messages/${encodeURIComponent(messageId)}`,
      {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ isRead: true }),
      },
    );
    return res.ok;
  } catch {
    return false;
  }
}
