import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  AlertTriangle,
  ListTodo,
  CircleCheck,
  Briefcase,
  Building2,
  MapPin,
  Users2,
  ArrowRight,
  Kanban,
  Sparkles,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, cn } from "@/lib/utils";
import { TASK_PRIORITIES, DISCIPLINES, type BadgeColor } from "@/lib/domain";
import {
  currentRecruiterId,
  getFollowUpItems,
  getBoardData,
  startOfToday,
  endOfToday,
  type FollowUpItem,
} from "@/lib/crm";
import { completeFollowUp, completeTask } from "./actions";

export const metadata = { title: "Opvolging" };
export const dynamic = "force-dynamic";

function FollowUpRow({ item, tone }: { item: FollowUpItem; tone: "red" | "amber" | "slate" }) {
  const toneMap = {
    red: "text-red-600",
    amber: "text-amber-600",
    slate: "text-ink-400",
  };
  return (
    <li className="flex items-center gap-3 px-5 py-3">
      <form action={completeFollowUp}>
        <input type="hidden" name="source" value={item.source} />
        <input type="hidden" name="rawId" value={item.rawId} />
        <button
          type="submit"
          title="Afronden"
          className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-300 hover:bg-emerald-50 hover:text-emerald-600"
        >
          <CheckCircle2 className="h-5 w-5" />
        </button>
      </form>
      <div className="min-w-0 flex-1">
        <Link href={item.href} className="block truncate font-medium text-ink-900 hover:text-brand-700">
          {item.title}
        </Link>
        {item.subtitle && <p className="truncate text-xs text-ink-500">{item.subtitle}</p>}
        </div>
        <span className={cn("inline-flex items-center gap-1 text-xs font-medium tabular-nums", toneMap[tone])}>
        <CalendarClock className="h-3.5 w-3.5" />
        {formatDate(item.due)}
      </span>
    </li>
  );
}

