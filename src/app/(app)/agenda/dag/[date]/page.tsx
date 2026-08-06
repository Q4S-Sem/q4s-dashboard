import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Plus,
  MapPin,
  Clock,
  AlertTriangle,
  ListTodo,
  CircleCheck,
  MoveRight,
  CalendarClock,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { cn, formatDate } from "@/lib/utils";
import {
  EVENT_TYPES,
  EVENT_STATUSES,
  TASK_PRIORITIES,
  labelFor,
} from "@/lib/domain";
import {
  startOfDay,
  formatTime,
  getDeadlines,
  monthKey,
  MONTHS,
  WEEKDAYS,
} from "@/lib/agenda";
import { rescheduleEvent } from "../../actions";
import { toggleTask } from "../../taken/actions";

export const metadata = { title: "Dagplanning" };
export const dynamic = "force-dynamic";

function iso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** Starttijd afgerond op het kwartier — matcht de step=900 van het tijdveld, zodat
 *  het verschuif-formulier ook voor geïmporteerde/oude afspraken (niet-kwartier)
 *  gewoon submit i.p.v. te blokkeren op een stepMismatch. */
function hhmm(d: Date | string): string {
  const x = new Date(d);
  let total = x.getHours() * 60 + x.getMinutes();
  total = Math.round(total / 15) * 15;
  if (total >= 24 * 60) total = 24 * 60 - 15;
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export default async function DagPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const [y, mo, d] = date.split("-").map(Number);
  const dayStart = new Date(y, mo - 1, d);
  if (Number.isNaN(dayStart.getTime())) notFound();
  const dayEnd = new Date(y, mo - 1, d + 1);
  const prev = new Date(y, mo - 1, d - 1);
  const next = new Date(y, mo - 1, d + 1);

  const now = new Date();
  const isToday =
    now.getFullYear() === y && now.getMonth() === mo - 1 && now.getDate() === d;

  const [events, deadlines, tasks] = await Promise.all([
    db.calendarEvent.findMany({
      where: { start: { gte: dayStart, lt: dayEnd } },
      orderBy: [{ allDay: "desc" }, { start: "asc" }],
      include: {
        client: true,
        targetClient: true,
        candidate: true,
        vacancy: true,
      },
    }),
    getDeadlines(dayStart, dayEnd),
    db.task.findMany({
      where: { dueDate: { gte: dayStart, lt: dayEnd } },
      orderBy: [{ done: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const weekday = WEEKDAYS[(dayStart.getDay() + 6) % 7];
  const headerLabel = `${weekday} ${d} ${MONTHS[mo - 1]} ${y}`;
  const backMonth = monthKey(y, mo - 1);

  return (
    <div className="space-y-6">
      <BackLink href={`/agenda?m=${backMonth}`}>
        Terug naar agenda
      </BackLink>

      {/* Day header + day nav */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <Link
            href={`/agenda/dag/${iso(prev)}`}
            aria-label="Vorige dag"
            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <Link
            href={`/agenda/dag/${iso(next)}`}
            aria-label="Volgende dag"
            className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900"
          >
            <ChevronRight className="h-5 w-5" />
          </Link>
        </div>
        <div>
          <h1 className="text-2xl font-bold capitalize tracking-tight text-ink-900">
            {headerLabel}
          </h1>
          {isToday && (
            <span className="text-sm font-medium text-brand-700">Vandaag</span>
          )}
        </div>
        <Link
          href={`/agenda/nieuw?date=${date}`}
          className={cn(buttonVariants(), "ml-auto")}
        >
          <Plus className="h-4 w-4" /> Nieuwe afspraak
        </Link>
      </div>

      {/* Afspraken */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-brand-600" /> Afspraken
          </CardTitle>
          <span className="text-sm text-ink-400">{events.length}</span>
        </CardHeader>
        <CardContent className="space-y-3">
          {events.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-400">
              Geen afspraken op deze dag.{" "}
              <Link
                href={`/agenda/nieuw?date=${date}`}
                className="font-medium text-brand-700 hover:underline"
              >
                Plan er een in
              </Link>
              .
            </p>
          ) : (
            events.map((ev) => {
              const linked =
                ev.client?.companyName ??
                ev.targetClient?.name ??
                (ev.candidate
                  ? `${ev.candidate.firstName} ${ev.candidate.lastName}`
                  : null) ??
                ev.vacancy?.title ??
                null;
              return (
                <div
                  key={ev.id}
                  className={cn(
                    "rounded-xl border border-ink-200 p-4",
                    ev.status === "CANCELLED" && "opacity-60",
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold tabular-nums text-ink-900">
                          {ev.allDay
                            ? "Hele dag"
                            : `${formatTime(ev.start)}${ev.end ? `–${formatTime(ev.end)}` : ""}`}
                        </span>
                        <StatusBadge options={EVENT_TYPES} value={ev.type} />
                        {ev.status !== "PLANNED" && (
                          <StatusBadge options={EVENT_STATUSES} value={ev.status} />
                        )}
                      </div>
                      <p
                        className={cn(
                          "mt-1 font-medium text-ink-900",
                          ev.status === "CANCELLED" && "line-through",
                        )}
                      >
                        {ev.title}
                      </p>
                      <div className="mt-1 space-y-0.5 text-sm text-ink-500">
                        {ev.location && (
                          <p className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" /> {ev.location}
                          </p>
                        )}
                        {linked && <p>{linked}</p>}
                      </div>
                    </div>
                    <Link
                      href={`/agenda/${ev.id}`}
                      className={buttonVariants({ variant: "outline", size: "sm" })}
                    >
                      Bekijken
                    </Link>
                  </div>

                  {/* Verschuiven */}
                  <form
                    action={rescheduleEvent}
                    className="mt-3 flex flex-wrap items-end gap-2 border-t border-ink-100 pt-3"
                  >
                    <input type="hidden" name="id" value={ev.id} />
                    <span className="flex items-center gap-1.5 self-center text-xs font-medium text-ink-500">
                      <CalendarClock className="h-3.5 w-3.5" /> Verschuif naar
                    </span>
                    {!ev.allDay && (
                      <Input
                        type="time"
                        name="time"
                        defaultValue={hhmm(ev.start)}
                        aria-label="Nieuwe tijd"
                        className="w-28"
                      />
                    )}
                    <Input
                      type="date"
                      name="date"
                      defaultValue={date}
                      aria-label="Nieuwe datum"
                      className="w-40"
                    />
                    <SubmitButton size="sm" variant="outline" pendingLabel="Verschuiven…">
                      <MoveRight className="h-4 w-4" /> Verschuif
                    </SubmitButton>
                  </form>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>

      {/* Deadlines deze dag */}
      {deadlines.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" /> Deadlines
            </CardTitle>
            <span className="text-sm text-ink-400">{deadlines.length}</span>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {deadlines.map((dl, i) => (
                <li key={`dl-${i}`}>
                  <Link
                    href={dl.href}
                    className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-ink-50"
                  >
                    <AlertTriangle
                      className={cn(
                        "h-4 w-4 shrink-0",
                        dl.overdue ? "text-red-600" : "text-amber-600",
                      )}
                    />
                    <span className="text-sm text-ink-700">{dl.title}</span>
                    {dl.overdue && (
                      <span className="ml-auto rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">
                        te laat
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Taken met deadline deze dag */}
      {tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListTodo className="h-5 w-5 text-brand-600" /> Taken
            </CardTitle>
            <Link
              href="/agenda/taken"
              className="text-xs font-medium text-brand-700 hover:underline"
            >
              Alle taken
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {tasks.map((t) => (
                <li key={t.id} className="flex items-center gap-2 px-2 py-1.5">
                  <form action={toggleTask}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="redirectTo" value={`/agenda/dag/${date}`} />
                    <button
                      type="submit"
                      aria-label={t.done ? "Taak heropenen" : "Taak afronden"}
                      className={cn(
                        "flex hover:text-emerald-600",
                        t.done ? "text-emerald-600" : "text-ink-300",
                      )}
                    >
                      <CircleCheck className="h-5 w-5" />
                    </button>
                  </form>
                  <span
                    className={cn(
                      "flex-1 truncate text-sm",
                      t.done ? "text-ink-400 line-through" : "text-ink-800",
                    )}
                  >
                    {t.title}
                  </span>
                  {t.priority === "HIGH" && !t.done && (
                    <span className="rounded-full bg-red-100 px-1.5 text-[10px] font-medium text-red-700">
                      {labelFor(TASK_PRIORITIES, t.priority)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {events.length === 0 && deadlines.length === 0 && tasks.length === 0 && (
        <p className="rounded-lg bg-ink-50 px-4 py-6 text-center text-sm text-ink-400">
          Niets gepland op {formatDate(dayStart)}.
        </p>
      )}
    </div>
  );
}
