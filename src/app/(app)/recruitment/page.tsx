import type * as React from "react";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  CalendarClock,
  ClipboardList,
  FileUser,
  Inbox,
  ListTodo,
  Sparkles,
  Target,
  Users,
  Zap,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import {
  ALERT_TYPES,
  APPLICATION_STATUSES,
  CRM_NOTE_TYPES,
  DISCIPLINES,
  colorFor,
  labelFor,
} from "@/lib/domain";
import {
  APPLICATION_IDLE_DAYS,
  CANDIDATE_IDLE_DAYS,
  RECRUITMENT_KPI_LABELS,
  stalledBefore,
} from "@/lib/recruitment-kpi";
import { getOpenTasks } from "@/lib/activities";

export const metadata = { title: "Cockpit" };
export const dynamic = "force-dynamic";

// De Recruitment-cockpit: de werkvoorraad van de recruiter op één pagina. Puur
// ALLEEN-LEZEN — elke kaart is een lijstje met doorklik-links naar de pagina waar
// het werk gebeurt. Er wordt hier niets gemaild, van status veranderd of
// aangemaakt; dat blijft overal een knop die een mens indrukt.

/** Hoeveel rijen per kaart; de rest zit achter de "alles bekijken"-link. */
const ROWS = 6;

/** Sterke match = minstens deze score, gevonden in de afgelopen MATCH_DAYS dagen. */
const STRONG_MATCH_SCORE = 0.7;
const MATCH_DAYS = 7;

/** De entiteiten waarvan een open taak recruitment-werk is. */
const RECRUITMENT_TASK_ENTITIES = new Set(["candidate", "application"]);

function candidateName(c: { firstName: string; lastName: string }): string {
  return `${c.firstName} ${c.lastName}`.trim() || "Onbekende kandidaat";
}

