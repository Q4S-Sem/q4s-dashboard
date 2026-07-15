import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// Password hashing for app-gebruikers. Stored as "salt:hash" (hex), scrypt.
// Never store or log plain-text passwords. Server-only (node:crypto).

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(
  password: string,
  stored: string | null | undefined,
): boolean {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const hashed = Buffer.from(hash, "hex");
  const test = scryptSync(password, salt, 64);
  return hashed.length === test.length && timingSafeEqual(hashed, test);
}
