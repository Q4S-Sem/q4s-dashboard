// ---------------------------------------------------------------------------
// Cloudopslag-koppeling (Microsoft 365: OneDrive én/of SharePoint). Elke upload
// in het dashboard wordt (best-effort, één richting) naar ELK gekoppeld platform
// gespiegeld en gesorteerd in mappen — standaard DUBBEL (OneDrive + SharePoint),
// zodat elk bestand naast de lokale bron ook op beide clouds staat. De lokale
// schijf blijft altijd de bron.
//
// Config komt uit de DB-instellingen (CompanySettings, via de Data-hub) met de
// MS_*-env als fallback. Zonder werkende koppeling draait alles in KLAARZET-MODUS
// (SIMULATED): er wordt niets verzonden, maar elke (bedoelde) spiegel wordt wél
// gelogd (CloudSyncLog) — per platform één regel — zodat je in de app ziet dat
// alles netjes en dubbel wordt weggezet.
// ---------------------------------------------------------------------------

import { db } from "./db";
import { getCompanySettings } from "./settings";
import { graphUpload, remotePathFor, type CloudConfig, type CloudProvider } from "./onedrive";

export type { CloudConfig, CloudProvider } from "./onedrive";

/** cloudProvider-waarden: één platform of BOTH (dubbel). */
export type CloudProviderChoice = "ONEDRIVE" | "SHAREPOINT" | "BOTH";

export const CLOUD_PROVIDER_LABEL: Record<string, string> = {
  ONEDRIVE: "OneDrive",
  SHAREPOINT: "SharePoint",
  BOTH: "OneDrive + SharePoint",
};

export type MirrorTarget = { provider: CloudProvider; config: CloudConfig; live: boolean };

export type CloudSummary = {
  choice: CloudProviderChoice;
  rootFolder: string;
  enabled: boolean;
  source: "db" | "env" | "none";
  /** Minstens één platform verstuurt echt. */
  live: boolean;
  /** De platforms waar naartoe wordt (of zou worden) gespiegeld. */
  targets: { provider: CloudProvider; live: boolean }[];
};

/**
 * De mapjes die het dashboard zélf aanmaakt, allemaal ONDER de hoofdmap.
 *
 * Q4S heeft in OneDrive al een eigen mappenstructuur (Contracten Q4S, CV's,
 * Klant gegevens …). Daar blijft het dashboard vanaf: het schrijft uitsluitend
 * binnen `cloudRootFolder` en maakt daarin zijn eigen submappen aan. Er wordt
 * nooit iets buiten die hoofdmap gelezen, gewijzigd of verwijderd, en binnen de
 * hoofdmap wordt nooit overschreven (Graph krijgt conflictBehavior=rename mee).
 *
 * Deze lijst is de bron van waarheid: staat een categorie hier niet in, dan
 * hoort hij ook niet in de cloud te belanden.
 */
export const CLOUD_FOLDERS: { category: string; description: string }[] = [
  { category: "Personeelsdossiers", description: "CV's, contracten, certificaten en documenten — submap per medewerker." },
  { category: "Timesheet-inbox", description: "Binnengekomen urenstaten (upload + admin@q4s.nl)." },
  { category: "Declaraties", description: "Bonnetjes en onkostendeclaraties." },
  { category: "Kandidaten-CV", description: "CV's uit de recruitment-/talentpool." },
  { category: "Ontvangen facturen", description: "Facturen die binnenkomen van geplaatste ZZP'ers." },
];

/** Standaardnaam van de eigen hoofdmap in OneDrive/SharePoint. */
export const DEFAULT_ROOT_FOLDER = "Q4S Dashboard";

/**
 * Eén mapnaam schoonvegen tot iets waarmee niet buiten de eigen map te
 * schrijven valt: geen slashes (dus geen extra padniveaus), geen punten (dus
 * geen ".." of verborgen mappen) en geen tekens die Graph weigert.
 *
 * Zonder dit zou een naam als "/" of "../CV's" ertoe leiden dat het dashboard
 * in de bestáánde Q4S-mappen gaat schrijven.
 */
