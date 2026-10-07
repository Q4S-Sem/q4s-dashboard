import { redirect } from "next/navigation";

// Contracten staan nu samen met de documenten.
export default async function PlaatsingContractenTab({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/plaatsingen/${id}/documenten`);
}
