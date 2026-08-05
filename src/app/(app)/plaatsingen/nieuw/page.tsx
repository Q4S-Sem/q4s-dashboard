import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { PlacementForm } from "../PlacementForm";
import { createPlacement } from "../actions";

export const metadata = { title: "Nieuwe plaatsing" };

export default async function NieuwePlaatsingPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string }>;
}) {
  const { draft: draftParam } = await searchParams;
  const [consultants, clients, draftRow] = await Promise.all([
    db.consultant.findMany({
      where: { active: true },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
    db.client.findMany({
      orderBy: { companyName: "asc" },
      select: { id: true, companyName: true },
    }),
    draftParam ? db.placementDraft.findUnique({ where: { id: draftParam } }) : Promise.resolve(null),
  ]);

  let draft: Record<string, string> | undefined;
  if (draftRow) {
    try {
      draft = JSON.parse(draftRow.data) as Record<string, string>;
    } catch {
      draft = undefined;
    }
  }

  return (
    <div className="space-y-6">
      <Link
        href="/plaatsingen"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar plaatsingen
      </Link>
      <PageHeader
        title={draftRow ? "Concept afmaken" : "Nieuwe plaatsing"}
        description="Koppel een bestaande werknemer aan een klant, of maak meteen een nieuwe werknemer aan (incl. CV, contract en diploma's)."
      />
      <PlacementForm
        action={createPlacement}
        consultants={consultants}
        clients={clients}
        submitLabel="Plaatsing opslaan"
        cancelHref="/plaatsingen"
        draft={draft}
        draftId={draftRow?.id}
      />
    </div>
  );
}
