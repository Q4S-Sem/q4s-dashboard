import { NextResponse } from "next/server";

// Geeft de huidige build-versie van de LIVE server terug. De client pollt dit en
// merkt zo dat er een nieuwe deploy staat (de commit-sha verandert), om dan de
// "nieuwe update"-melding onderaan te tonen. Nooit cachen — anders ziet de client
// na een deploy nog de oude waarde.
export const dynamic = "force-dynamic";
export const revalidate = 0;

// Op Vercel is VERCEL_GIT_COMMIT_SHA per deploy uniek; lokaal valt 'ie terug op een
// vaste waarde zodat de melding daar niet onnodig afgaat.
const VERSION =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_BUILD_ID ??
  "dev";

export async function GET() {
  return NextResponse.json(
    { version: VERSION },
    { headers: { "cache-control": "no-store, max-age=0" } },
  );
}
