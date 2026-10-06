import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Clock,
  Pencil,
  IdCard,
  Coins,
  FileText,
  StickyNote,
  CalendarRange,
  MapPin,
  ScrollText,
  Archive,
  RotateCcw,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { DossierTabs } from "@/components/dossier-tabs";
import { PLACEMENT_STATUSES } from "@/lib/domain";
import { formatDate } from "@/lib/utils";
import { archivePlacement, deletePlacement, restorePlacement } from "../../actions";
import { getPlacement, getDossierCounts } from "./data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const placement = await getPlacement(id);
  return { title: placement?.title ?? "Plaatsing" };
}

/** Eén feitje in de rij onder de titel. */
function Chip({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-sm border border-ink-200 bg-white px-3 py-1 text-xs text-ink-600">
      {icon}
      <span className="truncate">{children}</span>
    </span>
  );
}

/**
 * Het plaatsing-dossier: één vaste kop (functie, wie bij welke klant, acties)
 * met daaronder de mappen-tabs. Alleen de inhoud van het mapje wisselt.
 * `bewerken/` valt bewust buiten deze route-groep, dus dat formulier krijgt
 * geen tabbalk.
 */
export default async function PlaatsingDossierLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [placement, counts] = await Promise.all([getPlacement(id), getDossierCounts(id)]);
  if (!placement) notFound();

  const person = `${placement.consultant.firstName} ${placement.consultant.lastName}`;

  return (
    <div className="space-y-6">
      <BackLink href="/plaatsingen">
        Terug naar plaatsingen
      </BackLink>

      <PageHeader
        title={placement.title}
        description={`${person} bij ${placement.client?.companyName ?? "— geen bedrijf"}`}
        actions={
          <>
            {/* Uren registreren staat in het mapje Uren — niet meer in de kop. */}
            <Link
              href={`/plaatsingen/${placement.id}/bewerken`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Pencil className="h-4 w-4" /> Bewerken
            </Link>
            {placement.status === "ARCHIVED" ? (
              <ConfirmSubmit
                action={restorePlacement}
                id={placement.id}
                variant="secondary"
                message={`${person} weer in dienst nemen?`}
                description="De plaatsing gaat terug naar actief met alle tarieven en gegevens. Je past daarna de start- en einddatum aan."
              >
                <RotateCcw className="h-4 w-4" /> Terugzetten
              </ConfirmSubmit>
            ) : (
              <ConfirmSubmit
                action={archivePlacement}
                id={placement.id}
                variant="outline"
                message={`${person} uit dienst — plaatsing archiveren?`}
                description="De plaatsing verdwijnt uit de lijst en gaat naar het archief. Er wordt niets verwijderd: met één klik zet je hem terug."
              >
                <Archive className="h-4 w-4" /> Archiveren
              </ConfirmSubmit>
            )}
            <ConfirmSubmit
              action={deletePlacement}
              id={placement.id}
              message={`Plaatsing "${placement.title}" verwijderen? De bijbehorende urenstaten worden ook verwijderd.`}
            >
              Verwijderen
            </ConfirmSubmit>
          </>
        }
      />

      {/* Kerngegevens in één oogopslag */}
      <div className="flex flex-wrap items-center gap-2">
        <StatusBadge options={PLACEMENT_STATUSES} value={placement.status} />
        <Chip icon={<CalendarRange className="h-3.5 w-3.5" />}>
          {formatDate(placement.startDate)} – {placement.endDate ? formatDate(placement.endDate) : "heden"}
        </Chip>
        {placement.workLocation && (
          <Chip icon={<MapPin className="h-3.5 w-3.5" />}>{placement.workLocation}</Chip>
        )}
      </div>

      <DossierTabs
        base={`/plaatsingen/${placement.id}`}
        label="Plaatsingdossier"
        tabs={[
          { seg: "", label: "Gegevens", icon: <IdCard className="h-4 w-4" /> },
          { seg: "tarieven", label: "Tarieven", icon: <Coins className="h-4 w-4" /> },
          {
            seg: "documenten",
            label: "Documenten",
            icon: <FileText className="h-4 w-4" />,
            count: placement.consultant.documents.length,
          },
          {
            seg: "contracten",
            label: "Contracten",
            icon: <ScrollText className="h-4 w-4" />,
            count: counts.contracts,
          },
          {
            seg: "uren",
            label: "Uren",
            icon: <Clock className="h-4 w-4" />,
            count: counts.timesheets,
          },
          {
            seg: "notities",
            label: "Notities",
            icon: <StickyNote className="h-4 w-4" />,
            count: counts.notes,
          },
        ]}
      />

      {children}
    </div>
  );
}
