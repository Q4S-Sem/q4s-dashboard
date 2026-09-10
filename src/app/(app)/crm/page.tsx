import Link from "next/link";
import { Plus, Kanban, Coins, Gauge, CalendarClock } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import {
  currentRecruiterId,
  getCrmSettings,
  getBoardData,
  countDueFollowUps,
} from "@/lib/crm";
import { DealBoard, type DealColumn, type DealCard } from "./DealBoard";

export const metadata = { title: "CRM" };
export const dynamic = "force-dynamic";

export default async function CrmPage() {
  const recruiterId = await currentRecruiterId();
  const settings = await getCrmSettings(recruiterId);

  // Eén gedeelde pipeline: iedereen ziet alle deals (scope = "all").
  const [board, openDeals, dueFollowUps] = await Promise.all([
    getBoardData({ recruiterId, scope: "all", visibleStages: settings.visibleStages }),
    db.deal.findMany({
      where: { status: "OPEN" },
      select: { value: true, probability: true },
    }),
    countDueFollowUps(recruiterId, "all"),
  ]);

  const openCount = openDeals.length;
  const pipelineValue = openDeals.reduce((s, d) => s + d.value, 0);
  const weightedValue = openDeals.reduce((s, d) => s + (d.value * d.probability) / 100, 0);

  // Deal board columns/cards.
  const dealColumns: DealColumn[] = board.stages.map((s) => ({
    id: s.id,
    label: s.name,
    color: s.color,
    probability: s.probability,
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
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM"
        description="Eén gedeelde pipeline om een kandidaat uit de talentpool bij een eigen klant te plaatsen op een openstaande vacature. Sleep deals tussen de fases; alles wat je doet wordt gelogd."
        actions={
          <Link href="/crm/deals/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuwe deal
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open deals" value={openCount} icon={<Kanban className="h-5 w-5" />} accent="brand" />
        <StatCard label="Pipelinewaarde" value={formatCurrency(pipelineValue)} icon={<Coins className="h-5 w-5" />} accent="violet" />
        <StatCard
          label="Gewogen waarde"
          value={formatCurrency(weightedValue)}
          sub="naar winkans"
          icon={<Gauge className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          label="Opvolgen"
          value={dueFollowUps}
          sub="vandaag of te laat"
          icon={<CalendarClock className="h-5 w-5" />}
          accent={dueFollowUps > 0 ? "amber" : "slate"}
        />
      </div>

      <DealBoard columns={dealColumns} cards={dealCards} />
    </div>
  );
}