/** Kaart met een lijstje werk + een link naar de pagina waar je het afhandelt. */
function QueueCard({
  title,
  icon,
  count,
  href,
  linkLabel,
  emptyTitle,
  emptyDescription,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  count: number;
  href: string;
  linkLabel: string;
  emptyTitle: string;
  emptyDescription: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {icon} {title}
          <span className="text-xs font-normal text-ink-400">({count})</span>
        </CardTitle>
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-ink-600 hover:text-brand-700"
        >
          {linkLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </CardHeader>
      {count === 0 ? (
        <CardContent className="p-2">
          <EmptyState title={emptyTitle} description={emptyDescription} className="py-8" />
        </CardContent>
      ) : (
        <CardContent className="p-0">
          <div className="divide-y divide-ink-100">{children}</div>
        </CardContent>
      )}
    </Card>
  );
}

function Row({
  href,
  primary,
  secondary,
  trailing,
}: {
  href: string;
  primary: string;
  secondary?: React.ReactNode;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-5 py-3">
      <div className="min-w-0">
        <Link href={href} className="block truncate text-sm font-medium text-ink-900 hover:text-brand-700">
          {primary}
        </Link>
        {secondary && (
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-500">{secondary}</p>
        )}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
    </div>
  );
}

export default async function RecruitmentCockpitPage() {
  const now = new Date();
  const candidateCutoff = stalledBefore(now, CANDIDATE_IDLE_DAYS);
  const applicationCutoff = stalledBefore(now, APPLICATION_IDLE_DAYS);
  const matchCutoff = new Date(now.getTime() - MATCH_DAYS * 86_400_000);
  const openApplicationStatuses = { in: ["NEW", "SCREENING", "PROPOSED"] };

  const [
    newApplications,
    newApplicationCount,
    openAlerts,
    openAlertCount,
    strongMatches,
    strongMatchCount,
    stalledCandidates,
    stalledCandidateCount,
    stalledApplications,
    stalledApplicationCount,
    openTasks,
  ] = await Promise.all([
    db.application.findMany({
      where: { status: "NEW" },
      orderBy: { createdAt: "desc" },
      take: ROWS,
      select: {
        id: true,
        createdAt: true,
        candidate: { select: { firstName: true, lastName: true, discipline: true } },
        vacancy: { select: { title: true } },
      },
    }),
    db.application.count({ where: { status: "NEW" } }),
    db.recruiterAlert.findMany({
      where: { read: false },
      orderBy: { createdAt: "desc" },
      take: ROWS,
      select: { id: true, type: true, title: true, href: true, createdAt: true },
    }),
    db.recruiterAlert.count({ where: { read: false } }),
    db.vacancyMatch.findMany({
      where: { score: { gte: STRONG_MATCH_SCORE }, createdAt: { gte: matchCutoff } },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: ROWS,
      select: {
        id: true,
        score: true,
        reason: true,
        candidate: { select: { id: true, firstName: true, lastName: true } },
        vacancy: { select: { id: true, title: true } },
      },
    }),
    db.vacancyMatch.count({
      where: { score: { gte: STRONG_MATCH_SCORE }, createdAt: { gte: matchCutoff } },
    }),
    db.candidate.findMany({
      where: { updatedAt: { lt: candidateCutoff } },
      orderBy: { updatedAt: "asc" },
      take: ROWS,
      select: { id: true, firstName: true, lastName: true, discipline: true, updatedAt: true },
    }),
    db.candidate.count({ where: { updatedAt: { lt: candidateCutoff } } }),
    db.application.findMany({
      where: { status: openApplicationStatuses, updatedAt: { lt: applicationCutoff } },
      orderBy: { updatedAt: "asc" },
      take: ROWS,
      select: {
        id: true,
        status: true,
        updatedAt: true,
        candidate: { select: { firstName: true, lastName: true } },
        vacancy: { select: { title: true } },
      },
    }),
    db.application.count({
      where: { status: openApplicationStatuses, updatedAt: { lt: applicationCutoff } },
    }),
    getOpenTasks(),
  ]);

  // Hergebruik van het centrale "Te doen"-overzicht; hier alleen de taken die bij
  // een kandidaat of sollicitatie horen.
  const recruitmentTasks = openTasks.filter((t) => RECRUITMENT_TASK_ENTITIES.has(t.entityType));
  const stalledTotal = stalledCandidateCount + stalledApplicationCount;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Cockpit"
        description="Je werkvoorraad als recruiter op één pagina: nieuwe sollicitaties, CV's die op review wachten, verse sterke matches en wat is blijven liggen. Alleen-lezen — klik door naar de pagina waar je het afhandelt."
        actions={
          <>
            <Link href="/sollicitaties" className={buttonVariants({ variant: "outline" })}>
              <ClipboardList className="h-4 w-4" /> Sollicitaties
            </Link>
            <Link href="/kandidaten" className={buttonVariants()}>
              <Users className="h-4 w-4" /> Talentpool
            </Link>
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Nieuwe sollicitaties"
          value={newApplicationCount}
          sub="fase Nieuw"
          icon={<Inbox className="h-5 w-5" />}
          accent={newApplicationCount ? "brand" : "slate"}
        />
        <StatCard
          label="CV's te beoordelen"
          value={openAlertCount}
          sub="ongelezen meldingen"
          icon={<BellRing className="h-5 w-5" />}
          accent={openAlertCount ? "violet" : "slate"}
        />
        <StatCard
          label="Nieuwe sterke matches"
          value={strongMatchCount}
          sub={`≥ ${Math.round(STRONG_MATCH_SCORE * 100)}% · laatste ${MATCH_DAYS} dagen`}
          icon={<Sparkles className="h-5 w-5" />}
          accent={strongMatchCount ? "green" : "slate"}
        />
        <StatCard
          label="Vastgelopen"
          value={stalledTotal}
          sub={`kandidaten > ${CANDIDATE_IDLE_DAYS} dagen · sollicitaties > ${APPLICATION_IDLE_DAYS} dagen`}
          icon={<CalendarClock className="h-5 w-5" />}
          accent={stalledTotal ? "amber" : "slate"}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <QueueCard
          title="Nieuwe sollicitaties"
          icon={<Inbox className="h-4 w-4 text-ink-400" />}
          count={newApplicationCount}
          href="/sollicitaties"
          linkLabel="Alle sollicitaties"
          emptyTitle="Geen nieuwe sollicitaties"
          emptyDescription="Alles in de fase Nieuw is opgepakt. Nieuwe reacties van de website komen hier automatisch te staan."
        >
          {newApplications.map((a) => (
            <Row
              key={a.id}
              href={`/sollicitaties/${a.id}`}
              primary={candidateName(a.candidate)}
              secondary={
                <>
                  <span>{a.vacancy?.title ?? "geen vacature gekoppeld"}</span>
                  {a.candidate.discipline && <span>{labelFor(DISCIPLINES, a.candidate.discipline)}</span>}
                  <span>binnengekomen {formatDate(a.createdAt)}</span>
                </>
              }
              trailing={<StatusBadge options={APPLICATION_STATUSES} value="NEW" />}
            />
          ))}
        </QueueCard>

        <QueueCard
          title="CV's te beoordelen"
          icon={<FileUser className="h-4 w-4 text-ink-400" />}
          count={openAlertCount}
          href="/website/cv-inbox"
          linkLabel="Naar de CV-inbox"
          emptyTitle="Geen openstaande meldingen"
          emptyDescription="Elke uitgelezen CV-shortlist en elke dubbele kandidaat komt hier te staan tot je hem hebt nagekeken."
        >
          {openAlerts.map((alert) => (
            <Row
              key={alert.id}
              href={alert.href ?? "/website/cv-inbox"}
              primary={alert.title}
              secondary={<span>{formatDate(alert.createdAt)}</span>}
              trailing={
                <Badge color={colorFor(ALERT_TYPES, alert.type)}>{labelFor(ALERT_TYPES, alert.type)}</Badge>
              }
            />
          ))}
        </QueueCard>

        <QueueCard
          title="Nieuwe sterke matches"
          icon={<Target className="h-4 w-4 text-ink-400" />}
          count={strongMatchCount}
          href="/website/cv-inbox/matches"
          linkLabel="Naar de CV-matches"
          emptyTitle="Nog geen verse sterke matches"
          emptyDescription={`Matches vanaf ${Math.round(STRONG_MATCH_SCORE * 100)}% uit de laatste ${MATCH_DAYS} dagen verschijnen hier. Zet op een vacature “Ik zoek kandidaten” en zoek matches.`}
        >
          {strongMatches.map((m) => (
            <Row
              key={m.id}
              href={`/kandidaten/${m.candidate.id}`}
              primary={candidateName(m.candidate)}
              secondary={
                <>
                  <Link href={`/vacatures/${m.vacancy.id}`} className="hover:text-brand-700">
                    {m.vacancy.title}
                  </Link>
                  {m.reason && <span className="line-clamp-1">{m.reason}</span>}
                </>
              }
              trailing={
                <span className="rounded-sm bg-emerald-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-emerald-800">
                  {Math.round(m.score * 100)}%
                </span>
              }
            />
          ))}
        </QueueCard>

        <QueueCard
          title="Blijven liggen"
          icon={<CalendarClock className="h-4 w-4 text-ink-400" />}
          count={stalledTotal}
          href="/dashboard/kpi"
          linkLabel="Naar de KPI's"
          emptyTitle="Niets blijven liggen"
          emptyDescription={`Geen kandidaat langer dan ${CANDIDATE_IDLE_DAYS} dagen en geen open sollicitatie langer dan ${APPLICATION_IDLE_DAYS} dagen zonder opvolging.`}
        >
          {stalledApplications.map((a) => (
            <Row
              key={a.id}
              href={`/sollicitaties/${a.id}`}
              primary={`${candidateName(a.candidate)} · ${a.vacancy?.title ?? "geen vacature gekoppeld"}`}
              secondary={<span>bijgewerkt {formatDate(a.updatedAt)}</span>}
              trailing={<StatusBadge options={APPLICATION_STATUSES} value={a.status} />}
            />
          ))}
          {stalledCandidates.map((c) => (
            <Row
              key={c.id}
              href={`/kandidaten/${c.id}`}
              primary={candidateName(c)}
              secondary={
                <>
                  {c.discipline && <span>{labelFor(DISCIPLINES, c.discipline)}</span>}
                  <span>bijgewerkt {formatDate(c.updatedAt)}</span>
                </>
              }
              trailing={<Badge color="amber">Kandidaat</Badge>}
            />
          ))}
        </QueueCard>
      </div>

      <QueueCard
        title="Open recruitment-taken"
        icon={<ListTodo className="h-4 w-4 text-ink-400" />}
        count={recruitmentTasks.length}
        href="/dashboard/te-doen"
        linkLabel="Alle taken"
        emptyTitle="Geen open taken"
        emptyDescription="Taken bij een kandidaat of sollicitatie — zelf vastgelegd of door een automatische regel aangemaakt — staan hier tot ze zijn afgevinkt."
      >
        {recruitmentTasks.slice(0, ROWS).map((t) => (
          <Row
            key={t.id}
            href={t.href}
            primary={t.body}
            secondary={
              <>
                <span>{t.entityLabel}</span>
                {t.dueAt && <span>uiterlijk {formatDate(t.dueAt)}</span>}
                {t.ruleGenerated && (
                  <span className="inline-flex items-center gap-1 rounded-sm bg-brand-50 px-2 py-0.5 font-medium text-brand-700">
                    <Zap className="h-3 w-3" /> automatisch
                  </span>
                )}
              </>
            }
            trailing={<Badge color={colorFor(CRM_NOTE_TYPES, t.type)}>{labelFor(CRM_NOTE_TYPES, t.type)}</Badge>}
          />
        ))}
      </QueueCard>

      <p className="text-xs text-ink-400">
        {RECRUITMENT_KPI_LABELS.stalledCandidates} en {RECRUITMENT_KPI_LABELS.stalledApplications} gebruiken dezelfde
        drempels als je automatische regels ({CANDIDATE_IDLE_DAYS} en {APPLICATION_IDLE_DAYS} dagen).
      </p>
    </div>
  );
}
