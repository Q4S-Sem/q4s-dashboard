"use client";

import * as React from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  MapPin,
  AlertTriangle,
  Check,
  RotateCcw,
  Pencil,
  Trash2,
  ExternalLink,
  CalendarDays,
  ListTree,
  ListTodo,
  Plane,
  User,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { StatusBadge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/field";
import {
  EVENT_TYPES,
  EVENT_STATUSES,
  LEAVE_TYPES,
  TASK_PRIORITIES,
  colorFor,
  type BadgeColor,
} from "@/lib/domain";
import { quickCreateEvent, setEventStatus, deleteEventStay } from "./actions";

export type CalEvent = {
  id: string;
  title: string;
  type: string;
  status: string;
  allDay: boolean;
  dateKey: string; // lokale startdag "YYYY-MM-DD"
  sortKey: number; // epoch ms voor sorteren
  timeLabel: string; // "Hele dag" | "14:30" | "14:30–15:00"
  timeShort: string; // "" bij hele dag, anders "14:30"
  location: string | null;
  linked: string | null;
  notes: string | null;
  assignee: string | null; // toegewezen medewerker (volledige naam)
};

export type CalDeadline = {
  dateKey: string;
  sortKey: number;
  dateLabel: string;
  title: string;
  href: string;
  overdue: boolean;
};

/** Een taak met deadline, getoond op de kalender op z'n vervaldag. */
export type CalTask = {
  id: string;
  dateKey: string;
  sortKey: number;
  title: string;
  priority: string;
  assignee: string | null;
  overdue: boolean;
};

/** Eén afwezigheidsdag van een medewerker (uit EmployeeLeave), per kalenderdag. */
export type CalAbsence = {
  dateKey: string;
  name: string;
  type: string; // VAKANTIE | ZIEK | BIJZONDER | ONBETAALD
  color: BadgeColor;
};

/** Voornaam + achternaam → initialen ("Sem de Snoo" → "SS"). */
function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter((p) => !/^(de|den|van|der|het|te|ten|ter)$/i.test(p));
  const pick = parts.length ? parts : name.trim().split(/\s+/);
  return `${pick[0]?.[0] ?? ""}${pick.length > 1 ? pick[pick.length - 1][0] : ""}`.toUpperCase();
}

const CHIP: Record<BadgeColor, string> = {
  slate: "bg-ink-100 text-ink-700 hover:bg-ink-200",
  blue: "bg-blue-100 text-blue-800 hover:bg-blue-200",
  green: "bg-emerald-100 text-emerald-800 hover:bg-emerald-200",
  amber: "bg-amber-100 text-amber-800 hover:bg-amber-200",
  red: "bg-red-100 text-red-800 hover:bg-red-200",
  violet: "bg-violet-100 text-violet-800 hover:bg-violet-200",
  cyan: "bg-cyan-100 text-cyan-800 hover:bg-cyan-200",
  orange: "bg-orange-100 text-orange-800 hover:bg-orange-200",
};
const DOT: Record<BadgeColor, string> = {
  slate: "bg-ink-400",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  violet: "bg-violet-500",
  cyan: "bg-cyan-500",
  orange: "bg-orange-500",
};
const ICON_TEXT: Record<BadgeColor, string> = {
  slate: "text-ink-500",
  blue: "text-blue-600",
  green: "text-emerald-600",
  amber: "text-amber-600",
  red: "text-red-600",
  violet: "text-violet-600",
  cyan: "text-cyan-600",
  orange: "text-orange-600",
};

const WEEKDAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];
// Tijd afgerond op het kwartier — geen native minuut-voor-minuut wheel meer.
const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTE_OPTIONS = ["00", "15", "30", "45"];
const dayHeaderFmt = new Intl.DateTimeFormat("nl-NL", {
  weekday: "long",
  day: "numeric",
  month: "long",
});

/** "maandag 7 juli" voor een "YYYY-MM-DD"-sleutel. */
function dayHeaderLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return dayHeaderFmt.format(new Date(y, m - 1, d));
}

type Pop =
  | { kind: "event"; ev: CalEvent; rect: DOMRect }
  | { kind: "add"; dateKey: string; rect: DOMRect }
  | null;

/** Vaste positie vlak bij het aangeklikte element; klapt naar boven als er
 *  onder te weinig ruimte is. `withMax` begrenst de hoogte (voor de scrollbare
 *  event-popover); bij het snel-toevoegen laten we 'm los zodat de dropdowns er
 *  bovenuit mogen komen. */