function schoonSegment(raw: string | null | undefined): string {
  return String(raw ?? "")
    .replace(/[\\/:*?"<>|]/g, " ")
    .replace(/\.+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Eén map-segment onder de hoofdmap (categorie of submap). */
export function safeSegment(raw: string): string {
  return schoonSegment(raw) || "Overig";
}

/** De eigen hoofdmap; valt terug op de standaardnaam als er niets overblijft. */
export function safeRootFolder(raw: string | null | undefined): string {
  return schoonSegment(raw) || DEFAULT_ROOT_FOLDER;
}

/** Heeft deze config genoeg gegevens om écht te kunnen uploaden? */
export function hasCredentials(c: CloudConfig): boolean {
  if (!(c.tenantId && c.clientId && c.clientSecret)) return false;
  return c.provider === "SHAREPOINT" ? Boolean(c.siteId || c.driveId) : Boolean(c.driveUser);
}

function envConfig(): CloudConfig | null {
  if (process.env.ONEDRIVE_MIRROR === "off") return null;
  const tenantId = process.env.MS_TENANT_ID ?? "";
  const clientId = process.env.MS_CLIENT_ID ?? "";
  const clientSecret = process.env.MS_CLIENT_SECRET ?? "";
  const driveUser = process.env.MS_DRIVE_USER ?? "";
  if (!(tenantId && clientId && clientSecret && driveUser)) return null;
  return {
    provider: "ONEDRIVE",
    tenantId,
    clientId,
    clientSecret,
    driveUser,
    siteId: "",
    driveId: "",
    rootFolder: safeRootFolder(process.env.MS_ROOT_FOLDER),
  };
}

/** De actieve spiegel-targets (0..2). Bepaalt waar elk bestand heen gaat. */
async function buildTargets(): Promise<{
  targets: MirrorTarget[];
  enabled: boolean;
  source: "db" | "env" | "none";
}> {
  const s = await getCompanySettings();
  const choice = (s.cloudProvider as CloudProviderChoice) || "BOTH";
  const root = safeRootFolder(s.cloudRootFolder);
  const wantOD = choice === "ONEDRIVE" || choice === "BOTH";
  const wantSP = choice === "SHAREPOINT" || choice === "BOTH";

  if (s.cloudEnabled) {
    const targets: MirrorTarget[] = [];
    if (wantOD) {
      const config: CloudConfig = {
        provider: "ONEDRIVE",
        tenantId: s.cloudTenantId,
        clientId: s.cloudClientId,
        clientSecret: s.cloudClientSecret,
        driveUser: s.cloudDriveUser,
        siteId: "",
        driveId: "",
        rootFolder: root,
      };
      targets.push({ provider: "ONEDRIVE", config, live: hasCredentials(config) });
    }
    if (wantSP) {
      const config: CloudConfig = {
        provider: "SHAREPOINT",
        tenantId: s.cloudTenantId,
        clientId: s.cloudClientId,
        clientSecret: s.cloudClientSecret,
        driveUser: "",
        siteId: s.cloudSiteId,
        driveId: s.cloudDriveId,
        rootFolder: root,
      };
      targets.push({ provider: "SHAREPOINT", config, live: hasCredentials(config) });
    }
    if (targets.length) return { targets, enabled: true, source: "db" };
  }

  const env = envConfig();
  if (env) return { targets: [{ provider: "ONEDRIVE", config: env, live: true }], enabled: true, source: "env" };

  // Klaarzet-modus: toon de BEDOELDE targets (dubbel), zodat de mapstructuur en de
  // dubbele opslag zichtbaar zijn nog voordat de koppeling is ingevuld.
  const empty = { tenantId: "", clientId: "", clientSecret: "", driveUser: "", siteId: "", driveId: "", rootFolder: root };
  const sim: MirrorTarget[] = [];
  if (wantOD) sim.push({ provider: "ONEDRIVE", config: { ...empty, provider: "ONEDRIVE" }, live: false });
  if (wantSP) sim.push({ provider: "SHAREPOINT", config: { ...empty, provider: "SHAREPOINT" }, live: false });
  if (!sim.length) sim.push({ provider: "ONEDRIVE", config: { ...empty, provider: "ONEDRIVE" }, live: false });
  return { targets: sim, enabled: false, source: "none" };
}

/** Samenvatting voor de Data-hub-pagina. */
export async function getCloudSummary(): Promise<CloudSummary> {
  const s = await getCompanySettings();
  const { targets, enabled, source } = await buildTargets();
  return {
    choice: (s.cloudProvider as CloudProviderChoice) || "BOTH",
    rootFolder: safeRootFolder(s.cloudRootFolder),
    enabled,
    source,
    live: targets.some((t) => t.live),
    targets: targets.map((t) => ({ provider: t.provider, live: t.live })),
  };
}

/**
 * Spiegel een lokaal opgeslagen bestand naar ELK gekoppeld platform, gesorteerd in
 * <root>/<category>[/<subfolder>]/<bestand>. Schrijft per platform een CloudSyncLog-
 * regel (SIMULATED in klaarzet-modus). Best-effort: breekt of blokkeert een upload
 * NOOIT. Deletes worden bewust niet meegespiegeld (de cloudkopie blijft behouden).
 */
export async function mirrorToCloud(input: {
  category: string;
  subfolder?: string;
  storedFileName: string;
  originalName: string;
  bytes: Uint8Array;
  contentType?: string;
}): Promise<void> {
  try {
    const { targets } = await buildTargets();
    // Ook categorie en submap normaliseren: geen slashes of punten, zodat een
    // aanroeper nooit met "../" buiten de eigen hoofdmap kan schrijven.
    const cat = safeSegment(input.category);
    const sub = input.subfolder ? safeSegment(input.subfolder) : "";
    const folder = sub ? `${cat}/${sub}` : cat;
    const remotePath = remotePathFor(folder, input.storedFileName, input.originalName);
    let anySynced = false;

    for (const t of targets) {
      const fullPath = `${t.config.rootFolder}/${remotePath}`;
      let status: "SYNCED" | "SIMULATED" | "ERROR" = "SIMULATED";
      let webUrl: string | null = null;
      let error: string | null = null;

      if (t.live) {
        const res = await graphUpload(t.config, remotePath, input.bytes, input.contentType);
        if (res.ok) {
          status = "SYNCED";
          webUrl = res.webUrl ?? null;
          anySynced = true;
        } else {
          status = "ERROR";
          error = res.error;
        }
      }

      await db.cloudSyncLog.create({
        data: {
          provider: t.provider,
          category: input.category,
          folder: fullPath,
          fileName: input.storedFileName,
          originalName: input.originalName,
          status,
          webUrl,
          error,
          size: input.bytes.byteLength,
        },
      });
    }

    if (anySynced) {
      await db.companySettings
        .update({ where: { id: "default" }, data: { cloudLastSyncAt: new Date() } })
        .catch(() => {});
    }
  } catch {
    // best-effort — een mislukte spiegel/log mag een upload nooit breken
  }
}

/** Is een bestand al eens gespiegeld (SYNCED of SIMULATED)? Voor idempotente backfill. */
export async function alreadyMirrored(storedFileName: string): Promise<boolean> {
  const hit = await db.cloudSyncLog.findFirst({
    where: { fileName: storedFileName, status: { in: ["SYNCED", "SIMULATED"] } },
    select: { id: true },
  });
  return Boolean(hit);
}
