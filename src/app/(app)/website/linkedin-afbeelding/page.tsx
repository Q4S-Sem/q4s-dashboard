import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** De afbeelding-generator is samengevoegd met de tekst-generator onder
 *  /website/linkedin (schakelaar Vacaturetekst / Afbeelding). Oude links
 *  komen hier binnen en gaan door naar de afbeelding-tab. */
export default async function WebsiteLinkedInImageRedirect({
  searchParams,
}: {
  searchParams: Promise<{ vac?: string }>;
}) {
  const { vac } = await searchParams;
  const qs = new URLSearchParams({ view: "afbeelding" });
  if (vac) qs.set("vac", vac);
  redirect(`/website/linkedin?${qs.toString()}`);
}
