import { renderLinkedInCard } from "@/lib/linkedin-og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const res = await renderLinkedInCard(searchParams);
  // Download = exact het voorbeeld: de browser hergebruikt de getoonde afbeelding.
  res.headers.set("Cache-Control", "private, max-age=3600");
  return res;
}
