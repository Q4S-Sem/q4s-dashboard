import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Proxy (voorheen middleware). We doen hier GEEN autorisatie — dat gebeurt in
 * de server-layout waar we de database en de sessie kunnen lezen. Dit zet alleen
 * het huidige pad in een request-header (`x-pathname`), zodat de layout weet
 * welke route wordt opgevraagd en de toegangsrechten kan afdwingen.
 */
export function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Alles behalve statische bestanden en API-routes; die hebben hun eigen auth.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)"],
};
