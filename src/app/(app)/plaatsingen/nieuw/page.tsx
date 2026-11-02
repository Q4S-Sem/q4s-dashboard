import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { PlacementForm } from "../PlacementForm";
import { createPlacement, wisPlaatsingConcept } from "../actions";
import { ConceptWissen } from "@/components/concept-wissen";

export const metadata = { title: "Nieuwe plaatsing" };

const weekGeleden = () => new Date(Date.now() - 7 * 864e5);

export default async function NieuwePlaatsingPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; leeg?: string }>;
}) {
  const { draft: gekozen, leeg } = await searchParams;
  // Terug op "Nieuwe plaatsing" na tussendoor iets anders? Dan gaat het laatste
  // (automatisch bewaarde) concept van de afgelopen week gewoon verder. "Wis alles" → ?leeg=1.
  const draftParam =
    gekozen ??
    (leeg
      ? undefined
      : (
          await db.placementDraft.findFirst({
            where: { updatedAt: { gte: weekGeleden() } },
            orderBy: { updatedAt: "desc" },
            select: { id: true },
          })
        )?.id);
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
      <BackLink href="/plaatsingen">
        Terug naar plaatsingen
      </BackLink>
      <PageHeader
        title={draftRow ? "Concept afmaken" : "Nieuwe plaatsing"}
        description="Koppel een bestaande werknemer aan een klant, of maak meteen een nieuwe werknemer aan (incl. CV, contract en diploma's). Wat je invult blijft bewaard, ook als je tussendoor iets anders opent."
        actions={
          draftRow ? (
            <ConceptWissen
              wat="deze plaatsing"
              wisServer={wisPlaatsingConcept.bind(null, draftRow.id)}
              leegUrl="/plaatsingen/nieuw?leeg=1"
            />
          ) : (
            <ConceptWissen wat="deze plaatsing" leegUrl="/plaatsingen/nieuw?leeg=1" />
          )
        }
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
