// Recruitment-KPI's en knelpunt-analyse — PURE rekenfuncties, GEEN database.
// De pagina haalt de records met Prisma op en geeft ze als gewone arrays door;
// hier wordt alleen gerekend. Alles is deterministisch en uitlegbaar: elke KPI
// heeft een Nederlands label en een formule die je in de code kunt nalezen.
//
// Alleen-lezen: dit bestand kan niets muteren, versturen of van status wisselen.

import {
  APPLICATION_STATUSES,
  labelFor,
  colorFor,
  CANDIDATE_AVAILABLE_VALUES,
  type BadgeColor,
} from "./domain";
import { AUTOMATION_PRESETS } from "./automation-defs";
import { formatHours, formatPercent, round2 } from "./utils";

// ---------- Invoer (platte, al opgehaalde records) ----------

export type ApplicationKpiInput = {
  id: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
};

export type VacancyKpiInput = {
  id: string;
  status: string;
};

export type CandidateKpiInput = {
  id: string;
  availability: string;
  updatedAt: Date;
};

// ---------- Vaste definities ----------

/** De lineaire sollicitatie-pipeline. REJECTED is een uitstroom, geen fase. */
export const PIPELINE_STATUSES = ["NEW", "SCREENING", "PROPOSED", "PLACED"] as const;

/** De fasen waarin een sollicitatie nog werk vraagt (dus zonder eindfasen). */
export const OPEN_APPLICATION_STATUSES = ["NEW", "SCREENING", "PROPOSED"] as const;

/** Een vacature staat "open" zodra hij gepubliceerd is (CONCEPT/IMPROVED zijn nog
 *  niet uit, PAUSED is tijdelijk gestopt). */
export const OPEN_VACANCY_STATUSES = ["PUBLISHED"] as const;

/** Drempels uit de bestaande automatiseringspresets, zodat "stilgevallen" hier
 *  exact hetzelfde betekent als in de automatische-acties-regels. */
function presetThresholdDays(trigger: string, fallback: number): number {
  return AUTOMATION_PRESETS.find((p) => p.trigger === trigger)?.thresholdDays ?? fallback;
}

export const CANDIDATE_IDLE_DAYS = presetThresholdDays("CANDIDATE_STALLED", 14);
export const APPLICATION_IDLE_DAYS = presetThresholdDays("APPLICATION_STALLED", 7);

/** Nederlandse labels bij elke KPI — de pagina toont deze letterlijk. */
export const RECRUITMENT_KPI_LABELS = {
  funnel: "Sollicitatie-funnel per fase",
  current: "Nu in deze fase",
  reached: "Deze fase bereikt",
  conversion: "Doorstroom vanaf de vorige fase",
  avgDaysInStage: "Gemiddeld aantal dagen in de huidige fase",
  timeToPlace: "Gemiddelde doorlooptijd van sollicitatie tot plaatsing",
  medianTimeToPlace: "Mediane doorlooptijd tot plaatsing",
  openVacancies: "Open vacatures",
  activeCandidates: "Beschikbare kandidaten",
  candidatesPerOpenVacancy: "Beschikbare kandidaten per open vacature",
  stalledCandidates: "Kandidaten zonder opvolging",
  stalledApplications: "Open sollicitaties zonder opvolging",
  rejected: "Afgewezen sollicitaties",
  bottleneck: "Grootste knelpunt (laagste doorstroom)",
  slowestStage: "Langste wachttijd in een open fase",
} as const;

export type RecruitmentKpiLabels = typeof RECRUITMENT_KPI_LABELS;

// ---------- Datum-hulpjes (hele kalenderdagen, UTC — zoals de automatisering) ----------

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Aantal hele kalenderdagen tussen twee momenten (kan negatief zijn). */
export function daysBetween(from: Date, to: Date): number {
  return Math.floor((startOfUtcDay(to).getTime() - startOfUtcDay(from).getTime()) / 86_400_000);
}

