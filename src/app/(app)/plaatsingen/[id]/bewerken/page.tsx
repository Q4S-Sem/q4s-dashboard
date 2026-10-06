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
    db.placement.findUnique({
      where: { id },
      include: {
        consultant: {
          select: { companyName: true, iban: true, kvkNumber: true, vatNumber: true, email: true, phone: true, address: true, postalCode: true, city: true, employmentType: true },
        },
      },
    }),
    db.consultant.findMany({
      // Ook inactieve: de huidige werknemer moet altijd in de keuzelijst staan.
      where: { OR: [{ active: true }, { placements: { some: { id } } }] },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
    db.client.findMany({
      orderBy: { companyName: "asc" },
      select: { id: true, companyName: true },
    }),
  ]);

  if (!placement) notFound();
  // Einddatum van het nieuwste contract van deze plaatsing (of persoon).
  const contract = await db.contract.findFirst({
    where: { endDate: { not: null }, OR: [{ placementId: placement.id }, { consultantId: placement.consultantId }] },
    orderBy: [{ endDate: "desc" }],
    select: { endDate: true, number: true },
  });
  const e = contract?.endDate;
  const contractEinde = e
    ? {
        datum: `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, "0")}-${String(e.getDate()).padStart(2, "0")}`,
        label: contract.number ?? "",
      }
    : null;

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
        contractEinde={contractEinde}
        billing={placement.consultant.employmentType === "LOONDIENST" ? null : placement.consultant}
      />
    </div>
  );
}
