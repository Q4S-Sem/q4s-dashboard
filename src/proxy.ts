import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { isAuthRequired, sessionSigningSecret } from "@/lib/auth-policy";
import { isOpenbaar, userIdUitCookie } from "@/lib/proxy-auth";
import { db } from "@/lib/db";

/**
 * Proxy (voorheen middleware):
 *  1. Zet het pad in `x-pathname`, zodat (app)/layout.tsx de paginarechten kan afdwingen.
 *  2. Poort: buiten de openbare pagina's is een geldige sessie verplicht. Dat
 *     dekt ook server actions (die draaien vóór de layout-check) en de
 *     PDF-/download-routes onder (app). Schrijfacties (POST) checken daarbij of
 *     de gebruiker nog actief is; lezen leunt op de cookie + de layout.
 */
export async function proxy(request: NextRequest) {
  const pad = request.nextUrl.pathname;
  if (isAuthRequired() && !isOpenbaar(pad)) {
    const lezen = request.method === "GET" || request.method === "HEAD";
    const userId = userIdUitCookie(request.cookies.get("q4s_session")?.value, sessionSigningSecret());
    const actief =
      userId &&
      (lezen || Boolean((await db.appUser.findUnique({ where: { id: userId }, select: { active: true } }))?.active));
    if (!actief) {
      if (!lezen) return new NextResponse("Niet ingelogd", { status: 401, headers: { "Cache-Control": "no-store" } });
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pad);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Alles behalve statische bestanden en API-routes; die hebben hun eigen auth.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
