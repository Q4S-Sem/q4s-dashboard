import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { sessionSigningSecret } from "./auth-policy";

// Versleuteling voor portaal-wachtwoorden (AES-256-GCM). De sleutel komt uit
// VAULT_SECRET, anders afgeleid van AUTH_SECRET — zo hoeft er niks extra's op
// Vercel te staan. ponytail: AUTH_SECRET roteren maakt bestaande wachtwoorden
// onleesbaar; zet dan eerst VAULT_SECRET op de oude waarde.

function key(secret = process.env.VAULT_SECRET?.trim() || sessionSigningSecret()): Buffer {
  if (!secret) throw new Error("Geen VAULT_SECRET/AUTH_SECRET ingesteld.");
  return createHash("sha256").update(`q4s-vault:${secret}`).digest();
}

/** Versleutel naar "iv.tag.data" (base64url). Leeg blijft leeg. */
export function encryptSecret(plain: string, secret?: string): string {
  if (!plain) return "";
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(secret), iv);
  const data = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decryptSecret(enc: string, secret?: string): string {
  if (!enc) return "";
  const [iv, tag, data] = enc.split(".").map((p) => Buffer.from(p, "base64url"));
  const d = createDecipheriv("aes-256-gcm", key(secret), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]).toString("utf8");
}
