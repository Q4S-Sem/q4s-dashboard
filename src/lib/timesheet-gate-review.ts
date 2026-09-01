import { db } from "./db";
import { distributeDayHours, formatWeekLabel, round2, type DayHours } from "./utils";
import { computeTimesheetMoney } from "./toeslag";
import {
  evaluateTimesheetGate,
  type GateFlag,
  type TimesheetGateDecision,
} from "./timesheet-auto-gate";
import {
  GATE_HISTORY_WEEKS,
  summarizeRecentWeeks,
  type WeeklyTotal,
} from "./timesheet-gate-history";

// ---------------------------------------------------------------------------
// Urencontrole — de data-laag onder /verwerken/controle.
//
// Voor élke uitgelezen, nog niet bevestigde weekstaat in de inbox halen we op
// wat de auto-gate (src/lib/timesheet-auto-gate.ts) nodig heeft — hoeveel
// actieve plaatsingen er bij deze persoon horen, wat hij de afgelopen weken
// gemiddeld schreef, of er al een weekstaat voor die plaatsing + week bestaat, en
// de tarieven van de plaatsing — en laten die pure functie beslissen: gaat dit
// vanzelf door (AUTO_APPROVE) of moet er een mens naar kijken (NEEDS_REVIEW)?
//
// Het geldwerk loopt via computeTimesheetMoney (src/lib/toeslag.ts), precies
// zoals /verwerken en de facturen het rekenen, zodat de bedragen op dit scherm
// gelijk zijn aan wat er straks gefactureerd wordt.
//
// ALLEEN LEZEN: dit bestand keurt niets goed, verstuurt niets en maakt geen
// facturen. Bevestigen doet een mens, via de bestaande confirmInbox-actie.
// ---------------------------------------------------------------------------

/** Alleen uitgelezen staten komen op de controlelijst; NEW moet eerst door de AI. */
const PENDING_STATUS = "EXTRACTED";

/**
 * Hoeveel weken we terugkijken bij het ophalen van de historie: ruimer dan het
 * gemiddelde-venster zelf, zodat gaten (vakantie, ziekte) er niet toe leiden dat
 * we minder dan {@link GATE_HISTORY_WEEKS} weken vinden. Het venster zelf wordt
 * daarna door summarizeRecentWeeks bepaald.
 */
const HISTORY_LOOKBACK_FACTOR = 3;

const WEEK_MS = 7 * 86_400_000;

export type GateReviewRow = {
  /** TimesheetInbox.id — het item zoals het in de inbox staat. */
  id: string;
  decision: TimesheetGateDecision;
  /** Waarom het niet automatisch mag (leeg bij AUTO_APPROVE). */
  reasons: string[];
  flags: GateFlag[];
  /** De controlevlaggen van de AI-uitlezing zelf (TimesheetInbox.reviewFlags). */
  aiFlags: GateFlag[];

  name: string;
  originalName: string;
  source: string;
  confidence: string | null;
  aiNotes: string | null;

  weekStart: Date | null;
  weekLabel: string | null;
  totalHours: number | null;
  overtimeHours: number | null;
  kilometers: number | null;
  /** Uren per dag (Ma..Zo) zoals uitgelezen — leeg vakje = geen uren die dag. */
  dayHours: (number | "")[];

  consultantId: string | null;
  placementId: string | null;
  placementTitle: string | null;
  clientName: string | null;
  chargeRate: number | null;
  costRate: number | null;

  matchedPlacementCount: number;
  recentAvgHours: number | null;
  recentWeeks: number;
  duplicateExists: boolean;

  /** Verkoop/inkoop/marge voor deze week (ex BTW, incl. toeslagen + km). */
  charge: number;
  cost: number;
  margin: number;

  /** Genoeg gegevens om te bevestigen (plaatsing + week + minimaal één dag uren)? */
  canApprove: boolean;
};

export type GateReviewTotals = {
  count: number;
  hours: number;
  charge: number;
  cost: number;
  margin: number;
};

export type TimesheetGateReview = {
  /** Twijfelgevallen — bovenaan het scherm, mét concrete redenen. */
  needsReview: GateReviewRow[];
  /** Schone staten die automatisch door mogen (samengevat onderaan). */
  autoApprove: GateReviewRow[];
  totals: { needsReview: GateReviewTotals; autoApprove: GateReviewTotals };
  /** Inbox-items die nog uitgelezen moeten worden (status NEW). */
  notExtracted: number;
};

