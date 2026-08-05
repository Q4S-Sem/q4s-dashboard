import Link from "next/link";
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
      <Link
        href={`/plaatsingen/${placement.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar plaatsing
      </Link>
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