export default async function OpvolgingPage() {
  const recruiterId = await currentRecruiterId();
  // Opvolging is altijd algemeen/team-breed — geen Mijn opvolging/Team-schakelaar.
  const scope = "all" as const;

  const [items, tasks, vacatures, board] = await Promise.all([
    getFollowUpItems({ recruiterId, scope }),
    db.task.findMany({
      where: { done: false },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 50,
    }),
    // Openstaande vacatures (deals zonder kandidaat) = moeten met een persoon gevuld.
    db.deal.findMany({
      where: { status: "OPEN", candidateId: null },
      include: {
        stage: true,
        client: { select: { id: true, companyName: true, city: true } },
      },
      orderBy: [{ expectedCloseDate: "asc" }, { createdAt: "desc" }],
      take: 30,
    }),
    // Pipeline-stand: deals mét kandidaat, per fase.
    getBoardData({ recruiterId, scope, onlyWithCandidate: true }),
  ]);

  const startToday = startOfToday().getTime();
  const endToday = endOfToday().getTime();
  const overdue = items.filter((i) => i.due.getTime() < startToday);
  const today = items.filter((i) => i.due.getTime() >= startToday && i.due.getTime() <= endToday);
  const upcoming = items.filter((i) => i.due.getTime() > endToday);

  // Pipeline-stand per fase (alleen open deals mét kandidaat).
  const openCards = board.cards.filter((c) => c.status === "OPEN");
  const stageBuckets = board.stages.map((s) => ({
    stage: s,
    cards: openCards.filter((c) => c.columnId === s.id),
  }));

  const nothing =
    items.length === 0 && tasks.length === 0 && vacatures.length === 0 && openCards.length === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Opvolging"
        description="Je focus-dashboard: openstaande vacatures die je met de juiste persoon moet vullen, de stand van je pipeline, en alles wat een vervolgactie nodig heeft. Zo zie je precies waar je contact mee moet houden — klanten én werknemers."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Vacatures te vullen" value={vacatures.length} icon={<Briefcase className="h-5 w-5" />} accent="brand" />
        <StatCard label="Kandidaten in pipeline" value={openCards.length} icon={<Kanban className="h-5 w-5" />} accent="violet" />
        <StatCard label="Over tijd" value={overdue.length} icon={<AlertTriangle className="h-5 w-5" />} accent={overdue.length > 0 ? "red" : "green"} />
        <StatCard label="Vandaag op te volgen" value={today.length} icon={<CalendarClock className="h-5 w-5" />} accent="amber" />
      </div>

      {nothing ? (
        <EmptyState
          icon={<CircleCheck className="h-6 w-6" />}
          title="Alles opgevolgd"
          description="Geen openstaande vacatures, pipeline-deals of opvolgingen. Zet een vacature in de Vacatures-pagina of plan een opvolging om hier iets te zien."
        />
      ) : (
        <>
          {/* Vacatures die met de juiste persoon gevuld moeten worden */}
          {vacatures.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Briefcase className="h-4 w-4 text-brand-600" /> Vacatures te vullen ({vacatures.length})
                </CardTitle>
                <Link href="/crm/vacatures" className="text-sm text-brand-700 hover:underline">
                  Alle vacatures
                </Link>
              </CardHeader>
              <ul className="divide-y divide-ink-100">
                {vacatures.map((v) => {
                  const overdueDate = v.expectedCloseDate && v.expectedCloseDate.getTime() < Date.now();
                  return (
                    <li key={v.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                        <Briefcase className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/crm/deals/${v.id}`} className="block truncate font-medium text-ink-900 hover:text-brand-700">
                          {v.title}
                        </Link>
                        <p className="flex items-center gap-2 truncate text-xs text-ink-500">
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 text-ink-400" />
                            {v.client?.companyName ?? v.company}
                          </span>
                          {v.client?.city && (
                            <span className="inline-flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-ink-400" /> {v.client.city}
                            </span>
                          )}
                          {v.positions > 1 && (
                            <span className="inline-flex items-center gap-1">
                              <Users2 className="h-3 w-3 text-ink-400" /> {v.positions} posities
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="hidden w-28 shrink-0 justify-end sm:flex">
                        {v.discipline && <StatusBadge options={DISCIPLINES} value={v.discipline} />}
                      </div>
                      <div className="hidden w-24 shrink-0 justify-end sm:flex">
                        {v.expectedCloseDate && (
                          <span className={cn("inline-flex items-center gap-1 text-xs font-medium tabular-nums", overdueDate ? "text-red-600" : "text-ink-400")} title="Verwachte startdatum">
                            <CalendarClock className="h-3.5 w-3.5" /> {formatDate(v.expectedCloseDate)}
                          </span>
                        )}
                      </div>
                      <Link
                        href={`/crm/vacatures/${v.id}/match`}
                        title="Laat AI de best passende kandidaten uit de talentpool zoeken"
                        className={cn(buttonVariants({ variant: "primary", size: "sm" }), "shrink-0")}
                      >
                        <Sparkles className="h-4 w-4" /> Zoek match
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}

          {/* Pipeline-stand: waar staan de gekoppelde kandidaten */}
          {openCards.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Kanban className="h-4 w-4 text-violet-600" /> Pipeline-stand ({openCards.length})
                </CardTitle>
                <Link href="/crm" className="text-sm text-brand-700 hover:underline">
                  Naar de pipeline
                </Link>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 overflow-x-auto pb-1">
                  {stageBuckets.map(({ stage, cards }) => (
                    <div key={stage.id} className="flex w-56 shrink-0 flex-col rounded-xl border border-ink-100 bg-ink-50/40">
                      <div className="flex items-center justify-between border-b border-ink-100 px-3 py-2">
                        <span className="truncate text-sm font-semibold text-ink-800" title={stage.name}>{stage.name}</span>
                        <Badge color={(stage.color as BadgeColor) ?? "slate"}>{cards.length}</Badge>
                      </div>
                      <div className="flex-1 p-2">
                        {cards.length === 0 ? (
                          <p className="py-6 text-center text-xs text-ink-300">Leeg</p>
                        ) : (
                          <ul className="space-y-1.5">
                            {cards.slice(0, 6).map((c) => (
                              <li key={c.id}>
                                <Link
                                  href={`/crm/deals/${c.id}`}
                                  className="block rounded-lg border border-ink-100 bg-white px-2.5 py-1.5 transition-colors hover:border-brand-300 hover:bg-brand-50"
                                >
                                  <span className="block truncate text-sm font-medium text-ink-900">
                                    {c.candidateName ?? c.title}
                                  </span>
                                  <span className="block truncate text-xs text-ink-500">{c.company}</span>
                                </Link>
                              </li>
                            ))}
                            {cards.length > 6 && (
                              <li className="pt-0.5 text-center text-xs text-ink-400">
                                +{cards.length - 6} meer
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {overdue.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="h-4 w-4" /> Over tijd ({overdue.length})
                </CardTitle>
              </CardHeader>
              <ul className="divide-y divide-ink-100">
                {overdue.map((i) => (
                  <FollowUpRow key={i.id} item={i} tone="red" />
                ))}
              </ul>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-amber-500" /> Vandaag ({today.length})
              </CardTitle>
            </CardHeader>
            {today.length === 0 ? (
              <CardContent className="text-sm text-ink-500">Niets gepland voor vandaag.</CardContent>
            ) : (
              <ul className="divide-y divide-ink-100">
                {today.map((i) => (
                  <FollowUpRow key={i.id} item={i} tone="amber" />
                ))}
              </ul>
            )}
          </Card>

          {upcoming.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-ink-400" /> Binnenkort ({upcoming.length})
                </CardTitle>
              </CardHeader>
              <ul className="divide-y divide-ink-100">
                {upcoming.map((i) => (
                  <FollowUpRow key={i.id} item={i} tone="slate" />
                ))}
              </ul>
            </Card>
          )}

          {tasks.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListTodo className="h-4 w-4 text-ink-400" /> Openstaande taken ({tasks.length})
                </CardTitle>
                <Link href="/agenda/taken" className="text-sm text-brand-700 hover:underline">
                  Alle taken
                </Link>
              </CardHeader>
              <ul className="divide-y divide-ink-100">
                {tasks.map((t) => (
                  <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                    <form action={completeTask}>
                      <input type="hidden" name="id" value={t.id} />
                      <button
                        type="submit"
                        title="Afvinken"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-ink-300 hover:bg-emerald-50 hover:text-emerald-600"
                      >
                        <CheckCircle2 className="h-5 w-5" />
                      </button>
                    </form>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-ink-900">{t.title}</p>
                      {t.notes && <p className="truncate text-xs text-ink-500">{t.notes}</p>}
                    </div>
                    <StatusBadge options={TASK_PRIORITIES} value={t.priority} />
                    <span className="w-24 text-right text-xs text-ink-400 tabular-nums">
                      {t.dueDate ? formatDate(t.dueDate) : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