/** De uitgelezen dag-uren (JSON) veilig over Ma..Zo verdelen. */
function prefillDays(extractedJson: string | null, monday: Date | null): (number | "")[] {
  if (!extractedJson) return ["", "", "", "", "", "", ""];
  try {
    const days = (JSON.parse(extractedJson) as { days?: DayHours[] }).days ?? [];
    return distributeDayHours(days, monday);
  } catch {
    return ["", "", "", "", "", "", ""];
  }
}

/** De controlevlaggen van de AI-uitlezing (JSON) veilig inlezen. */
function parseAiFlags(reviewFlags: string | null): GateFlag[] {
  if (!reviewFlags) return [];
  try {
    const parsed = JSON.parse(reviewFlags);
    return Array.isArray(parsed) ? (parsed as GateFlag[]) : [];
  } catch {
    return [];
  }
}

/** Dag-uren → dagregels met datum, zoals de urenstaat ze straks krijgt. */
function toEntries(dayHours: (number | "")[], monday: Date | null): { date: Date; hours: number }[] {
  if (!monday) return [];
  const entries: { date: Date; hours: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const hours = dayHours[i];
    if (typeof hours !== "number" || !Number.isFinite(hours) || hours <= 0) continue;
    const date = new Date(monday);
    date.setDate(date.getDate() + i);
    date.setHours(0, 0, 0, 0);
    entries.push({ date, hours });
  }
  return entries;
}

function totalsOf(rows: GateReviewRow[]): GateReviewTotals {
  return rows.reduce<GateReviewTotals>(
    (acc, r) => ({
      count: acc.count + 1,
      hours: round2(acc.hours + (r.totalHours ?? 0)),
      charge: round2(acc.charge + r.charge),
      cost: round2(acc.cost + r.cost),
      margin: round2(acc.margin + r.margin),
    }),
    { count: 0, hours: 0, charge: 0, cost: 0, margin: 0 },
  );
}

const EMPTY_TOTALS: GateReviewTotals = { count: 0, hours: 0, charge: 0, cost: 0, margin: 0 };

/**
 * Beoordeel alle openstaande (uitgelezen) inbox-weekstaten met de auto-gate en
 * geef ze gesplitst terug: eerst wat een mens moet nakijken, daarna wat vanzelf
 * door mag. Puur lezend — er wordt niets goedgekeurd of verstuurd.
 */
