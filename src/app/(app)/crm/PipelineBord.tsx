import Link from "next/link";
import { Archive } from "lucide-react";
import { SPOOR, type Spoor } from "@/lib/spoor";
import { PageHeader } from "@/components/ui/page-header";
import {
  currentRecruiterId,
  getCrmSettings,
  getBoardData,
} from "@/lib/crm";
import { DealBoard, type DealColumn, type DealCard } from "./DealBoard";

/** Het pipeline-bord van één wervingsspoor (Projecten of WNS+Deta vast). */
export async function PipelineBord({ spoor }: { spoor: Spoor }) {
  const recruiterId = await currentRecruiterId();
  const settings = await getCrmSettings(recruiterId);

  // Eén gedeelde pipeline per spoor: iedereen ziet alle deals (scope = "all").
  const board = await getBoardData({ recruiterId, scope: "all", visibleStages: settings.visibleStages, onlyWithCandidate: true, spoor });

  const openCount = board.cards.length;

  // Deal board columns/cards.
  const dealColumns: DealColumn[] = board.stages.map((s) => ({
    id: s.id,
    label: s.name,
    color: s.color,
    probability: s.probability,
    isLost: s.isLost,
  }));
  const dealCards: DealCard[] = board.cards.map((c) => ({
    id: c.id,
    columnId: c.columnId,
    title: c.title,
    company: c.company,
    discipline: c.discipline,
    value: c.value,
    positions: c.positions,
    fitScore: c.fitScore,
    ownerName: c.ownerName,
    nextFollowUpAt: c.nextFollowUpAt ? c.nextFollowUpAt.toISOString() : null,
    lastActivityAt: c.lastActivityAt ? c.lastActivityAt.toISOString() : null,
    noteCount: c.noteCount,
    candidateName: c.candidateName,
    candidatePhoto: c.candidatePhoto,
    candidateHeadline: c.candidateHeadline,
    candidateLocation: c.candidateLocation,
    candidateRating: c.candidateRating,
    vacancyTitle: c.vacancyTitle,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${SPOOR[spoor].label} — pipeline`}
        description="Lead → Aan bedrijf voorgesteld → Gesprek / interview → Geplaatst / akkoord. Sleep een kaart naar de volgende fase. Verloren gaat (na bevestiging) direct naar het Archief."
      />

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-500">
        <span><b className="tabular-nums text-ink-900">{openCount}</b> open</span>
        <Link href="/archief?type=crm" className="ml-auto hover:underline">
          <Archive className="mr-1 inline h-4 w-4" />
          Archief
        </Link>
      </div>

      <DealBoard columns={dealColumns} cards={dealCards} />
    </div>
  );
}
