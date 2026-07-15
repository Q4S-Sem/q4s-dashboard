// ---------------------------------------------------------------------------
// Low-level Microsoft Graph-client (app-only, client credentials) voor OneDrive
// én SharePoint. De configuratie wordt MEEGEGEVEN (uit de DB-instellingen of de
// MS_*-env; zie src/lib/cloud.ts) — dit bestand kent geen env of DB. Best-effort:
// gooit nooit, geeft een { ok } terug zodat de aanroeper kan loggen.
//
// Auth = client credentials (app-only): een Entra ID app-registratie met de
// APPLICATION-permissie `Files.ReadWrite.All` (+ `Sites.ReadWrite.All` voor
// SharePoint), admin-consent vereist. App-only heeft geen ingelogde gebruiker:
//   OneDrive   → /users/{driveUser}/drive
//   SharePoint → /sites/{siteId}/drive  (of /drives/{driveId} bij een expliciete
//                documentbibliotheek).
// ---------------------------------------------------------------------------

const GRAPH = "https://graph.microsoft.com/v1.0";
const SMALL_MAX = 4 * 1024 * 1024; // ≤4MB → simpele PUT; groter → upload-sessie
const CHUNK = 5 * 1024 * 1024; // veelvoud van 320 KiB (Graph-eis voor chunks)

export type CloudProvider = "ONEDRIVE" | "SHAREPOINT";

export type CloudConfig = {
  provider: CloudProvider;
  tenantId: string;
  clientId: string;
  clientSecret: string;
  /** OneDrive: UPN/e-mail of object-id van het account. */
  driveUser: string;
  /** SharePoint: site-id. */
  siteId: string;
  /** Optioneel expliciete drive-id (documentbibliotheek). */
  driveId: string;
  rootFolder: string;
};

export type GraphUploadResult = { ok: true; webUrl?: string } | { ok: false; error: string };

// Token-cache per (tenant, client) — app-only tokens zijn ~1u geldig.
const tokenCache = new Map<string, { token: string; exp: number }>();

async function getToken(cfg: CloudConfig): Promise<string | null> {
  const key = `${cfg.tenantId}:${cfg.clientId}`;
  const now = Date.now();
  const cached = tokenCache.get(key);
  if (cached && now < cached.exp - 60_000) return cached.token;
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
      console.warn(`[cloud] token-fout ${res.status}: ${await res.text().catch(() => "")}`);
      return null;
    }
    const j = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!j.access_token) return null;
    tokenCache.set(key, { token: j.access_token, exp: now + (j.expires_in ?? 3600) * 1000 });
    return j.access_token;
  } catch (e) {
    console.warn("[cloud] token niet op te halen:", (e as Error).message);
    return null;
  }
}

/** Verwijder verboden Graph/OneDrive-tekens uit een bestandsnaam. */
export function sanitizeName(name: string): string {
  return name.replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim() || "bestand";
}

/** URL-encode elk pad-segment (Graph pad-adressering root:/a/b/file:). */
function encodePath(pathIn: string): string {
  return pathIn
    .split("/")
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join("/");
}

/** De drive-basis-URL, afhankelijk van provider. */
function driveBase(cfg: CloudConfig): string {
  if (cfg.provider === "SHAREPOINT") {
    if (cfg.driveId) return `${GRAPH}/drives/${encodeURIComponent(cfg.driveId)}`;
    return `${GRAPH}/sites/${encodeURIComponent(cfg.siteId)}/drive`;
  }
  return `${GRAPH}/users/${encodeURIComponent(cfg.driveUser)}/drive`;
}

/**
 * Bouw een leesbaar, botsing-vrij pad: <folder>/<kort-id>-<originele naam>. Het
 * korte id (uit de opgeslagen bestandsnaam) houdt het uniek; de originele naam
 * houdt het herkenbaar in OneDrive/SharePoint.
 */
export function remotePathFor(folder: string, storedFileName: string, originalName: string): string {
  const shortId = storedFileName.split(".")[0].slice(0, 8) || "file";
  return `${folder}/${shortId}-${sanitizeName(originalName)}`;
}

/**
 * Upload bytes naar <root>/<remotePath> in de ingestelde drive. Maakt
 * tussenliggende mappen automatisch aan. Best-effort: gooit nooit.
 */
export async function graphUpload(
  cfg: CloudConfig,
  remotePath: string,
  bytes: Uint8Array,
  contentType?: string,
): Promise<GraphUploadResult> {
  const token = await getToken(cfg);
  if (!token) return { ok: false, error: "Geen toegangstoken — controleer tenant/client/secret." };

  const encPath = encodePath(`${cfg.rootFolder}/${remotePath}`);
  const base = driveBase(cfg);
  try {
    if (bytes.byteLength <= SMALL_MAX) {
      const res = await fetch(
        `${base}/root:/${encPath}:/content?@microsoft.graph.conflictBehavior=rename`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": contentType || "application/octet-stream",
          },
          body: Buffer.from(bytes),
        },
      );
      if (!res.ok) return { ok: false, error: `Upload-fout ${res.status}` };
      const j = (await res.json().catch(() => null)) as { webUrl?: string } | null;
      return { ok: true, webUrl: j?.webUrl };
    }

    // Groot bestand → upload-sessie in chunks.
    const sess = await fetch(`${base}/root:/${encPath}:/createUploadSession`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ item: { "@microsoft.graph.conflictBehavior": "rename" } }),
    });
    if (!sess.ok) return { ok: false, error: `Upload-sessie-fout ${sess.status}` };
    const { uploadUrl } = (await sess.json()) as { uploadUrl?: string };
    if (!uploadUrl) return { ok: false, error: "Geen upload-URL ontvangen." };

    const total = bytes.byteLength;
    let start = 0;
    let lastBody: { webUrl?: string } | null = null;
    while (start < total) {
      const end = Math.min(start + CHUNK, total);
      const chunk = bytes.subarray(start, end);
      const put = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Length": String(chunk.byteLength),
          "Content-Range": `bytes ${start}-${end - 1}/${total}`,
        },
        body: Buffer.from(chunk),
      });
      if (!put.ok && put.status !== 202) return { ok: false, error: `Chunk-fout ${put.status}` };
      lastBody = (await put.json().catch(() => null)) as { webUrl?: string } | null;
      start = end;
    }
    return { ok: true, webUrl: lastBody?.webUrl };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
