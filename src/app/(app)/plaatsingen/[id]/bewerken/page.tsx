import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { PlacementForm } from "../../PlacementForm";
import { updatePlacement } from "../../actions";

export const metadata = { title: "Plaatsing bewerken" };

export default async function PlaatsingBewerkenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [placement, consultants, clients] = await Promise.all([
    db.placement.findUnique({ where: { id } }),
    db.consultant.findMany({
      where: { active: true },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
    db.client.findMany({
      orderBy: { companyName: "asc" },
      select: { id: true, companyName: true },
    }),
  ]);

  if (!placement) notFound();

  return (
    <div className="space-y-6">
      <BackLink href={`/plaatsingen/${placement.id}`}>
        Terug naar plaatsing
      </BackLink>
      <PageHeader title="Plaatsing bewerken" description={placement.title} />
      <PlacementForm
        action={updatePlacement}
        placement={placement}
        consultants={consultants}
        clients={clients}
        submitLabel="Wijzigingen opslaan"
        cancelHref={`/plaatsingen/${placement.id}`}
      />
    </div>
  );
}
