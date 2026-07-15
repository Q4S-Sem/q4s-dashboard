import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes with conditional logic, de-duplicating conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const euro = new Intl.NumberFormat("nl-NL", {
  style: "currency",
  currency: "EUR",
});

/** Format a number as euros, e.g. 1234.5 -> "€ 1.234,50". */
export function formatCurrency(value: number | null | undefined): string {
  return euro.format(value ?? 0);
}

const numberFmt = new Intl.NumberFormat("nl-NL", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** Format hours, e.g. 40 -> "40", 37.5 -> "37,5". */
export function formatHours(value: number | null | undefined): string {
  return numberFmt.format(value ?? 0);
}

/** Format a percentage value already expressed as a number, e.g. 21 -> "21%". */
export function formatPercent(value: number | null | undefined): string {
  return `${numberFmt.format(value ?? 0)}%`;
}

const dateFmt = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const dateLongFmt = new Intl.DateTimeFormat("nl-NL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

/** Format a date as "11-06-2026". Accepts Date, ISO string, or null. */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return dateFmt.format(d);
}

/** Format a date as "11 juni 2026". */
export function formatDateLong(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const d = typeof value === "string" ? new Date(value) : value;
  return dateLongFmt.format(d);
}

/** Round to 2 decimals, avoiding floating-point drift (e.g. 1.005 -> 1.01). */
export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/** Monday (00:00) of the ISO week containing `date`. */
export function startOfISOWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday
  const diff = (day === 0 ? -6 : 1) - day;
  d.setDate(d.getDate() + diff);
  return d;
}

/** ISO week number (1–53) for a date. */
export function getISOWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

/** "Week 24 · 2026" label for a week-start date. Uses the ISO week-YEAR (the
 *  year of the Thursday in that week), so a year-boundary week like the Monday
 *  2025-12-29 correctly reads "Week 1 · 2026", not "· 2025". */
export function formatWeekLabel(weekStart: Date | string): string {
  const d = typeof weekStart === "string" ? new Date(weekStart) : weekStart;
  const thu = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  thu.setUTCDate(thu.getUTCDate() + 4 - (thu.getUTCDay() || 7));
  return `Week ${getISOWeek(d)} · ${thu.getUTCFullYear()}`;
}

/** Parse a money/number string that may use a comma as decimal separator. */
export function parseDecimal(input: string | number | null | undefined): number {
  if (input === null || input === undefined || input === "") return 0;
  if (typeof input === "number") return input;
  const normalized = input.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const n = Number(normalized);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse hours from an HTML <input type="number">. Number inputs ALWAYS submit
 * a dot decimal separator regardless of locale, so 8.5 must NOT go through
 * parseDecimal (which strips dots as thousands separators → 85). Tolerates a
 * stray comma too. Returns a non-negative number; invalid/empty → 0.
 */
export function parseHours(input: string | number | null | undefined): number {
  if (input === null || input === undefined || input === "") return 0;
  const n =
    typeof input === "number" ? input : Number(String(input).trim().replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}
