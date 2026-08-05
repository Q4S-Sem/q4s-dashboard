import Link from "next/link";
import { Plus, Kanban, Coins, Gauge, CalendarClock, Users2, BarChart3 } from "lucide-react";
import { db } from "@/lib/db";
import { candidatePhotoSrc } from "@/lib/people";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency, cn } from "@/lib/utils";
import {
  TARGET_STATUSES,
  APPLICATION_STATUSES,
  DISCIPLINES,
  colorFor,
  labelFor,
} from "@/lib/domain";
import {
  currentRecruiterId,
  getCrmSettings,
  getBoardData,
  countDueFollowUps,
} from "@/lib/crm";
import { CrmBoards } from "./CrmBoards";
import type { KanbanColumn, KanbanCard } from "./KanbanBoard";
import type { DealColumn, DealCard } from "./DealBoard";

export const metadata = { title: "CRM" };
export const dynamic = "force-dynamic";

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const sp = await searchParams;
  const recruiterId = await currentRecruiterId();
  const settings = await getCrmSettings(recruiterId);
  const scope: "mine" | "all" =
    sp.scope === "all" || sp.scope === "mine" ? sp.scope : settings.defaultScope;

  const dealWhere = scope === "mine" && recruiterId ? { ownerId: recruiterId } : {};

  const [board, openDeals, dueFollowUps, targets, applications] = await Promise.all([
    getBoardData({ recruiterId, scope, visibleStages: settings.visibleStages }),
    db.deal.findMany({
      where: { ...dealWhere, status: "OPEN" },
      select: { value: true, probability: true },
    }),
    countDueFollowUps(recruiterId, scope),
    db.targetClient.findMany({ orderBy: [{ priority: "desc" }, { name: "asc" }] }),
    db.application.findMany({
      include: { candidate: true, vacancy: true },
      orderBy: { updatedAt: "desc" },
    }),
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

  // Reference boards (unchanged).
  const targetColumns: KanbanColumn[] = TARGET_STATUSES.map((s) => ({
    id: s.value,
    label: s.label,
    color: s.color,
  }));
  const targetCards: KanbanCard[] = targets.map((t) => ({
    id: t.id,
    columnId: t.status,
    title: t.name,
    subtitle: t.sector,
    href: `/opdrachtgevers/${t.id}`,
    stars: t.priority,
    meta: t.contactName,
  }));
  const applicationColumns: KanbanColumn[] = APPLICATION_STATUSES.map((s) => ({
    id: s.value,
    label: s.label,
    color: s.color,
  }));
  const applicationCards: KanbanCard[] = applications.map((a) => ({
    id: a.id,
    columnId: a.status,
    title: `${a.candidate.firstName} ${a.candidate.lastName}`,
    subtitle: a.vacancy ? a.vacancy.title : "Open sollicitatie",
    href: `/sollicitaties/${a.id}`,
    showAvatar: true,
    avatarSrc: candidatePhotoSrc(a.candidate),
    tags: a.candidate.discipline
      ? [{ label: labelFor(DISCIPLINES, a.candidate.discipline), color: colorFor(DISCIPLINES, a.candidate.discipline) }]
      : [],
  }));

  const scopeTab = (value: "mine" | "all", label: string) => (
    <Link
      href={`/crm?scope=${value}`}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        scope === value ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="CRM"
        description="Het verkoopproces om openstaande vacatures van opdrachtgevers in te vullen met de juiste mensen. Sleep deals tussen de fases; alles wat je doet wordt gelogd."
        actions={
          <>
            <Link href="/crm/deals/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe deal
            </Link>
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex gap-1 rounded-lg border border-ink-200 bg-ink-50 p-1">
          {scopeTab("mine", "Mijn deals")}
          {scopeTab("all", "Team")}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/crm/opvolging" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <CalendarClock className="h-4 w-4" /> Opvolging
          </Link>
          <Link href="/crm/contacten" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Users2 className="h-4 w-4" /> Contacten
          </Link>
          <Link href="/crm/inzichten" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <BarChart3 className="h-4 w-4" /> Inzichten
          </Link>
        </div>
      </div>

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

      <CrmBoards
        dealColumns={dealColumns}
        dealCards={dealCards}
        targetColumns={targetColumns}
        targetCards={targetCards}
        applicationColumns={applicationColumns}
        applicationCards={applicationCards}
      />
    </div>
  );
}
