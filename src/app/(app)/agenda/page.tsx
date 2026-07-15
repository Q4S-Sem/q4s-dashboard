import Link from "next/link";
import {
  Plus,
  CalendarPlus,
  ListTodo,
  AlertTriangle,
  CircleCheck,
  Clock,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import {
  EVENT_TYPES,
  TASK_PRIORITIES,
  colorFor,
  labelFor,
  type BadgeColor,
} from "@/lib/domain";
import {
  monthMatrix,
  monthLabel,
  monthKey,
  formatTime,
  startOfDay,
  getDeadlines,
} from "@/lib/agenda";
import { toggleTask } from "./taken/actions";
import { AgendaCalendar, type CalEvent, type CalDeadline } from "./AgendaCalendar";

export const metadata = { title: "Agenda" };

const DOT: Record<BadgeColor, string> = {
  slate: "bg-slate-400",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  violet: "bg-violet-500",
  cyan: "bg-cyan-500",
};

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export default async function AgendaPage({
  searchParams,
}: {
  searchParams: Promise<{ m?: string; imported?: string }>;
}) {
  const { m, imported } = await searchParams;

  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth();
  if (m && /^\d{4}-\d{2}$/.test(m)) {
    const [y, mo] = m.split("-").map(Number);
    if (mo >= 1 && mo <= 12) {
      year = y;
      month = mo - 1;
    }
  }

  const weeks = monthMatrix(year, month);
  const gridStart = weeks[0][0];
  const lastCell = weeks[5][6];
  const gridEnd = new Date(
    lastCell.getFullYear(),
    lastCell.getMonth(),
    lastCell.getDate() + 1,
  );

  const [events, deadlines, openTasks] = await Promise.all([
    db.calendarEvent.findMany({
      where: { start: { gte: gridStart, lt: gridEnd } },
      orderBy: { start: "asc" },
      include: { client: true, targetClient: true, candidate: true, vacancy: true },
    }),
    getDeadlines(gridStart, gridEnd),
    db.task.findMany({
      where: { done: false },
      orderBy: [{ dueDate: "asc" }, { createdAt: "asc" }],
      take: 8,
    }),
  ]);

  const linkedOf = (ev: (typeof events)[number]): string | null =>
    ev.client?.companyName ??
    ev.targetClient?.name ??
    (ev.candidate ? `${ev.candidate.firstName} ${ev.candidate.lastName}` : null) ??
    ev.vacancy?.title ??
    null;

  const calEvents: CalEvent[] = events.map((ev) => {
    const start = new Date(ev.start);
    const t = formatTime(ev.start);
    return {
      id: ev.id,
      title: ev.title,
      type: ev.type,
      status: ev.status,
      allDay: ev.allDay,
      dateKey: isoDate(start),
      sortKey: start.getTime(),
      timeLabel: ev.allDay ? "Hele dag" : `${t}${ev.end ? `–${formatTime(ev.end)}` : ""}`,
      timeShort: ev.allDay ? "" : t,
      location: ev.location,
      linked: linkedOf(ev),
      notes: ev.notes ? (ev.notes.length > 240 ? `${ev.notes.slice(0, 240)}…` : ev.notes) : null,
    };
  });

  const calDeadlines: CalDeadline[] = deadlines.map((dl) => {
    const date = new Date(dl.date);
    return {
      dateKey: isoDate(date),
      sortKey: date.getTime(),
      dateLabel: formatDate(dl.date),
      title: dl.title,
      href: dl.href,
      overdue: dl.overdue,
    };
  });

  const weeksIso = weeks.map((w) => w.map(isoDate));
  const prev = new Date(year, month - 1, 1);
  const next = new Date(year, month + 1, 1);
  const todayIso = isoDate(now);

  // Sidebar-data.
  const today0 = startOfDay(now);
  const todayEvents = calEvents.filter((e) => e.dateKey === todayIso);
  const todayDeadlines = calDeadlines.filter((d) => d.dateKey === todayIso);
  const upcomingDeadlines = deadlines.filter((d) => new Date(d.date) >= today0).slice(0, 6);
  const overdueCount = deadlines.filter((d) => d.overdue).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agenda"
        description="Afspraken, gesprekken met bedrijven, taken en automatische deadlines van openstaande facturen."
        actions={
          <>
            <Link href="/agenda/importeren" className={buttonVariants({ variant: "outline" })}>
              <CalendarPlus className="h-4 w-4" /> Importeren
            </Link>
            <Link href="/agenda/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe afspraak
            </Link>
          </>
        }
      />

      {imported !== undefined && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {Number(imported) > 0
            ? `${imported} agenda-item(s) geïmporteerd.`
            : "Geen agenda-items gevonden in het bestand."}
        </p>
      )}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_336px]">
        <AgendaCalendar
          monthLabel={monthLabel(year, month)}
          prevHref={`/agenda?m=${monthKey(prev.getFullYear(), prev.getMonth())}`}
          nextHref={`/agenda?m=${monthKey(next.getFullYear(), next.getMonth())}`}
          todayHref="/agenda"
          weeks={weeksIso}
          monthNum={month}
          todayKey={todayIso}
          events={calEvents}
          deadlines={calDeadlines}
        />

        {/* Side panel */}
        <div className="space-y-6">
          {/* Today */}
          <Card>
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
              <Clock className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-semibold text-slate-900">Vandaag</h2>
              <span className="ml-auto text-xs capitalize text-slate-400">{formatDate(now)}</span>
            </div>
            <div className="p-3">
              {todayEvents.length === 0 && todayDeadlines.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-slate-400">Geen afspraken vandaag.</p>
              ) : (
                <ul className="space-y-1">
                  {todayEvents.map((ev) => (
                    <li key={ev.id}>
                      <Link
                        href={`/agenda/${ev.id}`}
                        className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50"
                      >
                        <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT[colorFor(EVENT_TYPES, ev.type)])} />
                        <span className="w-12 shrink-0 text-xs tabular-nums text-slate-500">
                          {ev.allDay ? "hele dag" : ev.timeShort}
                        </span>
                        <span className="truncate text-sm text-slate-800">{ev.title}</span>
                      </Link>
                    </li>
                  ))}
                  {todayDeadlines.map((dl, i) => (
                    <li key={`td-${i}`}>
                      <Link href={dl.href} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                        <AlertTriangle
                          className={cn("h-3.5 w-3.5 shrink-0", dl.overdue ? "text-red-600" : "text-amber-600")}
                        />
                        <span className="truncate text-sm text-slate-700">{dl.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {/* Deadlines */}
          <Card>
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-slate-900">Openstaande facturen</h2>
              {overdueCount > 0 && (
                <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                  {overdueCount} te laat
                </span>
              )}
            </div>
            <div className="p-3">
              {upcomingDeadlines.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-slate-400">Geen openstaande deadlines deze maand.</p>
              ) : (
                <ul className="space-y-1">
                  {upcomingDeadlines.map((dl, i) => (
                    <li key={`ud-${i}`}>
                      <Link href={dl.href} className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                        <span
                          className={cn(
                            "mt-0.5 w-14 shrink-0 text-xs tabular-nums",
                            dl.overdue ? "text-red-600" : "text-slate-500",
                          )}
                        >
                          {formatDate(dl.date)}
                        </span>
                        <span className="truncate text-sm text-slate-700">{dl.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          {/* Tasks */}
          <Card>
            <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
              <ListTodo className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-semibold text-slate-900">Taken</h2>
              <Link href="/agenda/taken" className="ml-auto text-xs font-medium text-brand-700 hover:underline">
                Alles
              </Link>
            </div>
            <div className="p-3">
              {openTasks.length === 0 ? (
                <p className="px-2 py-4 text-center text-sm text-slate-400">Geen open taken.</p>
              ) : (
                <ul className="space-y-1">
                  {openTasks.map((t) => {
                    const overdue = t.dueDate && new Date(t.dueDate) < today0 ? true : false;
                    return (
                      <li key={t.id} className="flex items-center gap-2 px-2 py-1">
                        <form action={toggleTask}>
                          <input type="hidden" name="id" value={t.id} />
                          <input type="hidden" name="redirectTo" value="/agenda" />
                          <button
                            type="submit"
                            aria-label="Taak afronden"
                            className="flex text-slate-300 hover:text-emerald-600"
                          >
                            <CircleCheck className="h-4 w-4" />
                          </button>
                        </form>
                        <span className="flex-1 truncate text-sm text-slate-800">{t.title}</span>
                        {t.priority === "HIGH" && (
                          <span className="rounded-full bg-red-100 px-1.5 text-[10px] font-medium text-red-700">
                            {labelFor(TASK_PRIORITIES, t.priority)}
                          </span>
                        )}
                        {t.dueDate && (
                          <span
                            className={cn(
                              "shrink-0 text-xs tabular-nums",
                              overdue ? "text-red-600" : "text-slate-400",
                            )}
                          >
                            {formatDate(t.dueDate)}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
