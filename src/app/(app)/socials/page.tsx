import { redirect } from "next/navigation";

// De LinkedIn-generator is verhuisd naar de Vacatures-hub (Website-sectie).
// Deze route blijft bestaan zodat oude links/bookmarks blijven werken.
export default async function SocialsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ vac?: string }>;
}) {
  const { vac } = await searchParams;
  redirect(vac ? `/website/linkedin?vac=${vac}` : "/website/linkedin");
}
