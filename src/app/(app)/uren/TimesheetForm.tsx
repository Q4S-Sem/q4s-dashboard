"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Field, Select, Label } from "@/components/ui/field";
import { NumberInput } from "@/components/ui/number-input";
import { DateInput } from "@/components/ui/date-input";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { emptyFormState, type FormState } from "@/lib/form";
import { cn, parseHours, formatHours, startOfISOWeek } from "@/lib/utils";

const DAY_NAMES = [
  "Maandag",
  "Dinsdag",
  "Woensdag",
  "Donderdag",
  "Vrijdag",
  "Zaterdag",
  "Zondag",
];
const dayFmt = new Intl.DateTimeFormat("nl-NL", { day: "2-digit", month: "short" });

/** Local-timezone-safe YYYY-MM-DD. */
function toInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
function parseInput(s: string) {
  return new Date(`${s}T00:00:00`);
}

export type TimesheetFormEntry = {
  date: string;
  hours: number;
  note?: string;
  km?: number;
};

export function TimesheetForm({
  action,
  placements,
  placementLabel,
  timesheetId,
  defaultPlacementId,
  defaultWeek,
  defaultOvertime,
  entries,
  submitLabel,
  cancelHref,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** Provide for create mode (placement picker). */
  placements?: { id: string; label: string }[];
  /** Provide for edit mode (read-only placement). */
  placementLabel?: string;
  timesheetId?: string;
  defaultPlacementId?: string;
  defaultWeek?: string;
  defaultOvertime?: string;
  entries?: TimesheetFormEntry[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, emptyFormState);
  const e = state.fieldErrors ?? {};

  const initialWeek = defaultWeek ?? toInput(startOfISOWeek(new Date()));
  const [week, setWeek] = useState(initialWeek);
  const [hours, setHours] = useState<string[]>(() => {
    const arr = ["", "", "", "", "", "", ""];
    if (entries && entries.length) {
      const monday = startOfISOWeek(parseInput(initialWeek));
      for (const en of entries) {
        const offset = Math.round(
          (parseInput(en.date.slice(0, 10)).getTime() - monday.getTime()) /
            86400000,
        );
        if (offset >= 0 && offset < 7) arr[offset] = String(en.hours);
      }
    }
    return arr;
  });
  const [notes, setNotes] = useState<string[]>(() => {
    const arr = ["", "", "", "", "", "", ""];
    if (entries && entries.length) {
      const mon = startOfISOWeek(parseInput(initialWeek));
      for (const en of entries) {
        const offset = Math.round(
          (parseInput(en.date.slice(0, 10)).getTime() - mon.getTime()) / 86400000,
        );
        if (offset >= 0 && offset < 7) arr[offset] = en.note ?? "";
      }
    }
    return arr;
  });
  const [km, setKm] = useState<string[]>(() => {
    const arr = ["", "", "", "", "", "", ""];
    if (entries && entries.length) {
      const mon = startOfISOWeek(parseInput(initialWeek));
      for (const en of entries) {
        const offset = Math.round(
          (parseInput(en.date.slice(0, 10)).getTime() - mon.getTime()) / 86400000,
        );
        if (offset >= 0 && offset < 7 && en.km != null) arr[offset] = String(en.km);
      }
    }
    return arr;
  });
  const monday = startOfISOWeek(parseInput(week));
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(d.getDate() + i);
    return d;
  });
  const total = hours.reduce((sum, h) => sum + parseHours(h), 0);

  const setHour = (i: number, v: string) =>
    setHours((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  const setNote = (i: number, v: string) =>
    setNotes((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  const setKmDay = (i: number, v: string) =>
    setKm((prev) => {
      const next = [...prev];
      next[i] = v;
      return next;
    });
  const totalKm = km.reduce((sum, k) => sum + parseHours(k), 0);

  return (
    <form action={formAction}>
      {timesheetId && <input type="hidden" name="id" value={timesheetId} />}
      <Card>
        <CardContent className="space-y-5">
          {state.error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {state.error}
            </p>
          )}

          {placements ? (
            <Field label="Plaatsing" htmlFor="placementId" required error={e.placementId}>
              <Select
                id="placementId"
                name="placementId"
                defaultValue={defaultPlacementId ?? ""}
                required
              >
                <option value="" disabled>
                  Kies een plaatsing…
                </option>
                {placements.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <div>
              <Label>Plaatsing</Label>
              <p className="text-sm font-medium text-slate-900">{placementLabel}</p>
            </div>
          )}

          <Field
            label="Week"
            htmlFor="weekStart"
            required
            error={e.weekStart}
            hint={`Urenstaat voor de week van maandag ${dayFmt.format(monday)} t/m zondag ${dayFmt.format(days[6])}`}
          >
            <DateInput
              weekMode
              id="weekStart"
              name="weekStart"
              value={week}
              onValueChange={setWeek}
            />
          </Field>

          <div>
            <Label>Uren per dag</Label>
            <div className="overflow-hidden rounded-lg border border-slate-200">
              {days.map((d, i) => (
                <div
                  key={i}
                  className={cn(
                    "px-4 py-2.5",
                    i >= 5 && "bg-slate-50",
                    i > 0 && "border-t border-slate-100",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-sm">
                      <span className="font-medium text-slate-700">{DAY_NAMES[i]}</span>{" "}
                      <span className="text-slate-400">{dayFmt.format(d)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400">Uren</span>
                        <NumberInput
                          name={`hours_${i}`}
                          value={hours[i]}
                          onChange={(ev) => setHour(i, ev.target.value)}
                          min={0}
                          step={0.25}
                          placeholder="0"
                          aria-label={`Uren ${DAY_NAMES[i]}`}
                          className="w-20 px-2.5 py-1.5 text-right"
                        />
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400">Km</span>
                        <NumberInput
                          name={`km_${i}`}
                          value={km[i]}
                          onChange={(ev) => setKmDay(i, ev.target.value)}
                          min={0}
                          step={1}
                          placeholder="0"
                          aria-label={`Kilometers ${DAY_NAMES[i]}`}
                          className="w-20 px-2.5 py-1.5 text-right"
                        />
                      </div>
                    </div>
                  </div>
                  <input
                    type="text"
                    name={`note_${i}`}
                    value={notes[i]}
                    onChange={(ev) => setNote(i, ev.target.value)}
                    placeholder="Notitie voor deze dag (optioneel)…"
                    aria-label={`Notitie ${DAY_NAMES[i]}`}
                    className="mt-2 block w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-sm text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Overzicht onderaan */}
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-700">Overzicht</p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Totaal uren
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                  {formatHours(total)} u
                </p>
              </div>
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Totaal kilometers
                </p>
                <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">
                  {formatHours(totalKm)} km
                </p>
              </div>
              <div>
                <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                  Overuren
                </p>
                <NumberInput
                  name="overtimeHours"
                  min={0}
                  step={0.25}
                  defaultValue={defaultOvertime ?? ""}
                  placeholder="0"
                  aria-label="Overuren"
                  className="w-28 px-3 py-1.5"
                />
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Vul per dag de uren én de gereden kilometers in. De kilometervergoeding
              (inkoop/verkoop) volgt uit het km-tarief op de plaatsing.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2">
          <Link href={cancelHref} className={buttonVariants({ variant: "outline" })}>
            Annuleren
          </Link>
          <SubmitButton>{submitLabel}</SubmitButton>
        </CardFooter>
      </Card>
    </form>
  );
}
