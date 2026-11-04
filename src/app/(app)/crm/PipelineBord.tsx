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

const chip = (aan: boolean) =>
  `inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[13px] font-medium transition-colors ${
    aan ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white text-ink-700 hover:bg-ink-50"
  }`;

/** Het pipeline-bord van één wervingsspoor (Projecten of WNS+Deta vast). */
export async function PipelineBord({ spoor, vacature }: { spoor: Spoor; vacature?: string }) {
  const recruiterId = await currentRecruiterId();
  const settings = await getCrmSettings(recruiterId);

  // Eén gedeelde pipeline per spoor: iedereen ziet alle deals (scope = "all").
  const board = await getBoardData({ recruiterId, scope: "all", visibleStages: settings.visibleStages, onlyWithCandidate: true, spoor });

  const openCount = board.cards.length;
  // Per vacature: zie in één oogopslag wie er op welke vacature loopt.
  // ponytail: filter op vacaturetitel; op id als twee open vacatures ooit dezelfde titel hebben.
  const perVacature = new Map<string, number>();
  for (const c of board.cards) if (c.vacancyTitle) perVacature.set(c.vacancyTitle, (perVacature.get(c.vacancyTitle) ?? 0) + 1);
  const pad = spoor === "VAST" ? "/vast/pipeline" : "/crm";
  const kaarten = vacature ? board.cards.filter((c) => c.vacancyTitle === vacature) : board.cards;

  // Deal board columns/cards.
  const dealColumns: DealColumn[] = board.stages.map((s) => ({
    id: s.id,
    label: s.name,
    color: s.color,
    probability: s.probability,
    isLost: s.isLost,
  }));
  const dealCards: DealCard[] = kaarten.map((c) => ({
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
        description="Sollicitanten zet je met één klik als Lead op hun vacature (bij Afgelopen 24 uur of de sollicitaties van een vacature). Sleep een kaart naar de volgende fase."
      />

      {perVacature.size > 0 && (
        <nav className="flex flex-wrap gap-1.5" aria-label="Filter op vacature">
          <Link href={pad} className={chip(!vacature)}>
            Alle vacatures <span className="tabular-nums opacity-60">{openCount}</span>
          </Link>
          {[...perVacature].sort((a, b) => b[1] - a[1]).map(([titel, n]) => (
            <Link key={titel} href={`${pad}?vacature=${encodeURIComponent(titel)}`} className={chip(vacature === titel)}>
              {titel} <span className="tabular-nums opacity-60">{n}</span>
            </Link>
          ))}
        </nav>
      )}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-ink-500">
        <span><b className="tabular-nums text-ink-900">{kaarten.length}</b> open{vacature ? ` op ${vacature}` : ""}</span>
        <Link href="/archief?type=crm" className="ml-auto hover:underline">
          <Archive className="mr-1 inline h-4 w-4" />
          Archief
        </Link>
      </div>

      <DealBoard columns={dealColumns} cards={dealCards} />
    </div>
  );
}
