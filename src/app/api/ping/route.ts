// Lightweight reachability check for the online/offline indicator. No DB, fast.
export const dynamic = "force-dynamic";

export function GET() {
  return new Response("ok", {
    headers: { "Cache-Control": "no-store" },
  });
}
