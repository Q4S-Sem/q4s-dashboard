"use client";

import * as React from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { startOfISOWeek, getISOWeek } from "@/lib/utils";

const WEEKDAYS = ["ma", "di", "wo", "do", "vr", "za", "zo"];
const MONTHS = [
  "januari", "februari", "maart", "april", "mei", "juni",
  "juli", "augustus", "september", "oktober", "november", "december",
];
const dm = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" });
const dmy = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });

const pad = (n: number) => String(n).padStart(2, "0");
const toDateValue = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toDateTimeValue = (d: Date) => `${toDateValue(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

// Alle tijden worden afgerond op het kwartier (00/15/30/45) — simpel en snel te
// kiezen, en het voorkomt de minuut-voor-minuut lijst van de native tijdpicker.
const TIME_HOURS = Array.from({ length: 24 }, (_, i) => ({ value: i, label: pad(i) }));
const TIME_MINUTES = [0, 15, 30, 45].map((m) => ({ value: m, label: pad(m) }));
/** Rond uren+minuten af op het dichtstbijzijnde kwartier, geklemd binnen de dag. */
function snapQuarter(h: number, mi: number): [number, number] {
  let total = Math.round((h * 60 + mi) / 15) * 15;
  if (total >= 24 * 60) total = 24 * 60 - 15;
  if (total < 0) total = 0;
  return [Math.floor(total / 60), total % 60];
}
/** Nieuwe Date met de tijd afgerond op het kwartier, zodat de getoonde tijd én de
 *  opgeslagen waarde gelijk blijven (ook bij geïmporteerde/oude niet-kwartier tijden). */
function snapDateTime(d: Date): Date {
  const [h, mi] = snapQuarter(d.getHours(), d.getMinutes());
  const x = new Date(d);
  x.setHours(h, mi, 0, 0);
  return x;
}

/** Parse a value, treating date-only strings as LOCAL midnight (no UTC off-by-one). */
function parse(v?: string): Date | null {
  if (!v) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Parse a hand-typed "dd-mm-jjjj" (optionally "… uu:mm"); null if invalid. Also
 *  accepts "/" or "." separators and a 2-digit year. */
function parseTyped(v: string, withTime: boolean): Date | null {
  const m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:[ T]+(\d{1,2}):(\d{2}))?$/.exec(
    v.trim(),
  );
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]) - 1;
  let year = Number(m[3]);
  if (m[3].length <= 2) year += year < 30 ? 2000 : 1900;
  const h = withTime ? Number(m[4] ?? 0) : 0;
  const mi = withTime ? Number(m[5] ?? 0) : 0;
  if (month < 0 || month > 11 || day < 1 || day > 31 || h > 23 || mi > 59) return null;
  const d = new Date(year, month, day, h, mi);
  // Reject overflow (e.g. 31-02 rolling over to March).
  if (d.getMonth() !== month || d.getDate() !== day) return null;
  return d;
}

function displayLabel(d: Date, withTime: boolean): string {
  const base = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
  return withTime ? `${base} ${pad(d.getHours())}:${pad(d.getMinutes())}` : base;
}

/** "Week 26 · 22 jun – 28 jun 2026" for the week starting at `monday`. */
function weekRange(monday: Date): string {
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);
  const start = monday.getFullYear() === sunday.getFullYear() ? dm.format(monday) : dmy.format(monday);
  return `Week ${getISOWeek(monday)} · ${start} – ${dmy.format(sunday)}`;
}

/** Monday-first 6×7 day grid for a month. */
function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(year, month, 1 - startOffset + i));
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/**
 * A small themed, rounded, SCROLLABLE dropdown for the calendar's month/year
 * quick-jump (the native <select> popup is OS-rendered and un-stylable). Capped
 * height with overflow so a long year list just scrolls; opens scrolled to the
 * current value. Controlled (value + onChange).
 */
function HeaderSelect({
  value,
  options,
  onChange,
  ariaLabel,
  className,
}: {
  value: number;
  options: { value: number; label: string }[];
  onChange: (v: number) => void;
  ariaLabel: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  React.useEffect(() => {
    if (open && listRef.current) {
      listRef.current
        .querySelector<HTMLElement>('[data-sel="true"]')
        ?.scrollIntoView({ block: "center" });
    }
  }, [open]);

  const current = options.find((o) => o.value === value);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center justify-between gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-sm font-semibold capitalize text-slate-900 transition-colors hover:bg-slate-50 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/30",
          className,
        )}
      >
        <span className="truncate">{current?.label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>
      {open && (
        <div
          ref={listRef}
          className="absolute left-0 top-[calc(100%+0.25rem)] z-[60] max-h-52 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
        >
          {options.map((o) => {
            const sel = o.value === value;
            return (
              <button
                key={o.value}
                type="button"
                data-sel={sel}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={cn(
                  "block w-full rounded-md px-2.5 py-1.5 text-left text-sm capitalize transition-colors",
                  sel
                    ? "bg-brand-50 font-semibold text-brand-700"
                    : "text-slate-700 hover:bg-slate-100",
                )}
              >
                {o.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * Themed, rounded date / datetime / WEEK picker that replaces the browser-native
 * control. Submits a hidden input with "YYYY-MM-DD" (date or weekMode → the
 * Monday) or "YYYY-MM-DDTHH:mm" (withTime). Supports uncontrolled (defaultValue)
 * and controlled (value + onValueChange) use.
 */
export function DateInput({
  id,
  name,
  defaultValue,
  value,
  onValueChange,
  required,
  disabled,
  withTime = false,
  weekMode = false,
  className,
}: {
  id?: string;
  name?: string;
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  required?: boolean;
  disabled?: boolean;
  withTime?: boolean;
  weekMode?: boolean;
  className?: string;
}) {
  const isControlled = value !== undefined;
  const [internal, setInternal] = React.useState<Date | null>(() => {
    const d = parse(defaultValue);
    return d && withTime ? snapDateTime(d) : d;
  });
  const date = isControlled ? parse(value) : internal;

  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState(() => {
    const d = parse(value ?? defaultValue) ?? new Date();
    return { y: d.getFullYear(), m: d.getMonth() };
  });
  const [time, setTime] = React.useState(() => {
    const d = parse(value ?? defaultValue);
    if (d && withTime) {
      const [h, mi] = snapQuarter(d.getHours(), d.getMinutes());
      return `${pad(h)}:${pad(mi)}`;
    }
    return "09:00";
  });
  // Editable text for the non-week trigger (type the date directly).
  const [text, setText] = React.useState(() => {
    const d = parse(value ?? defaultValue);
    return d ? displayLabel(d, withTime) : "";
  });
  const [hoverWeek, setHoverWeek] = React.useState<number | null>(null);
  const rootRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  function serialize(d: Date | null): string {
    if (!d) return "";
    if (weekMode) return toDateValue(startOfISOWeek(d));
    return withTime ? toDateTimeValue(d) : toDateValue(d);
  }
  const submitValue = serialize(date);

  // Resync the typed text whenever the committed value changes (calendar pick,
  // Vandaag/Wissen, external value) — keyed on submitValue so it never clobbers
  // mid-typing (the date isn't committed until blur/Enter). This is a deliberate
  // derived-state sync; both the effect-set-state and the intentionally-partial
  // deps are suppressed for it.
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!weekMode) setText(date ? displayLabel(date, withTime) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submitValue, withTime, weekMode]);

  function commit(d: Date | null) {
    if (!isControlled) setInternal(d);
    onValueChange?.(serialize(d));
  }

  /** Parse the typed text and commit it (or revert to the current date). */
  function commitText() {
    const t = text.trim();
    if (t === "") {
      commit(null);
      return;
    }
    const parsed = parseTyped(t, withTime);
    if (parsed) {
      // Keep the staged time when the user typed only a date (no "uu:mm").
      if (withTime) {
        if (/[ T]+\d{1,2}:\d{2}/.test(t)) {
          const [h, mi] = snapQuarter(parsed.getHours(), parsed.getMinutes());
          parsed.setHours(h, mi, 0, 0);
          setTime(`${pad(h)}:${pad(mi)}`);
        } else {
          const [h, mi] = time.split(":").map(Number);
          parsed.setHours(h || 0, mi || 0, 0, 0);
        }
      }
      commit(parsed);
      setView({ y: parsed.getFullYear(), m: parsed.getMonth() });
      setText(displayLabel(parsed, withTime));
    } else {
      setText(date ? displayLabel(date, withTime) : "");
    }
  }

  function pickDay(day: Date) {
    let d: Date;
    if (weekMode) d = startOfISOWeek(day);
    else if (withTime) {
      const [h, mi] = time.split(":").map(Number);
      d = new Date(day);
      d.setHours(h || 0, mi || 0, 0, 0);
    } else d = new Date(day.getFullYear(), day.getMonth(), day.getDate());
    commit(d);
    setView({ y: day.getFullYear(), m: day.getMonth() });
    if (!withTime) setOpen(false);
  }

  function onTimeChange(t: string) {
    setTime(t);
    if (date) {
      const [h, mi] = t.split(":").map(Number);
      const d = new Date(date);
      d.setHours(h || 0, mi || 0, 0, 0);
      commit(d);
    }
  }

  const grid = monthGrid(view.y, view.m);
  const today = new Date();
  // Quick-jump years: ~10 ahead down to ~90 back (covers birthdates), always
  // widened to include whatever year is currently in view.
  const maxY = Math.max(today.getFullYear() + 10, view.y);
  const minY = Math.min(today.getFullYear() - 90, view.y);
  const years = Array.from({ length: maxY - minY + 1 }, (_, i) => maxY - i);
  const selMonday = date && weekMode ? startOfISOWeek(date).getTime() : null;

  const triggerLabel = date
    ? weekMode
      ? weekRange(startOfISOWeek(date))
      : displayLabel(date, withTime)
    : weekMode
      ? "Kies een week"
      : withTime
        ? "dd-mm-jjjj  uu:mm"
        : "dd-mm-jjjj";

  const [timeH, timeM] = time.split(":").map(Number);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <input type="hidden" name={name} value={submitValue} />
      {weekMode ? (
        <button
          type="button"
          id={id}
          disabled={disabled}
          onClick={() => !disabled && setOpen((o) => !o)}
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 shadow-sm transition-colors focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:bg-slate-50",
            open && "border-brand-500 ring-2 ring-brand-500/30",
          )}
        >
          <span className={cn("whitespace-nowrap", !date && "text-slate-400")}>{triggerLabel}</span>
          <CalendarIcon className="h-4 w-4 shrink-0 text-slate-400" />
        </button>
      ) : (
        <div className="relative">
          <input
            type="text"
            id={id}
            disabled={disabled}
            required={required}
            value={text}
            placeholder={withTime ? "dd-mm-jjjj  uu:mm" : "dd-mm-jjjj"}
            onChange={(ev) => setText(ev.target.value)}
            onFocus={() => !disabled && setOpen(true)}
            onBlur={() => {
              // Ignore the blur that fires when you switch browser tab/window
              // (the document loses focus) — keep the in-progress text instead
              // of reverting it. Only commit on a real in-page blur.
              if (typeof document !== "undefined" && !document.hasFocus()) return;
              commitText();
            }}
            onKeyDown={(ev) => {
              if (ev.key === "Enter") {
                ev.preventDefault();
                commitText();
                setOpen(false);
              }
            }}
            className={cn(
              "w-full rounded-lg border border-slate-300 bg-white py-2 pl-3 pr-10 text-sm text-slate-900 shadow-sm transition-colors placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 disabled:cursor-not-allowed disabled:bg-slate-50",
              open && "border-brand-500 ring-2 ring-brand-500/30",
            )}
          />
          <button
            type="button"
            aria-label="Kalender openen"
            disabled={disabled}
            onMouseDown={(ev) => ev.preventDefault()}
            onClick={() => !disabled && setOpen(true)}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <CalendarIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {open && (
        <div className="absolute z-50 mt-1 w-[18rem] rounded-xl border border-slate-200 bg-white p-3 shadow-lg">
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              aria-label="Vorige maand"
              onClick={() => setView((v) => ({ y: v.m === 0 ? v.y - 1 : v.y, m: (v.m + 11) % 12 }))}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5">
              <HeaderSelect
                ariaLabel="Maand"
                value={view.m}
                onChange={(m) => setView((v) => ({ ...v, m }))}
                options={MONTHS.map((mo, i) => ({ value: i, label: mo }))}
                className="min-w-[7rem]"
              />
              <HeaderSelect
                ariaLabel="Jaar"
                value={view.y}
                onChange={(y) => setView((v) => ({ ...v, y }))}
                options={years.map((y) => ({ value: y, label: String(y) }))}
                className="min-w-[4.75rem]"
              />
            </div>
            <button
              type="button"
              aria-label="Volgende maand"
              onClick={() => setView((v) => ({ y: v.m === 11 ? v.y + 1 : v.y, m: (v.m + 1) % 12 }))}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 text-center text-[11px] font-medium uppercase text-slate-400">
            {WEEKDAYS.map((w) => (
              <div key={w} className="py-1">{w}</div>
            ))}
          </div>
          <div
            className={cn("mt-1 grid grid-cols-7", weekMode ? "gap-y-0.5" : "gap-0.5")}
            onMouseLeave={() => setHoverWeek(null)}
          >
            {grid.map((day, idx) => {
              const inMonth = day.getMonth() === view.m;
              const isToday = sameDay(day, today);
              const col = idx % 7;

              if (weekMode) {
                const dayMonday = startOfISOWeek(day).getTime();
                const inSel = selMonday === dayMonday;
                const inHover = hoverWeek === dayMonday;
                return (
                  <button
                    key={`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
                    type="button"
                    onMouseEnter={() => setHoverWeek(dayMonday)}
                    onClick={() => pickDay(day)}
                    className={cn(
                      "flex h-9 items-center justify-center text-sm transition-colors",
                      inSel
                        ? "bg-brand-100 font-semibold text-brand-800"
                        : inHover
                          ? "bg-slate-100 text-slate-700"
                          : inMonth
                            ? "text-slate-700 hover:bg-slate-50"
                            : "text-slate-300 hover:bg-slate-50",
                      col === 0 && "rounded-l-lg",
                      col === 6 && "rounded-r-lg",
                      !inSel && isToday && "ring-1 ring-inset ring-brand-300",
                    )}
                  >
                    {day.getDate()}
                  </button>
                );
              }

              const isSel = date != null && sameDay(day, date);
              return (
                <button
                  key={`${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`}
                  type="button"
                  onClick={() => pickDay(day)}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg text-sm transition-colors",
                    isSel
                      ? "bg-brand-600 font-semibold text-white"
                      : inMonth
                        ? "text-slate-700 hover:bg-slate-100"
                        : "text-slate-300 hover:bg-slate-50",
                    !isSel && isToday && "ring-1 ring-inset ring-brand-300",
                  )}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          {weekMode && date && (
            <p className="mt-2 rounded-lg bg-slate-50 px-3 py-1.5 text-center text-xs text-slate-600">
              ma {dm.format(startOfISOWeek(date))} – zo{" "}
              {dmy.format(new Date(startOfISOWeek(date).getTime() + 6 * 86400000))}
            </p>
          )}

          {withTime && (
            <div className="mt-2 flex items-center gap-2 border-t border-slate-100 pt-3">
              <Clock className="h-4 w-4 shrink-0 text-slate-400" />
              <div className="flex items-center gap-1.5">
                <HeaderSelect
                  ariaLabel="Uur"
                  value={timeH}
                  options={TIME_HOURS}
                  onChange={(h) => onTimeChange(`${pad(h)}:${pad(timeM)}`)}
                  className="min-w-[3.5rem]"
                />
                <span className="text-sm font-semibold text-slate-400">:</span>
                <HeaderSelect
                  ariaLabel="Minuten"
                  value={timeM}
                  options={TIME_MINUTES}
                  onChange={(m) => onTimeChange(`${pad(timeH)}:${pad(m)}`)}
                  className="min-w-[3.5rem]"
                />
              </div>
              <span className="ml-auto text-xs text-slate-400">per kwartier</span>
            </div>
          )}

          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-sm">
            <button
              type="button"
              onClick={() => {
                commit(null);
                setOpen(false);
              }}
              className="font-medium text-slate-500 hover:text-slate-900"
            >
              Wissen
            </button>
            <button
              type="button"
              onClick={() => {
                const now = new Date();
                setView({ y: now.getFullYear(), m: now.getMonth() });
                if (withTime) {
                  const [h, mi] = snapQuarter(now.getHours(), now.getMinutes());
                  setTime(`${pad(h)}:${pad(mi)}`);
                  const d = new Date(now);
                  d.setHours(h, mi, 0, 0);
                  commit(d);
                } else if (weekMode) {
                  commit(startOfISOWeek(now));
                  setOpen(false);
                } else {
                  commit(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
                  setOpen(false);
                }
              }}
              className="font-medium text-brand-700 hover:text-brand-800"
            >
              {weekMode ? "Deze week" : "Vandaag"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
