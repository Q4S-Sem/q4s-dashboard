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
  Kanban,
  Sparkles,
  Clock,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, cn } from "@/lib/utils";
import { TASK_PRIORITIES, DISCIPLINES, EVENT_TYPES, type BadgeColor } from "@/lib/domain";
import {
  currentRecruiterId,
  getFollowUpItems,
  getBoardData,
  startOfToday,
  endOfToday,
  type FollowUpItem,
} from "@/lib/crm";
import { completeFollowUp, completeTask } from "./actions";
import { VacatureFilterList } from "./VacatureFilterList";

export const metadata = { title: "Opvolging" };
export const dynamic = "force-dynamic";

/** De opvolging-tabs (view-key → label + kleurstip). */
const VIEW_TABS = [
  { key: "vacatures", label: "Vacatures te vullen", dot: "bg-brand-500" },
  { key: "pipeline", label: "Pipeline-stand", dot: "bg-violet-500" },
  { key: "overtijd", label: "Over tijd", dot: "bg-red-500" },
  { key: "vandaag", label: "Vandaag", dot: "bg-amber-500" },
  { key: "taken", label: "Taken", dot: "bg-ink-400" },
] as const;

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

export default async function OpvolgingPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const sp = await searchParams;
  const recruiterId = await currentRecruiterId();
  // Opvolging is altijd algemeen/team-breed — geen Mijn opvolging/Team-schakelaar.
  const scope = "all" as const;

  const [items, tasks, vacatures, board, agendaVandaag] = await Promise.all([
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
    // Agenda-items van VANDAAG die relevant zijn voor recruitment: gekoppeld aan
    // een klant/kandidaat/vacature, óf een recruitment-type (gesprek/bezoek/interview).
    db.calendarEvent.findMany({
      where: {
        status: { not: "CANCELLED" },
        start: { gte: startOfToday(), lte: endOfToday() },
        OR: [
          { clientId: { not: null } },
          { candidateId: { not: null } },
          { vacancyId: { not: null } },
          { type: { in: ["CALL", "VISIT", "INTERVIEW", "MEETING"] } },
        ],
      },
      orderBy: { start: "asc" },
      include: {
        client: { select: { id: true, companyName: true } },
        candidate: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
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

  const countFor = (key: string): number => {
    switch (key) {
      case "vacatures": return vacatures.length;
      case "pipeline": return openCards.length;
      case "overtijd": return overdue.length;
      case "vandaag": return today.length;
      case "taken": return tasks.length;
      default: return 0;
    }
  };

  const validView = new Set<string>(VIEW_TABS.map((t) => t.key));
  const view = sp.view && validView.has(sp.view) ? sp.view : "vacatures";

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
          {/* Tabs — schakel tussen de opvolging-onderdelen */}
          <nav aria-label="Opvolging" className="flex items-end gap-1 overflow-x-auto border-b border-ink-200">
            {VIEW_TABS.map((t) => {
              const active = t.key === view;
              const count = countFor(t.key);
              return (
                <Link
                  key={t.key}
                  href={`/crm/opvolging?view=${t.key}`}
                  scroll={false}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px inline-flex shrink-0 items-center gap-2 rounded-t-xl border px-4 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "border-ink-200 border-b-[#fafafa] bg-white text-ink-900"
                      : "border-transparent text-ink-500 hover:bg-ink-100 hover:text-ink-900",
                  )}
                >
                  <span className={cn("h-2.5 w-2.5 rounded-full", t.dot)} />
                  {t.label}
                  <span
                    className={cn(
                      "rounded-sm px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                      active ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-500",
                    )}
                  >
                    {count}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* VACATURES — te vullen met de juiste persoon (met filter) */}
          {view === "vacatures" && (
            vacatures.length === 0 ? (
              <EmptyState icon={<Briefcase className="h-6 w-6" />} title="Geen openstaande vacatures" description="Alle vacatures hebben een kandidaat, of leg een nieuwe vacature vast." />
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Briefcase className="h-4 w-4 text-brand-600" /> Vacatures te vullen ({vacatures.length})
                  </CardTitle>
                  <Link href="/crm/vacatures" className="text-sm text-brand-700 hover:underline">
                    Alle vacatures
                  </Link>
                </CardHeader>
                <CardContent>
                  <VacatureFilterList
                    vacatures={vacatures.map((v) => ({
                      id: v.id,
                      title: v.title,
                      company: v.company,
                      clientName: v.client?.companyName ?? null,
                      city: v.client?.city ?? null,
                      discipline: v.discipline,
                      positions: v.positions,
                      expectedCloseDate: v.expectedCloseDate ? v.expectedCloseDate.toISOString() : null,
                    }))}
                  />
                </CardContent>
              </Card>
            )
          )}

          {/* PIPELINE-STAND — waar staan de gekoppelde kandidaten */}
          {view === "pipeline" && (
            openCards.length === 0 ? (
              <EmptyState icon={<Kanban className="h-6 w-6" />} title="Geen kandidaten in de pipeline" description="Koppel een kandidaat aan een vacature; die verschijnt dan hier per fase." />
            ) : (
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
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                    {stageBuckets.map(({ stage, cards }) => (
                      <div key={stage.id} className="flex min-h-[9rem] flex-col rounded-xl border border-ink-100 bg-ink-50/40">
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
            )
          )}

          {/* OVER TIJD — opvolgingen die al hadden gemoeten */}
          {view === "overtijd" && (
            overdue.length === 0 ? (
              <EmptyState icon={<CircleCheck className="h-6 w-6" />} title="Niets over tijd" description="Alle opvolgingen zijn op tijd. Netjes." />
            ) : (
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
            )
          )}

          {/* VANDAAG — agenda-afspraken + op te volgen (+ binnenkort eronder) */}
          {view === "vandaag" && (
            <>
              {/* Recruitment-agenda van vandaag (afspraken gekoppeld aan klant/kandidaat/vacature) */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-brand-600" /> Agenda vandaag ({agendaVandaag.length})
                  </CardTitle>
                  <Link href="/agenda" className="text-sm text-brand-700 hover:underline">
                    Naar de agenda
                  </Link>
                </CardHeader>
                {agendaVandaag.length === 0 ? (
                  <CardContent className="text-sm text-ink-500">
                    Geen recruitment-afspraken vandaag. Plan een gesprek of bezoek in de agenda.
                  </CardContent>
                ) : (
                  <ul className="divide-y divide-ink-100">
                    {agendaVandaag.map((e) => {
                      const linkName =
                        e.candidate
                          ? `${e.candidate.firstName ?? ""} ${e.candidate.lastName ?? ""}`.trim()
                          : e.client?.companyName ?? null;
                      const typeMeta = EVENT_TYPES.find((t) => t.value === e.type);
                      return (
                        <li key={e.id} className="flex items-center gap-3 px-5 py-3">
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                            <Clock className="h-4 w-4" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate font-medium text-ink-900">{e.title}</p>
                            <p className="flex items-center gap-2 truncate text-xs text-ink-500">
                              {typeMeta && <StatusBadge options={EVENT_TYPES} value={e.type} />}
                              {linkName && (
                                <span className="inline-flex items-center gap-1">
                                  {e.candidate ? <Users2 className="h-3 w-3 text-ink-400" /> : <Building2 className="h-3 w-3 text-ink-400" />}
                                  {linkName}
                                </span>
                              )}
                            </p>
                          </div>
                          <span className="w-16 text-right text-xs font-medium text-ink-500 tabular-nums">
                            {e.allDay
                              ? "Hele dag"
                              : new Date(e.start).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CalendarClock className="h-4 w-4 text-amber-500" /> Op te volgen vandaag ({today.length})
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
            </>
          )}

          {/* TAKEN — openstaande to-do's */}
          {view === "taken" && (
            tasks.length === 0 ? (
              <EmptyState icon={<ListTodo className="h-6 w-6" />} title="Geen openstaande taken" description="Alle taken zijn afgevinkt." />
            ) : (
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
            )
          )}
        </>
      )}
    </div>
  );
}
