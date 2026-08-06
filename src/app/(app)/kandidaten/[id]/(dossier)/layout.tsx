import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Pencil,
  IdCard,
  Building2,
  MessageSquare,
  FileText,
  ClipboardList,
} from "lucide-react";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { DossierTabs } from "@/components/dossier-tabs";
import { DISCIPLINES, labelFor } from "@/lib/domain";
import { person } from "@/lib/people";
import { deleteCandidate, uploadPhoto, deletePhoto } from "../../actions";
import { PhotoPicker } from "../../PhotoPicker";
import { getCandidate, getDossierCounts } from "./data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const c = await getCandidate(id);
  return { title: c ? `${c.firstName} ${c.lastName}` : "Kandidaat" };
}

/**
 * Het kandidaatdossier: één vaste kop (foto, naam, acties) met daaronder de
 * mappen-tabs — dezelfde opzet als het klantdossier. Alleen de inhoud van het
 * mapje wisselt. `bewerken/` valt bewust buiten deze route-groep, dus dat
 * formulier krijgt geen tabbalk.
 */
export default async function KandidaatDossierLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [candidate, counts] = await Promise.all([
    getCandidate(id),
    getDossierCounts(id),
  ]);
  if (!candidate) notFound();

  const name = `${candidate.firstName} ${candidate.lastName}`;

  return (
    <div className="space-y-6">
      <BackLink href="/kandidaten">Terug naar talentpool</BackLink>

      <PageHeader
        title={name}
        description={candidate.headline ?? labelFor(DISCIPLINES, candidate.discipline)}
        leading={
          <PhotoPicker
            candidateId={candidate.id}
            name={name}
            src={person(candidate).src}
            uploadAction={uploadPhoto}
            deleteAction={deletePhoto}
          />
        }
        actions={
          <>
            <Link
              href={`/kandidaten/${candidate.id}/bewerken`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Pencil className="h-4 w-4" /> Bewerken
            </Link>
            <ConfirmSubmit
              action={deleteCandidate}
              id={candidate.id}
              message={`Kandidaat "${name}" verwijderen?`}
            >
              Verwijderen
            </ConfirmSubmit>
          </>
        }
      />

      <DossierTabs
        base={`/kandidaten/${candidate.id}`}
        label="Kandidaatdossier"
        tabs={[
          { seg: "", label: "Overzicht", icon: <IdCard className="h-4 w-4" /> },
          {
            seg: "plaatsingen",
            label: "Plaatsingen",
            icon: <Building2 className="h-4 w-4" />,
            count: counts.placements,
          },
          {
            seg: "sollicitaties",
            label: "Sollicitaties",
            icon: <ClipboardList className="h-4 w-4" />,
            count: counts.applications,
          },
          { seg: "cv", label: "CV", icon: <FileText className="h-4 w-4" /> },
          {
            seg: "notities",
            label: "Notities",
            icon: <MessageSquare className="h-4 w-4" />,
            count: counts.notes,
          },
        ]}
      />

      {children}
    </div>
  );
}