export async function timesheetGateReview(
  options: { historyWeeks?: number } = {},
): Promise<TimesheetGateReview> {
  const historyWeeks = options.historyWeeks ?? GATE_HISTORY_WEEKS;

  const [items, notExtracted] = await Promise.all([
    db.timesheetInbox.findMany({
      // Nog niet omgezet naar een echte urenstaat (timesheetId leeg).
      where: { status: PENDING_STATUS, timesheetId: null },
      include: {
        consultant: { select: { id: true, firstName: true, lastName: true } },
        placement: { include: { client: { select: { companyName: true } } } },
      },
      orderBy: [{ extractedWeekStart: "desc" }, { createdAt: "desc" }],
    }),
    db.timesheetInbox.count({ where: { status: "NEW" } }),
  ]);

  if (items.length === 0) {
    return {
      needsReview: [],
      autoApprove: [],
      totals: { needsReview: EMPTY_TOTALS, autoApprove: EMPTY_TOTALS },
      notExtracted,
    };
  }

  const consultantIds = [...new Set(items.map((i) => i.consultantId).filter((id): id is string => !!id))];

  // Terugkijkgrens: vanaf de oudste week op de lijst, ruim genomen (zie factor).
  const weekTimes = items
    .map((i) => i.extractedWeekStart?.getTime())
    .filter((t): t is number => typeof t === "number" && Number.isFinite(t));
  const oldest = weekTimes.length > 0 ? Math.min(...weekTimes) : Date.now();
  const cutoff = new Date(oldest - historyWeeks * HISTORY_LOOKBACK_FACTOR * WEEK_MS);

  // Dubbele weekstaat? Alleen de (plaatsing, week)-combinaties die hier spelen.
  const duplicateKeys = items
    .filter((i) => i.placementId && i.extractedWeekStart)
    .map((i) => ({ placementId: i.placementId!, weekStart: i.extractedWeekStart! }));

  const [activePlacements, history, duplicates] = await Promise.all([
    consultantIds.length > 0
      ? db.placement.findMany({
          where: { status: "ACTIVE", consultantId: { in: consultantIds } },
          select: { id: true, consultantId: true },
        })
      : Promise.resolve([]),
    consultantIds.length > 0
      ? db.timesheet.findMany({
          where: { placement: { consultantId: { in: consultantIds } }, weekStart: { gte: cutoff } },
          select: {
            weekStart: true,
            placement: { select: { consultantId: true } },
            entries: { select: { hours: true } },
          },
        })
      : Promise.resolve([]),
    duplicateKeys.length > 0
      ? db.timesheet.findMany({
          where: { OR: duplicateKeys },
          select: { placementId: true, weekStart: true },
        })
      : Promise.resolve([]),
  ]);

  const placementCount = new Map<string, number>();
  for (const p of activePlacements) {
    placementCount.set(p.consultantId, (placementCount.get(p.consultantId) ?? 0) + 1);
  }

  // Weektotalen per medewerker — dezelfde optelling als de urenstaat zelf.
  const weeklyByConsultant = new Map<string, WeeklyTotal[]>();
  for (const t of history) {
    const cid = t.placement.consultantId;
    const rows = weeklyByConsultant.get(cid) ?? [];
    rows.push({ weekStart: t.weekStart, hours: round2(t.entries.reduce((s, e) => s + e.hours, 0)) });
    weeklyByConsultant.set(cid, rows);
  }

  const duplicateSet = new Set(duplicates.map((t) => `${t.placementId}|${t.weekStart.getTime()}`));

  const rows: GateReviewRow[] = items.map((item) => {
    const monday = item.extractedWeekStart ? new Date(item.extractedWeekStart) : null;
    const dayHours = prefillDays(item.extractedJson, monday);
    const entries = toEntries(dayHours, monday);
    const placement = item.placement;

    const { recentAvgHours, recentWeeks } = summarizeRecentWeeks(
      item.consultantId ? (weeklyByConsultant.get(item.consultantId) ?? []) : [],
      { before: monday, limit: historyWeeks },
    );

    const duplicateExists =
      !!item.placementId &&
      !!monday &&
      duplicateSet.has(`${item.placementId}|${monday.getTime()}`);

    const gate = evaluateTimesheetGate({
      confidence: item.confidence,
      placementId: item.placementId,
      matchedPlacementCount: item.consultantId ? (placementCount.get(item.consultantId) ?? 0) : 0,
      totalHours: item.extractedTotalHours,
      recentAvgHours,
      recentWeeks,
      duplicateExists,
      chargeRate: placement?.chargeRate ?? null,
      costRate: placement?.costRate ?? null,
    });

    // Bedragen exact zoals /verwerken ze rekent (toeslagen + km meegenomen).
    const money = placement
      ? computeTimesheetMoney(
          {
            entries,
            overtimeHours: item.extractedOvertimeHours,
            kilometers: item.extractedKilometers,
          },
          placement,
        )
      : null;

    return {
      id: item.id,
      decision: gate.decision,
      reasons: gate.reasons,
      flags: gate.flags,
      aiFlags: parseAiFlags(item.reviewFlags),

      name: item.consultant
        ? `${item.consultant.firstName} ${item.consultant.lastName}`
        : (item.extractedName ?? item.originalName),
      originalName: item.originalName,
      source: item.source,
      confidence: item.confidence,
      aiNotes: item.aiNotes,

      weekStart: monday,
      weekLabel: monday ? formatWeekLabel(monday) : null,
      totalHours: item.extractedTotalHours,
      overtimeHours: item.extractedOvertimeHours,
      kilometers: item.extractedKilometers,
      dayHours,

      consultantId: item.consultantId,
      placementId: item.placementId,
      placementTitle: placement?.title ?? null,
      clientName: placement?.client?.companyName ?? null,
      chargeRate: placement?.chargeRate ?? null,
      costRate: placement?.costRate ?? null,

      matchedPlacementCount: item.consultantId
        ? (placementCount.get(item.consultantId) ?? 0)
        : 0,
      recentAvgHours,
      recentWeeks,
      duplicateExists,

      charge: money?.sell.total ?? 0,
      cost: money?.buy.total ?? 0,
      margin: money?.margin ?? 0,

      canApprove: !!item.placementId && !!monday && entries.length > 0,
    };
  });

  const hasError = (r: GateReviewRow) => r.flags.some((f) => f.level === "error");
  const byWeekThenName = (a: GateReviewRow, b: GateReviewRow) =>
    (b.weekStart?.getTime() ?? 0) - (a.weekStart?.getTime() ?? 0) ||
    a.name.localeCompare(b.name, "nl");

  // Harde fouten eerst: die kosten de meeste aandacht.
  const needsReview = rows
    .filter((r) => r.decision === "NEEDS_REVIEW")
    .sort((a, b) => Number(hasError(b)) - Number(hasError(a)) || byWeekThenName(a, b));
  const autoApprove = rows.filter((r) => r.decision === "AUTO_APPROVE").sort(byWeekThenName);

  return {
    needsReview,
    autoApprove,
    totals: { needsReview: totalsOf(needsReview), autoApprove: totalsOf(autoApprove) },
    notExtracted,
  };
}
