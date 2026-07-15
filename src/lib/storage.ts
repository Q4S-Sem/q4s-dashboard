import { promises as fs } from "fs";
import path from "path";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

/**
 * Object-opslag voor geüploade bestanden (dossiers, CV's, timesheet-inbox,
 * declaraties, ontvangen facturen, archief-kopieën).
 *
 *  • PRODUCTIE (Vercel): Cloudflare R2 via de S3-compatibele API. Vercel draait
 *    serverless — het lokale bestandssysteem is efemeer/alleen-lezen, dus alles
 *    moet naar object-opslag. R2 is S3-compatibel, gratis tot 10 GB en zonder
 *    egress-kosten.
 *  • LOKALE DEV: als de R2-env-vars ontbreken vallen we terug op de schijf onder
 *    ./uploads/<key>. Zo blijft de lokale ontwikkelworkflow exact hetzelfde.
 *
 * "key" is altijd een POSIX-pad (forward slashes), bijv. "<consultantId>/<file>"
 * of "_inbox/<file>" — precies de mapstructuur die de app al gebruikte.
 */

const UPLOAD_DIR = path.join(process.cwd(), "uploads");

function r2Config() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

/** Draait de app op R2 (prod) of op de lokale schijf (dev)? */
export function usingR2(): boolean {
  return r2Config() !== null;
}

let cachedClient: S3Client | null = null;
function client(cfg: NonNullable<ReturnType<typeof r2Config>>): S3Client {
  if (!cachedClient) {
    cachedClient = new S3Client({
      region: "auto",
      endpoint: `https://${cfg.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      },
    });
  }
  return cachedClient;
}

function diskPath(key: string): string {
  // key is POSIX; map naar een OS-pad onder uploads/.
  return path.join(UPLOAD_DIR, ...key.split("/"));
}

/** Sla bytes op onder `key`. */
export async function putObject(
  key: string,
  bytes: Buffer | Uint8Array,
  contentType?: string,
): Promise<void> {
  const cfg = r2Config();
  const body = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  if (cfg) {
    await client(cfg).send(
      new PutObjectCommand({
        Bucket: cfg.bucket,
        Key: key,
        Body: body,
        ContentType: contentType || "application/octet-stream",
      }),
    );
    return;
  }
  const p = diskPath(key);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, body);
}

/** Lees de bytes van `key`. Gooit als het bestand niet bestaat. */
export async function getObject(key: string): Promise<Buffer> {
  const cfg = r2Config();
  if (cfg) {
    const res = await client(cfg).send(
      new GetObjectCommand({ Bucket: cfg.bucket, Key: key }),
    );
    if (!res.Body) throw new Error(`R2 object zonder body: ${key}`);
    const bytes = await res.Body.transformToByteArray();
    return Buffer.from(bytes);
  }
  return fs.readFile(diskPath(key));
}

/** Verwijder `key` (best-effort — ontbrekend bestand is geen fout). */
export async function deleteObject(key: string): Promise<void> {
  const cfg = r2Config();
  try {
    if (cfg) {
      await client(cfg).send(
        new DeleteObjectCommand({ Bucket: cfg.bucket, Key: key }),
      );
    } else {
      await fs.unlink(diskPath(key));
    }
  } catch {
    // al weg — prima
  }
}

/** Kopieer `srcKey` → `destKey` (via read+write, werkt op beide backends). */
export async function copyObject(srcKey: string, destKey: string): Promise<void> {
  const bytes = await getObject(srcKey);
  await putObject(destKey, bytes);
}
