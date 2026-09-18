import { renderLinkedInCard } from "@/lib/linkedin-og";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  return renderLinkedInCard(searchParams);
}