function anchorStyle(rect: DOMRect, withMax = true): React.CSSProperties {
  const W = 320;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const left = Math.min(Math.max(rect.left, 8), Math.max(8, vw - W - 8));

  // Snel-toevoegen: geen interne scroll (de dropdowns moeten eruit kunnen komen),
  // dus de hele popover binnen het scherm klemmen op basis van de eigen hoogte.
  if (!withMax) {
    const H = 336;
    const top = Math.max(8, Math.min(rect.bottom + 6, vh - H - 8));
    return { top, left };
  }

  const spaceBelow = vh - rect.bottom;
  if (spaceBelow > 260 || spaceBelow >= rect.top) {
    return { top: rect.bottom + 6, left, maxHeight: vh - rect.bottom - 14 };
  }
  return { bottom: vh - rect.top + 6, left, maxHeight: rect.top - 14 };
}

export function AgendaCalendar({
  monthLabel,
  prevHref,
  nextHref,
  todayHref,
  weeks,
  monthNum,
  todayKey,
  events,
  deadlines,
  tasks = [],
  absences = [],
}: {
  monthLabel: string;
  prevHref: string;
  nextHref: string;
  todayHref: string;
  weeks: string[][]; // ISO-datums per week
  monthNum: number; // 0-based maand voor "in deze maand"-check
  todayKey: string;
  events: CalEvent[];
  deadlines: CalDeadline[];
  tasks?: CalTask[];
  absences?: CalAbsence[];
}) {
  const [view, setView] = React.useState<"maand" | "lijst">("maand");
  const [pop, setPop] = React.useState<Pop>(null);

  React.useEffect(() => {
    if (!pop) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setPop(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pop]);

  const eventsByDay = React.useMemo(() => {
    const m = new Map<string, CalEvent[]>();
    for (const ev of events) (m.get(ev.dateKey) ?? m.set(ev.dateKey, []).get(ev.dateKey)!).push(ev);
    return m;
  }, [events]);
  const deadlinesByDay = React.useMemo(() => {
    const m = new Map<string, CalDeadline[]>();
    for (const dl of deadlines) (m.get(dl.dateKey) ?? m.set(dl.dateKey, []).get(dl.dateKey)!).push(dl);
    return m;
  }, [deadlines]);
  const tasksByDay = React.useMemo(() => {
    const m = new Map<string, CalTask[]>();
    for (const t of tasks) (m.get(t.dateKey) ?? m.set(t.dateKey, []).get(t.dateKey)!).push(t);
    return m;
  }, [tasks]);
  const absencesByDay = React.useMemo(() => {
    const m = new Map<string, CalAbsence[]>();
    for (const a of absences) (m.get(a.dateKey) ?? m.set(a.dateKey, []).get(a.dateKey)!).push(a);
    return m;
  }, [absences]);

  const openEvent = (ev: CalEvent, el: HTMLElement) =>
    setPop({ kind: "event", ev, rect: el.getBoundingClientRect() });
  const openAdd = (dateKey: string, el: HTMLElement) =>
    setPop({ kind: "add", dateKey, rect: el.getBoundingClientRect() });

  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-sm">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-4 py-3">
        <div className="flex items-center gap-1">
          <Link href={prevHref} aria-label="Vorige maand" className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900">
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <Link href={nextHref} aria-label="Volgende maand" className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-900">
            <ChevronRight className="h-5 w-5" />
          </Link>
          <h2 className="ml-2 text-base font-semibold capitalize text-ink-900">{monthLabel}</h2>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <Link href={todayHref} className={buttonVariants({ variant: "outline", size: "sm" })}>
            Vandaag
          </Link>
          {/* Weergave-schakelaar */}
          <div className="inline-flex rounded-lg border border-ink-200 bg-ink-50 p-0.5">
            <button
              type="button"
              onClick={() => setView("maand")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
                view === "maand" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800",
              )}
            >
              <CalendarDays className="h-4 w-4" /> Maand
            </button>
            <button
              type="button"
              onClick={() => setView("lijst")}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-sm font-medium transition-colors",
                view === "lijst" ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800",
              )}
            >
              <ListTree className="h-4 w-4" /> Lijst
            </button>
          </div>
        </div>
      </div>

      {/* Legenda */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-ink-100 bg-ink-50/60 px-4 py-2 text-[11px] font-medium text-ink-500">
        {EVENT_TYPES.map((t) => (
          <span key={t.value} className="inline-flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full", DOT[t.color as BadgeColor])} />
            {t.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5">
          <AlertTriangle className="h-3 w-3 text-amber-600" /> Deadline / factuur
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ListTodo className="h-3 w-3 text-brand-600" /> Taak
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Plane className="h-3 w-3 text-emerald-600" /> Afwezig / vakantie
        </span>
      </div>

      {view === "maand" ? (
        <MonthGrid
          weeks={weeks}
          monthNum={monthNum}
          todayKey={todayKey}
          eventsByDay={eventsByDay}
          deadlinesByDay={deadlinesByDay}
          tasksByDay={tasksByDay}
          absencesByDay={absencesByDay}
          onOpenEvent={openEvent}
          onOpenAdd={openAdd}
        />
      ) : (
        <AgendaList
          events={events}
          deadlines={deadlines}
          tasks={tasks}
          absences={absences}
          onOpenEvent={openEvent}
        />
      )}

      {/* Popover-laag */}
      {pop && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setPop(null)} aria-hidden />
          <div
            style={anchorStyle(pop.rect, pop.kind === "event")}
            className={cn(
              "fixed z-50 w-80 max-w-[calc(100vw-1rem)] rounded-xl border border-ink-200 bg-white p-4 shadow-xl",
              pop.kind === "event" ? "overflow-y-auto" : "overflow-visible",
            )}
          >
            {pop.kind === "event" ? (
              <EventPopover ev={pop.ev} onClose={() => setPop(null)} />
            ) : (
              <AddPopover dateKey={pop.dateKey} onClose={() => setPop(null)} />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function MonthGrid({
  weeks,
  monthNum,
  todayKey,
  eventsByDay,
  deadlinesByDay,
  tasksByDay,
  absencesByDay,
  onOpenEvent,
  onOpenAdd,
}: {
  weeks: string[][];
  monthNum: number;
  todayKey: string;
  eventsByDay: Map<string, CalEvent[]>;
  deadlinesByDay: Map<string, CalDeadline[]>;
  tasksByDay: Map<string, CalTask[]>;
  absencesByDay: Map<string, CalAbsence[]>;
  onOpenEvent: (ev: CalEvent, el: HTMLElement) => void;
  onOpenAdd: (dateKey: string, el: HTMLElement) => void;
}) {
  return (
    <div className="min-w-0">
      <div className="grid grid-cols-7 border-b border-ink-100 bg-ink-50 text-center text-[11px] font-semibold uppercase tracking-wide text-ink-500">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-2">
            {w}
          </div>
        ))}
      </div>
      <div className="divide-y divide-ink-100">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7 divide-x divide-ink-100">
            {week.map((day) => {
              const [, mm, dd] = day.split("-").map(Number);
              const inMonth = mm - 1 === monthNum;
              const isToday = day === todayKey;
              const dayAbsences = absencesByDay.get(day) ?? [];
              const dayEvents = eventsByDay.get(day) ?? [];
              const dayDeadlines = deadlinesByDay.get(day) ?? [];
              const dayTasks = tasksByDay.get(day) ?? [];
              const shownAbs = dayAbsences.slice(0, 2);
              const hiddenAbs = dayAbsences.length - shownAbs.length;
              const MAX = 3;
              const shownEvents = dayEvents.slice(0, MAX);
              let budget = MAX - shownEvents.length;
              const shownDeadlines = dayDeadlines.slice(0, Math.max(0, budget));
              budget -= shownDeadlines.length;
              const shownTasks = dayTasks.slice(0, Math.max(0, budget));
              const hidden =
                dayEvents.length +
                dayDeadlines.length +
                dayTasks.length -
                shownEvents.length -
                shownDeadlines.length -
                shownTasks.length;

              return (
                <div key={day} className={cn("group relative min-h-[116px]", inMonth ? "bg-white" : "bg-ink-50/60")}>
                  {/* Klik op lege ruimte → snel toevoegen */}
                  <button
                    type="button"
                    aria-label={`Snel afspraak toevoegen op ${day}`}
                    onClick={(e) => onOpenAdd(day, e.currentTarget)}
                    className="absolute inset-0 z-0 transition-colors hover:bg-brand-50/40"
                  />
                  <div className="pointer-events-none relative z-10 p-1.5">
                    <div className="flex items-center justify-between px-1">
                      <Link
                        href={`/agenda/dag/${day}`}
                        aria-label={`Dagplanning ${day}`}
                        className={cn(
                          "pointer-events-auto flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium transition-colors",
                          isToday
                            ? "bg-brand-600 text-white"
                            : inMonth
                              ? "text-ink-700 hover:bg-ink-100"
                              : "text-ink-400 hover:bg-ink-100",
                        )}
                      >
                        {dd}
                      </Link>
                      <Plus className="h-3.5 w-3.5 text-ink-300 opacity-0 transition-opacity group-hover:opacity-100" />
                    </div>

                    <div className="mt-1 space-y-1">
                      {shownAbs.map((a, i) => (
                        <div
                          key={`abs-${i}`}
                          title={`${a.name} — afwezig`}
                          className={cn(
                            "flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] font-medium",
                            CHIP[a.color],
                          )}
                        >
                          <Plane className="h-3 w-3 shrink-0" />
                          <span className="truncate">{a.name}</span>
                        </div>
                      ))}
                      {shownEvents.map((ev) => {
                        const color = colorFor(EVENT_TYPES, ev.type);
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            title={ev.assignee ? `${ev.title} · ${ev.assignee}` : ev.title}
                            onClick={(e) => onOpenEvent(ev, e.currentTarget)}
                            className={cn(
                              "pointer-events-auto block w-full truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium transition-colors",
                              CHIP[color],
                              ev.status === "CANCELLED" && "line-through opacity-60",
                            )}
                          >
                            {ev.timeShort && <span className="tabular-nums opacity-70">{ev.timeShort} </span>}
                            {ev.title}
                            {ev.assignee && <span className="opacity-60"> · {initialsOf(ev.assignee)}</span>}
                          </button>
                        );
                      })}
                      {shownDeadlines.map((dl, i) => (
                        <Link
                          key={`d-${i}`}
                          href={dl.href}
                          title={dl.title}
                          className={cn(
                            "pointer-events-auto flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                            dl.overdue ? CHIP.red : CHIP.amber,
                          )}
                        >
                          <AlertTriangle className="h-3 w-3 shrink-0" />
                          <span className="truncate">{dl.title}</span>
                        </Link>
                      ))}
                      {shownTasks.map((t) => (
                        <Link
                          key={`t-${t.id}`}
                          href="/agenda/taken"
                          title={t.assignee ? `Taak: ${t.title} · ${t.assignee}` : `Taak: ${t.title}`}
                          className={cn(
                            "pointer-events-auto flex items-center gap-1 truncate rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors",
                            t.overdue ? CHIP.red : "bg-brand-50 text-brand-700 hover:bg-brand-100",
                          )}
                        >
                          <ListTodo className="h-3 w-3 shrink-0" />
                          <span className="truncate">{t.title}</span>
                          {t.assignee && <span className="shrink-0 opacity-70">· {initialsOf(t.assignee)}</span>}
                        </Link>
                      ))}
                      {hidden + hiddenAbs > 0 && (
                        <Link
                          href={`/agenda/dag/${day}`}
                          className="pointer-events-auto block px-1.5 text-[11px] font-medium text-ink-400 hover:text-brand-700"
                        >
                          +{hidden + hiddenAbs} meer
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function AgendaList({
  events,
  deadlines,
  tasks,
  absences,
  onOpenEvent,
}: {
  events: CalEvent[];
  deadlines: CalDeadline[];
  tasks: CalTask[];
  absences: CalAbsence[];
  onOpenEvent: (ev: CalEvent, el: HTMLElement) => void;
}) {
  const groups = React.useMemo(() => {
    type Item =
      | { t: "absence"; sortKey: number; dateKey: string; abs: CalAbsence }
      | { t: "event"; sortKey: number; dateKey: string; ev: CalEvent }
      | { t: "deadline"; sortKey: number; dateKey: string; dl: CalDeadline }
      | { t: "task"; sortKey: number; dateKey: string; task: CalTask };
    const items: Item[] = [
      // Afwezigheid en all-day items eerst (sortKey -1), dan op tijd.
      ...absences.map((abs) => ({ t: "absence" as const, sortKey: -1, dateKey: abs.dateKey, abs })),
      ...events.map((ev) => ({ t: "event" as const, sortKey: ev.sortKey, dateKey: ev.dateKey, ev })),
      ...deadlines.map((dl) => ({ t: "deadline" as const, sortKey: dl.sortKey, dateKey: dl.dateKey, dl })),
      ...tasks.map((task) => ({ t: "task" as const, sortKey: task.sortKey, dateKey: task.dateKey, task })),
    ].sort((a, b) => a.sortKey - b.sortKey);
    const m = new Map<string, Item[]>();
    for (const it of items) (m.get(it.dateKey) ?? m.set(it.dateKey, []).get(it.dateKey)!).push(it);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [events, deadlines, tasks, absences]);

  if (groups.length === 0) {
    return <p className="px-4 py-16 text-center text-sm text-ink-400">Niets gepland deze maand.</p>;
  }

  return (
    <div className="divide-y divide-ink-100">
      {groups.map(([dateKey, items]) => (
        <div key={dateKey} className="px-2 py-2 sm:px-3">
          <div className="px-2 py-1.5 text-xs font-semibold capitalize text-ink-500">{dayHeaderLabel(dateKey)}</div>
          <ul>
            {items.map((it, i) => {
              if (it.t === "absence") {
                return (
                  <li
                    key={`a-${dateKey}-${i}`}
                    className="flex items-center gap-3 rounded-lg px-2 py-2"
                  >
                    <span className="w-14 shrink-0 text-xs text-ink-400">afwezig</span>
                    <Plane className={cn("h-4 w-4 shrink-0", ICON_TEXT[it.abs.color])} />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-700">{it.abs.name}</span>
                    <StatusBadge options={LEAVE_TYPES} value={it.abs.type} />
                  </li>
                );
              }
              if (it.t === "task") {
                return (
                  <li key={`t-${it.task.id}`}>
                    <Link
                      href="/agenda/taken"
                      className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-ink-50"
                    >
                      <span className="w-14 shrink-0 text-xs tabular-nums text-ink-400">
                        {it.task.overdue ? "te laat" : "taak"}
                      </span>
                      <ListTodo className={cn("h-4 w-4 shrink-0", it.task.overdue ? "text-red-600" : "text-brand-600")} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink-800">{it.task.title}</span>
                        {it.task.assignee && (
                          <span className="block truncate text-xs text-ink-500">{it.task.assignee}</span>
                        )}
                      </span>
                      <StatusBadge options={TASK_PRIORITIES} value={it.task.priority} />
                    </Link>
                  </li>
                );
              }
              if (it.t === "event") {
                return (
                  <li key={`e-${it.ev.id}`}>
                    <button
                      type="button"
                      onClick={(e) => onOpenEvent(it.ev, e.currentTarget)}
                      className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-ink-50"
                    >
                      <span className="w-14 shrink-0 text-xs tabular-nums text-ink-500">
                        {it.ev.allDay ? "hele dag" : it.ev.timeShort}
                      </span>
                      <span className={cn("h-2 w-2 shrink-0 rounded-full", DOT[colorFor(EVENT_TYPES, it.ev.type)])} />
                      <span className="min-w-0 flex-1">
                        <span
                          className={cn(
                            "block truncate text-sm font-medium text-ink-800",
                            it.ev.status === "CANCELLED" && "text-ink-400 line-through",
                          )}
                        >
                          {it.ev.title}
                        </span>
                        {(it.ev.linked || it.ev.location || it.ev.assignee) && (
                          <span className="block truncate text-xs text-ink-500">
                            {[it.ev.linked, it.ev.location, it.ev.assignee].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </span>
                      <StatusBadge options={EVENT_TYPES} value={it.ev.type} />
                    </button>
                  </li>
                );
              }
              return (
                <li key={`d-${dateKey}-${i}`}>
                  <Link href={it.dl.href} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-ink-50">
                    <span className="w-14 shrink-0 text-xs tabular-nums text-ink-400">
                      {it.dl.overdue ? "te laat" : ""}
                    </span>
                    <AlertTriangle className={cn("h-4 w-4 shrink-0", it.dl.overdue ? "text-red-600" : "text-amber-600")} />
                    <span className="min-w-0 flex-1 truncate text-sm text-ink-700">{it.dl.title}</span>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-ink-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function EventPopover({ ev, onClose }: { ev: CalEvent; onClose: () => void }) {
  const done = ev.status === "DONE";
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold tabular-nums text-ink-900">{ev.timeLabel}</span>
          <StatusBadge options={EVENT_TYPES} value={ev.type} />
          {ev.status !== "PLANNED" && <StatusBadge options={EVENT_STATUSES} value={ev.status} />}
        </div>
        <button type="button" onClick={onClose} aria-label="Sluiten" className="-mr-1 -mt-1 rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600">
          <X className="h-4 w-4" />
        </button>
      </div>

      <p className={cn("mt-2 font-semibold text-ink-900", ev.status === "CANCELLED" && "line-through")}>{ev.title}</p>
      <div className="mt-1 space-y-0.5 text-sm text-ink-500">
        {ev.location && (
          <p className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0" /> {ev.location}
          </p>
        )}
        {ev.assignee && (
          <p className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 shrink-0" /> {ev.assignee}
          </p>
        )}
        {ev.linked && <p className="truncate">{ev.linked}</p>}
      </div>
      {ev.notes && <p className="mt-2 whitespace-pre-wrap text-sm text-ink-600 [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:4] overflow-hidden">{ev.notes}</p>}

      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3">
        <Link href={`/agenda/${ev.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Openen
        </Link>
        <Link href={`/agenda/${ev.id}/bewerken`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <Pencil className="h-4 w-4" /> Bewerken
        </Link>
        <form action={async (fd) => { await setEventStatus(fd); onClose(); }}>
          <input type="hidden" name="id" value={ev.id} />
          <input type="hidden" name="status" value={done ? "PLANNED" : "DONE"} />
          <SubmitButton size="sm" variant={done ? "outline" : "success"} pendingLabel="…">
            {done ? (
              <>
                <RotateCcw className="h-4 w-4" /> Heropenen
              </>
            ) : (
              <>
                <Check className="h-4 w-4" /> Afgerond
              </>
            )}
          </SubmitButton>
        </form>
        <form
          action={async (fd) => { await deleteEventStay(fd); onClose(); }}
          onSubmit={(e) => {
            if (!window.confirm(`Afspraak "${ev.title}" verwijderen?`)) e.preventDefault();
          }}
          className="ml-auto"
        >
          <input type="hidden" name="id" value={ev.id} />
          <SubmitButton size="sm" variant="ghost" pendingLabel="…" aria-label="Verwijderen">
            <Trash2 className="h-4 w-4" />
          </SubmitButton>
        </form>
      </div>
    </div>
  );
}

function AddPopover({ dateKey, onClose }: { dateKey: string; onClose: () => void }) {
  const [hour, setHour] = React.useState("09");
  const [minute, setMinute] = React.useState("00");
  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold capitalize text-ink-900">Nieuw op {dayHeaderLabel(dateKey)}</h3>
        <button type="button" onClick={onClose} aria-label="Sluiten" className="-mr-1 rounded-lg p-1 text-ink-400 hover:bg-ink-100 hover:text-ink-600">
          <X className="h-4 w-4" />
        </button>
      </div>
      <form action={async (fd) => { await quickCreateEvent(fd); onClose(); }} className="mt-3 space-y-3">
        <input type="hidden" name="date" value={dateKey} />
        <input type="hidden" name="time" value={`${hour}:${minute}`} />
        {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
        <Input name="title" placeholder="Titel — bijv. Bellen kandidaat" autoFocus required />

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-500">Type</label>
          <Select name="type" defaultValue="MEETING" aria-label="Type">
            {EVENT_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-ink-500">Tijd</label>
          <div className="flex items-center gap-2">
            <Select defaultValue={hour} onValueChange={setHour} aria-label="Uur" className="w-24">
              {HOUR_OPTIONS.map((h) => (
                <option key={h} value={h}>
                  {h}
                </option>
              ))}
            </Select>
            <span className="text-sm font-semibold text-ink-400">:</span>
            <Select defaultValue={minute} onValueChange={setMinute} aria-label="Minuten" className="w-24">
              {MINUTE_OPTIONS.map((mnt) => (
                <option key={mnt} value={mnt}>
                  {mnt}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex items-center gap-2 border-t border-ink-100 pt-3">
          <SubmitButton size="sm" pendingLabel="Opslaan…">
            <Plus className="h-4 w-4" /> Opslaan
          </SubmitButton>
          <Link href={`/agenda/nieuw?date=${dateKey}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
            Meer opties…
          </Link>
        </div>
      </form>
    </div>
  );
}
