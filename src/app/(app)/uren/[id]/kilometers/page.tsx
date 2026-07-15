import { redirect } from "next/navigation";

// Kilometers worden nu samen met de uren bewerkt op "Weekstaat bewerken".
// Oude links/bookmarks naar de losse kilometerpagina sturen we daarheen door.
export const dynamic = "force-dynamic";

export default async function KilometersRedirect({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/uren/${id}/bewerken`);
}
