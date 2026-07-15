import { EVAL_SCORES, labelFor } from "./domain";

/** The kwartaal (1..4) a date falls in. */
export function quarterOf(date: Date): number {
  return Math.floor(date.getMonth() / 3) + 1;
}

export type EvaluationScores = {
  scoreCraft: number | null;
  scoreEffort: number | null;
  scoreSafety: number | null;
  scoreCollaboration: number | null;
  scoreReporting: number | null;
};

/** Average of the filled-in VCU scores (1..4), rounded to 1 decimal, or null. */
export function averageScore(e: EvaluationScores): number | null {
  const vals = [
    e.scoreCraft,
    e.scoreEffort,
    e.scoreSafety,
    e.scoreCollaboration,
    e.scoreReporting,
  ].filter((x): x is number => typeof x === "number" && x > 0);
  if (vals.length === 0) return null;
  return Math.round((vals.reduce((s, v) => s + v, 0) / vals.length) * 10) / 10;
}

/** Dutch label for a 1..4 score ("Goed"), or "—". */
export function scoreLabel(v: number | null | undefined): string {
  return v ? labelFor(EVAL_SCORES, String(v)) : "—";
}

// Red→green colour scale for the 1..4 scores (Slecht→Matig→Normaal→Goed).
// Literal class strings so Tailwind picks them up.

/** Peer-checked fill for the score radio buttons in the evaluation form. */
export const SCORE_CHECKED: Record<string, string> = {
  "1": "peer-checked:border-red-500 peer-checked:bg-red-500 peer-checked:text-white",
  "2": "peer-checked:border-orange-500 peer-checked:bg-orange-500 peer-checked:text-white",
  "3": "peer-checked:border-lime-500 peer-checked:bg-lime-500 peer-checked:text-white",
  "4": "peer-checked:border-emerald-600 peer-checked:bg-emerald-600 peer-checked:text-white",
};

/** Soft badge (bg + text + ring) for a score, e.g. in lists. */
export const SCORE_BADGE: Record<number, string> = {
  1: "bg-red-50 text-red-700 ring-red-200",
  2: "bg-orange-50 text-orange-700 ring-orange-200",
  3: "bg-lime-50 text-lime-700 ring-lime-200",
  4: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

/** Solid fill for a selected cell (e.g. the detail score table). */
export const SCORE_SOLID: Record<number, string> = {
  1: "bg-red-500",
  2: "bg-orange-500",
  3: "bg-lime-500",
  4: "bg-emerald-600",
};

export type CertStatus = "valid" | "expiring" | "expired" | "none";

/** Certificate validity vs an expiry date — "expiring" within `days` (default 60). */
export function certStatus(
  expiry: Date | null | undefined,
  now: Date,
  days = 60,
): CertStatus {
  if (!expiry) return "none";
  const ms = expiry.getTime() - now.getTime();
  if (ms < 0) return "expired";
  if (ms < days * 86_400_000) return "expiring";
  return "valid";
}

export const CERT_STATUS_META: Record<
  CertStatus,
  { label: string; color: "green" | "amber" | "red" | "slate" }
> = {
  valid: { label: "Geldig", color: "green" },
  expiring: { label: "Verloopt binnenkort", color: "amber" },
  expired: { label: "Verlopen", color: "red" },
  none: { label: "Geen einddatum", color: "slate" },
};
