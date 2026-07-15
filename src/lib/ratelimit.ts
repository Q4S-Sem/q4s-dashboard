import { headers } from "next/headers";

// Best-effort in-memory rate limiting for public endpoints. Not shared across
// instances and resets on restart, but meaningfully raises the bar against
// flooding. Key your calls with a namespace prefix to avoid cross-endpoint
// collisions, e.g. rateLimited(`vakproef:${await clientIp()}`, 8, 60_000).
const buckets = new Map<string, number[]>();

// NOTE: x-forwarded-for is client-spoofable unless you sit behind a trusted
// proxy and read the correct hop. Treat a per-IP limit as defence-in-depth only
// and ALWAYS pair it with a non-IP gate (a global cap and/or an email throttle).
export async function clientIp(): Promise<string> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim() || "unknown";
  return h.get("x-real-ip") ?? "unknown";
}

export function rateLimited(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  recent.push(now);
  buckets.set(key, recent);
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.every((t) => now - t >= windowMs)) buckets.delete(k);
    }
  }
  return recent.length > max;
}
