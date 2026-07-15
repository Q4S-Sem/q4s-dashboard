import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// Only ever redirect to an internal path (the destination is set by an
// authenticated user, but guard anyway against off-origin values).
function safeInternalPath(raw: string, fallback = "/talentpool"): string {
  try {
    const u = new URL(raw, "http://x.invalid");
    return u.origin === "http://x.invalid" ? u.pathname + u.search + u.hash : fallback;
  } catch {
    return fallback;
  }
}

/**
 * Trackable short link: /v/<token>. Increments the click counter, drops a
 * first-party cookie so a later Talentpool signup can be attributed back to this
 * campaign, then redirects to the link's internal destination (default the
 * talentpool landing page) with ?bron=<token>.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  const link = await db.postLink.findUnique({ where: { token } });
  const destination = link
    ? safeInternalPath(link.destination, "/talentpool")
    : "/talentpool";

  if (link) {
    await db.postLink.update({
      where: { token },
      data: { clicks: { increment: 1 }, lastClickAt: new Date() },
    });
  }

  const url = new URL(destination, req.url);
  if (link) url.searchParams.set("bron", token);

  const res = NextResponse.redirect(url, 307);
  if (link) {
    res.cookies.set("q4s_src", token, {
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
      httpOnly: true,
      sameSite: "lax",
    });
  }
  return res;
}