/** Gemiddelde, afgerond op 2 decimalen; lege lijst → 0 (nooit NaN). */
function average(values: number[]): number {
  if (values.length === 0) return 0;
  return round2(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/** Mediaan, afgerond op 2 decimalen; lege lijst → 0. */
function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const value = sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return round2(value);
}

function applications(count: number): string {
  return count === 1 ? "sollicitatie" : "sollicitaties";
}

// ---------- Funnel + doorstroom ----------

export type PipelineStageKpi = {
  status: string;
  /** Nederlands faselabel uit APPLICATION_STATUSES. */
  label: string;
  color: BadgeColor;
  /** Aantal sollicitaties dat NU in deze fase staat. */
  current: number;
  /** Aantal sollicitaties dat deze fase heeft bereikt = som van `current` van
   *  deze en alle latere fasen. Afgewezen sollicitaties tellen niet mee: hun
   *  laatst bereikte fase wordt niet vastgelegd. */
  reached: number;
  /** reached / reached(vorige fase) × 100. Null voor de instroomfase en zodra de
   *  vorige fase nog nul bereikte (dan valt er niets te delen). */
  conversionRate: number | null;
  conversionLabel: string;
  /** Gemiddeld aantal dagen sinds de laatste update van de sollicitaties die nu
   *  in deze fase staan (dwell time). */
  avgDaysInStage: number;
};

export type ApplicationFunnel = {
  /** Alle sollicitaties, inclusief afgewezen. */
  total: number;
  /** Sollicitaties in de pipeline (dus zonder afgewezen). */
  inPipeline: number;
  stages: PipelineStageKpi[];
  rejected: { status: string; label: string; count: number; share: number };
};

/**
 * Bouw de funnel: per fase het huidige aantal, het bereikte aantal, de doorstroom
 * vanaf de vorige fase en de gemiddelde wachttijd in die fase.
 */
export function buildApplicationFunnel(
  apps: ApplicationKpiInput[],
  now: Date,
): ApplicationFunnel {
  const currentByStatus = new Map<string, ApplicationKpiInput[]>();
  for (const app of apps) {
    const bucket = currentByStatus.get(app.status);
    if (bucket) bucket.push(app);
    else currentByStatus.set(app.status, [app]);
  }

  const currents = PIPELINE_STATUSES.map((status) => currentByStatus.get(status) ?? []);

  const stages: PipelineStageKpi[] = PIPELINE_STATUSES.map((status, i) => {
    // Bereikt = deze fase + alle latere fasen (wie geplaatst is, is ook langs screening geweest).
    const reached = currents.slice(i).reduce((sum, list) => sum + list.length, 0);
    const previousReached = i === 0 ? null : currents.slice(i - 1).reduce((sum, list) => sum + list.length, 0);
    const conversionRate =
      previousReached === null || previousReached === 0 ? null : round2((reached / previousReached) * 100);
    const conversionLabel =
      i === 0
        ? "Instroom"
        : `${labelFor(APPLICATION_STATUSES, PIPELINE_STATUSES[i - 1])} → ${labelFor(APPLICATION_STATUSES, status)}`;

    return {
      status,
      label: labelFor(APPLICATION_STATUSES, status),
      color: colorFor(APPLICATION_STATUSES, status),
      current: currents[i].length,
      reached,
      conversionRate,
      conversionLabel,
      avgDaysInStage: average(currents[i].map((app) => Math.max(0, daysBetween(app.updatedAt, now)))),
    };
  });

  const total = apps.length;
  const rejectedCount = (currentByStatus.get("REJECTED") ?? []).length;

  return {
    total,
    inPipeline: stages[0].reached,
    stages,
    rejected: {
      status: "REJECTED",
      label: labelFor(APPLICATION_STATUSES, "REJECTED"),
      count: rejectedCount,
      share: total === 0 ? 0 : round2((rejectedCount / total) * 100),
    },
  };
}

// ---------- Doorlooptijd tot plaatsing ----------

export type TimeToPlaceKpi = {
  placed: number;
  averageDays: number;
  medianDays: number;
};

/** Doorlooptijd van een geplaatste sollicitatie = hele dagen tussen createdAt en
 *  updatedAt (het moment waarop de fase PLACED werd vastgelegd). */
export function computeTimeToPlace(apps: ApplicationKpiInput[]): TimeToPlaceKpi {
  const durations = apps
    .filter((app) => app.status === "PLACED")
    .map((app) => Math.max(0, daysBetween(app.createdAt, app.updatedAt)));

  return {
    placed: durations.length,
    averageDays: average(durations),
    medianDays: median(durations),
  };
}

// ---------- Capaciteit: open vacatures vs. beschikbare kandidaten ----------

export type CapacityKpi = {
  openVacancies: number;
  activeCandidates: number;
  candidatesPerOpenVacancy: number;
};

export function computeCapacity(
  vacancies: VacancyKpiInput[],
  candidates: CandidateKpiInput[],
): CapacityKpi {
  const openStatuses = new Set<string>(OPEN_VACANCY_STATUSES);
  const availableValues = new Set<string>(CANDIDATE_AVAILABLE_VALUES);
  const openVacancies = vacancies.filter((v) => openStatuses.has(v.status)).length;
  const activeCandidates = candidates.filter((c) => availableValues.has(c.availability)).length;

  return {
    openVacancies,
    activeCandidates,
    // Geen open vacatures → 0 (geen deling door nul).
    candidatesPerOpenVacancy: openVacancies === 0 ? 0 : round2(activeCandidates / openVacancies),
  };
}

// ---------- Stilgevallen items (drempels uit de automatisering) ----------

export type StalledKpi = {
  candidates: number;
  applications: number;
  candidateThresholdDays: number;
  applicationThresholdDays: number;
};

/**
 * Tel de records die STRIKT langer dan de drempel niet zijn bijgewerkt — dezelfde
 * regel als buildStalledRecruitmentTasks in automation-defs.ts, met dezelfde
 * drempels uit AUTOMATION_PRESETS. Alleen open sollicitaties tellen mee.
 */
export function countStalledItems({
  now,
  candidates,
  applications: apps,
}: {
  now: Date;
  candidates: CandidateKpiInput[];
  applications: ApplicationKpiInput[];
}): StalledKpi {
  const openStatuses = new Set<string>(OPEN_APPLICATION_STATUSES);

  return {
    candidates: candidates.filter((c) => daysBetween(c.updatedAt, now) > CANDIDATE_IDLE_DAYS).length,
    applications: apps.filter(
      (a) => openStatuses.has(a.status) && daysBetween(a.updatedAt, now) > APPLICATION_IDLE_DAYS,
    ).length,
    candidateThresholdDays: CANDIDATE_IDLE_DAYS,
    applicationThresholdDays: APPLICATION_IDLE_DAYS,
  };
}

// ---------- Knelpunten ----------

export type BottleneckStage = {
  status: string;
  label: string;
  fromStatus: string;
  fromLabel: string;
  conversionRate: number;
  avgDaysInStage: number;
  reason: string;
};

/**
 * De fase met de LAAGSTE doorstroom vanaf de vorige fase. Gelijke doorstroom →
 * de fase met de langste wachttijd wint; blijft het gelijk, dan de vroegste fase
 * in de pipeline. Null als er nog geen doorstroom te berekenen valt.
 */
export function findBottleneckStage(stages: PipelineStageKpi[]): BottleneckStage | null {
  let best: { stage: PipelineStageKpi; index: number } | null = null;

  stages.forEach((stage, index) => {
    if (index === 0 || stage.conversionRate === null) return;
    if (
      best === null ||
      stage.conversionRate < best.stage.conversionRate! ||
      (stage.conversionRate === best.stage.conversionRate && stage.avgDaysInStage > best.stage.avgDaysInStage)
    ) {
      best = { stage, index };
    }
  });

  if (best === null) return null;
  const { stage, index } = best as { stage: PipelineStageKpi; index: number };
  const previous = stages[index - 1];

  return {
    status: stage.status,
    label: stage.label,
    fromStatus: previous.status,
    fromLabel: previous.label,
    conversionRate: stage.conversionRate!,
    avgDaysInStage: stage.avgDaysInStage,
    reason:
      `Laagste doorstroom: ${formatPercent(stage.conversionRate)} van ${previous.label} naar ${stage.label} ` +
      `(${stage.reached} van ${previous.reached} ${applications(previous.reached)}), ` +
      `gemiddeld ${formatHours(stage.avgDaysInStage)} dagen in deze fase.`,
  };
}

export type SlowestStage = {
  status: string;
  label: string;
  current: number;
  avgDaysInStage: number;
  reason: string;
};

/**
 * De OPEN fase waarin sollicitaties gemiddeld het langst blijven liggen. De
 * eindfase Geplaatst telt niet mee — daar hoeft niemand meer iets te doen.
 * Gelijke wachttijd → de vroegste fase in de pipeline. Null als geen enkele open
 * fase sollicitaties bevat.
 */
export function findSlowestStage(stages: PipelineStageKpi[]): SlowestStage | null {
  const openStatuses = new Set<string>(OPEN_APPLICATION_STATUSES);
  let best: PipelineStageKpi | null = null;

  for (const stage of stages) {
    if (!openStatuses.has(stage.status) || stage.current === 0) continue;
    if (best === null || stage.avgDaysInStage > best.avgDaysInStage) best = stage;
  }

  if (best === null) return null;
  const stage = best as PipelineStageKpi;

  return {
    status: stage.status,
    label: stage.label,
    current: stage.current,
    avgDaysInStage: stage.avgDaysInStage,
    reason:
      `Langste wachttijd: gemiddeld ${formatHours(stage.avgDaysInStage)} dagen in fase ${stage.label} ` +
      `(${stage.current} open ${applications(stage.current)}).`,
  };
}

// ---------- Samenstelling ----------

export type RecruitmentKpis = {
  generatedAt: Date;
  funnel: ApplicationFunnel;
  timeToPlace: TimeToPlaceKpi;
  capacity: CapacityKpi;
  stalled: StalledKpi;
  bottleneck: BottleneckStage | null;
  slowestStage: SlowestStage | null;
  labels: RecruitmentKpiLabels;
};

/** Alle recruitment-KPI's in één keer, uit al opgehaalde records. */
export function buildRecruitmentKpis({
  now,
  applications: apps,
  vacancies,
  candidates,
}: {
  now: Date;
  applications: ApplicationKpiInput[];
  vacancies: VacancyKpiInput[];
  candidates: CandidateKpiInput[];
}): RecruitmentKpis {
  const funnel = buildApplicationFunnel(apps, now);

  return {
    generatedAt: now,
    funnel,
    timeToPlace: computeTimeToPlace(apps),
    capacity: computeCapacity(vacancies, candidates),
    stalled: countStalledItems({ now, candidates, applications: apps }),
    bottleneck: findBottleneckStage(funnel.stages),
    slowestStage: findSlowestStage(funnel.stages),
    labels: RECRUITMENT_KPI_LABELS,
  };
}
