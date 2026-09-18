import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { cardDefaultsFromDeal } from "@/lib/linkedin-card";
import { LinkedInEditor } from "./LinkedInEditor";

export const metadata = { title: "LinkedIn-afbeelding" };
export const dynamic = "force-dynamic";

export default async function LinkedInImagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deal = await db.deal.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      company: true,
      discipline: true,
      location: true,
      employmentType: true,
      hoursPerWeek: true,
      durationText: true,
      responsibilities: true,
      expectedCloseDate: true,
    },
  });
  if (!deal) notFound();

  const defaults = cardDefaultsFromDeal(deal);

  return (
    <div className="space-y-6">
      <BackLink href={`/crm/vacatures/${deal.id}`}>Terug naar vacature</BackLink>
      <PageHeader
        title="LinkedIn-afbeelding"
        description="Automatisch gevuld vanuit de vacature, in de vaste Q4S-huisstijl en het LinkedIn-formaat (1080×1080). Pas de tekst aan en download de afbeelding."
      />
      <LinkedInEditor dealId={deal.id} initial={defaults} ogBase={`/crm/vacatures/${deal.id}/linkedin/og`} />
    </div>
  );
}
