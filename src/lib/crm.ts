import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";
import { currentUser } from "./session";
import {
  DEFAULT_CRM_STAGES,
  labelFor,
  DEAL_SOURCES,
  type BadgeColor,
} from "./domain";

// ---------------------------------------------------------------------------
// The CRM "brain": everything the recruitment-CRM pages share. Recruiter
// resolution (who am I acting as), per-recruiter settings, the Kanban board
// data, the everything-log (CrmNote) writer, the follow-up queue, and the
// weak-points analytics that feed the terugkoppeling.
// ---------------------------------------------------------------------------

export type Recruiter = { id: string; name: string; jobTitle: string | null; role: string };

/** Active app-users, usable as recruiters (owners of deals/contacts/notes). */
export async function getRecruiters(): Promise<Recruiter[]> {
  const users = await db.appUser.findMany({
    where: { active: true },
    orderBy: [{ name: "asc" }],
    select: { id: true, name: true, jobTitle: true, role: true },
  });
  return users;
}

/**
 * Wie is de recruiter voor deze request? Altijd de INGELOGDE gebruiker — je eigen
 * account. Er is geen "acting as"-schakelaar meer: alles wat je doet hangt aan je
 * eigen account en wordt in de gedeelde database bewaard (dus zichtbaar voor de
 * andere accounts). Staat inloggen (nog) uit, dan valt 't terug op de eerste
 * actieve gebruiker zodat de app zonder login blijft werken.
 */
export async function currentRecruiterId(): Promise<string | null> {
  const user = await currentUser();
  if (user) return user.id;

  const first = await db.appUser.findFirst({
    where: { active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  return first?.id ?? null;
}

export async function currentRecruiter(): Promise<Recruiter | null> {
  const id = await currentRecruiterId();
  if (!id) return null;
  const u = await db.appUser.findUnique({
    where: { id },
    select: { id: true, name: true, jobTitle: true, role: true },
  });
  return u;
}

// --- Per-recruiter settings -------------------------------------------------

export type EffectiveCrmSettings = {
  userId: string | null;
  defaultScope: "mine" | "all";
  /** Stage keys the recruiter wants visible, or null for "all". */
  visibleStages: string[] | null;
  targetDealsPerMonth: number;
  targetPlacementsPerMonth: number;
  targetRevenuePerMonth: number;
  staleAfterDays: number;
  accent: string;
};

export const DEFAULT_CRM_SETTINGS: Omit<EffectiveCrmSettings, "userId"> = {
  defaultScope: "mine",
  visibleStages: null,
  targetDealsPerMonth: 0,
  targetPlacementsPerMonth: 0,
  targetRevenuePerMonth: 0,
  staleAfterDays: 14,
  accent: "brand",
};

function parseStageKeys(json: string | null): string[] | null {
  if (!json) return null;
  try {
    const arr = JSON.parse(json);
    if (Array.isArray(arr) && arr.every((x) => typeof x === "string") && arr.length) {
      return arr as string[];
    }
    return null;
  } catch {
    return null;
  }
}

/** Effective settings for a recruiter (their saved row, or sane defaults). */
export async function getCrmSettings(userId: string | null): Promise<EffectiveCrmSettings> {
  if (!userId) return { userId: null, ...DEFAULT_CRM_SETTINGS };
  const row = await db.crmSettings.findUnique({ where: { userId } });
  if (!row) return { userId, ...DEFAULT_CRM_SETTINGS };
  return {
    userId,
    defaultScope: row.defaultScope === "all" ? "all" : "mine",
    visibleStages: parseStageKeys(row.visibleStagesJson),
    targetDealsPerMonth: row.targetDealsPerMonth,
    targetPlacementsPerMonth: row.targetPlacementsPerMonth,
    targetRevenuePerMonth: row.targetRevenuePerMonth,
    staleAfterDays: row.staleAfterDays > 0 ? row.staleAfterDays : 14,
    accent: row.accent || "brand",
  };
}

// --- Pipeline stages --------------------------------------------------------

export type Stage = {
  id: string;
  key: string;
  name: string;
  color: BadgeColor;
  order: number;
  probability: number;
  isWon: boolean;
  isLost: boolean;
};

/** Seed the default pipeline the first time the CRM is used (idempotent). */
export async function ensureStages(): Promise<void> {
  const count = await db.crmStage.count();
  if (count > 0) return;
  for (const s of DEFAULT_CRM_STAGES) {
    await db.crmStage.create({
      data: {
        key: s.key,
        name: s.name,
        color: s.color,
        order: s.order,
        probability: s.probability,
        isWon: s.isWon ?? false,
        isLost: s.isLost ?? false,
      },
    });
  }
}

/** Active stages in board order (auto-seeds defaults on first use). */
export async function getStages(): Promise<Stage[]> {
  await ensureStages();
  const rows = await db.crmStage.findMany({
    where: { active: true },
    orderBy: [{ order: "asc" }, { createdAt: "asc" }],
  });
  return rows.map((r) => ({
    id: r.id,
    key: r.key,
    name: r.name,
    color: (r.color as BadgeColor) ?? "slate",
    order: r.order,
    probability: r.probability,
    isWon: r.isWon,
    isLost: r.isLost,
  }));
}

// --- The everything-log (CrmNote) ------------------------------------------

export type LogNoteInput = {
  body: string;
  type?: string;
  dealId?: string | null;
  contactId?: string | null;
  candidateId?: string | null;
  authorId?: string | null;
  sentiment?: string | null;
  followUpAt?: Date | null;
  pinned?: boolean;
};

/** Append one entry to the CRM notitieblok. The heart of "bewaar alles". */
export async function logNote(input: LogNoteInput) {
  return db.crmNote.create({
    data: {
      type: input.type ?? "NOTE",
      body: input.body,
      dealId: input.dealId ?? null,
      contactId: input.contactId ?? null,
      candidateId: input.candidateId ?? null,
      authorId: input.authorId ?? null,
      sentiment: input.sentiment ?? null,
      followUpAt: input.followUpAt ?? null,
      pinned: input.pinned ?? false,
    },
  });
}

// --- Board data -------------------------------------------------------------

export type BoardCard = {
  id: string;
  columnId: string;
  title: string;
  company: string;
  discipline: string | null;
  value: number;
  positions: number;
  fitScore: number;
  status: string;
  ownerId: string | null;
  ownerName: string | null;
  nextFollowUpAt: Date | null;
  lastActivityAt: Date | null;
  noteCount: number;
};

export type BoardData = {
  stages: Stage[];
  cards: BoardCard[];
  totalValue: number;
};

function scopeWhere(recruiterId: string | null, scope: "mine" | "all"): Prisma.DealWhereInput {
  return scope === "mine" && recruiterId ? { ownerId: recruiterId } : {};
}

/** Assemble the Kanban board (columns from stages, cards from deals in scope). */
export async function getBoardData(opts: {
  recruiterId: string | null;
  scope: "mine" | "all";
  visibleStages?: string[] | null;
}): Promise<BoardData> {
  const all = await getStages();
  const stages =
    opts.visibleStages && opts.visibleStages.length
      ? all.filter((s) => opts.visibleStages!.includes(s.key))
      : all;
  const visibleIds = new Set(stages.map((s) => s.id));

  const deals = await db.deal.findMany({
    where: scopeWhere(opts.recruiterId, opts.scope),
    include: {
      owner: { select: { name: true } },
      crmNotes: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
      _count: { select: { crmNotes: true } },
    },
    orderBy: [{ fitScore: "desc" }, { updatedAt: "desc" }],
  });

  const cards: BoardCard[] = deals
    .filter((d) => visibleIds.has(d.stageId))
    .map((d) => ({
      id: d.id,
      columnId: d.stageId,
      title: d.title,
      company: d.company,
      discipline: d.discipline,
      value: d.value,
      positions: d.positions,
      fitScore: d.fitScore,
      status: d.status,
      ownerId: d.ownerId,
      ownerName: d.owner?.name ?? null,
      nextFollowUpAt: d.nextFollowUpAt,
      lastActivityAt: d.crmNotes[0]?.createdAt ?? null,
      noteCount: d._count.crmNotes,
    }));

  const totalValue = cards
    .filter((c) => c.status === "OPEN")
    .reduce((s, c) => s + c.value, 0);

  return { stages, cards, totalValue };
}

// --- Follow-up queue (Plan Follow-up) --------------------------------------

export type FollowUpItem = {
  id: string;
  /** The underlying deal id or note id (for completing it from the planner). */
  rawId: string;
  source: "deal" | "note";
  due: Date;
  title: string;
  subtitle: string | null;
  href: string;
  ownerName: string | null;
};

/** Everything with a pending follow-up date, in scope, sorted soonest-first. */
export async function getFollowUpItems(opts: {
  recruiterId: string | null;
  scope: "mine" | "all";
}): Promise<FollowUpItem[]> {
  const dealScope = scopeWhere(opts.recruiterId, opts.scope);

  const deals = await db.deal.findMany({
    where: { ...dealScope, status: "OPEN", nextFollowUpAt: { not: null } },
    include: { owner: { select: { name: true } } },
    orderBy: { nextFollowUpAt: "asc" },
  });

  // Deal follow-ups live on the deal (nextFollowUpAt); note follow-ups are for
  // contacts/candidates (no deal) so the two sources never double-count.
  const noteScope: Prisma.CrmNoteWhereInput =
    opts.scope === "mine" && opts.recruiterId ? { authorId: opts.recruiterId } : {};
  const notes = await db.crmNote.findMany({
    where: { ...noteScope, dealId: null, followUpAt: { not: null }, followUpDone: false },
    include: {
      contact: true,
      candidate: true,
    },
    orderBy: { followUpAt: "asc" },
  });

  const items: FollowUpItem[] = [];

  for (const d of deals) {
    items.push({
      id: `deal-${d.id}`,
      rawId: d.id,
      source: "deal",
      due: d.nextFollowUpAt!,
      title: d.title,
      subtitle: d.company,
      href: `/crm/deals/${d.id}`,
      ownerName: d.owner?.name ?? null,
    });
  }
  for (const n of notes) {
    const href = n.contactId
      ? `/crm/contacten/${n.contactId}`
      : n.candidateId
        ? `/kandidaten/${n.candidateId}`
        : "/crm/opvolging";
    const subtitle =
      n.contact?.company ??
      (n.contact ? `${n.contact.firstName} ${n.contact.lastName ?? ""}`.trim() : null) ??
      (n.candidate ? `${n.candidate.firstName} ${n.candidate.lastName}` : null);
    items.push({
      id: `note-${n.id}`,
      rawId: n.id,
      source: "note",
      due: n.followUpAt!,
      title: n.body.length > 80 ? `${n.body.slice(0, 80)}…` : n.body,
      subtitle,
      href,
      ownerName: null,
    });
  }

  items.sort((a, b) => a.due.getTime() - b.due.getTime());
  return items;
}

/** Count of follow-ups that are due today or overdue (for nav badge / stats). */
export async function countDueFollowUps(recruiterId: string | null, scope: "mine" | "all"): Promise<number> {
  const items = await getFollowUpItems({ recruiterId, scope });
  const end = endOfToday();
  return items.filter((i) => i.due.getTime() <= end.getTime()).length;
}

// --- Insights / weak-points -------------------------------------------------

export type FunnelStage = {
  key: string;
  name: string;
  color: BadgeColor;
  count: number;
  value: number;
  stalled: number;
  avgAgeDays: number;
};

export type WeakPoint = {
  severity: "high" | "medium" | "low";
  title: string;
  detail: string;
};

export type CrmInsights = {
  totalOpen: number;
  totalOpenValue: number;
  weightedValue: number;
  wonCount: number;
  lostCount: number;
  winRate: number | null;
  avgDealAgeDays: number;
  staleCount: number;
  overdueFollowUps: number;
  noContactCount: number;
  funnel: FunnelStage[];
  biggestDrop: { fromName: string; toName: string; dropPct: number } | null;
  lostReasons: { reason: string; count: number }[];
  sentiment: { positive: number; neutral: number; negative: number };
  activityByType: { type: string; count: number }[];
  leaderboard: {
    ownerId: string;
    name: string;
    open: number;
    won: number;
    lost: number;
    wonValue: number;
    winRate: number | null;
  }[];
  weakPoints: WeakPoint[];
};

const DAY = 1000 * 60 * 60 * 24;

export function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
export function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}
function daysBetween(a: Date, b: Date): number {
  return Math.max(0, Math.round((a.getTime() - b.getTime()) / DAY));
}

/** Compute the CRM dashboard + weak-points ("waar liggen de zwakke punten"). */
export async function getInsights(opts: {
  recruiterId: string | null;
  scope: "mine" | "all";
  staleAfterDays: number;
}): Promise<CrmInsights> {
  const dealScope = scopeWhere(opts.recruiterId, opts.scope);
  const stages = await getStages();
  const now = new Date();
  const staleCutoff = new Date(now.getTime() - opts.staleAfterDays * DAY);

  const deals = await db.deal.findMany({
    where: dealScope,
    include: {
      owner: { select: { id: true, name: true } },
      _count: { select: { crmNotes: true } },
      crmNotes: { select: { createdAt: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  const open = deals.filter((d) => d.status === "OPEN");
  const won = deals.filter((d) => d.status === "WON");
  const lost = deals.filter((d) => d.status === "LOST");

  const totalOpenValue = open.reduce((s, d) => s + d.value, 0);
  const weightedValue = open.reduce((s, d) => s + (d.value * d.probability) / 100, 0);

  // Funnel over the OPEN pipeline (non-closing stages), per stage.
  const openStages = stages.filter((s) => !s.isWon && !s.isLost);
  const funnel: FunnelStage[] = openStages.map((s) => {
    const inStage = open.filter((d) => d.stageId === s.id);
    const stalled = inStage.filter((d) => {
      const last = d.crmNotes[0]?.createdAt ?? d.createdAt;
      return last.getTime() < staleCutoff.getTime();
    }).length;
    const avgAgeDays = inStage.length
      ? Math.round(inStage.reduce((sum, d) => sum + daysBetween(now, d.createdAt), 0) / inStage.length)
      : 0;
    return {
      key: s.key,
      name: s.name,
      color: s.color,
      count: inStage.length,
      value: inStage.reduce((sum, d) => sum + d.value, 0),
      stalled,
      avgAgeDays,
    };
  });

  // Biggest stage-to-stage drop in the open funnel (the pipeline "leak").
  let biggestDrop: CrmInsights["biggestDrop"] = null;
  for (let i = 0; i < funnel.length - 1; i++) {
    const from = funnel[i];
    const to = funnel[i + 1];
    if (from.count >= 3 && from.count > to.count) {
      const dropPct = Math.round(((from.count - to.count) / from.count) * 100);
      if (!biggestDrop || dropPct > biggestDrop.dropPct) {
        biggestDrop = { fromName: from.name, toName: to.name, dropPct };
      }
    }
  }

  const staleCount = funnel.reduce((s, f) => s + f.stalled, 0);
  const noContactCount = open.filter((d) => d._count.crmNotes === 0).length;
  const avgDealAgeDays = open.length
    ? Math.round(open.reduce((s, d) => s + daysBetween(now, d.createdAt), 0) / open.length)
    : 0;

  const closed = won.length + lost.length;
  const winRate = closed > 0 ? Math.round((won.length / closed) * 100) : null;

  // Lost reasons.
  const lostMap = new Map<string, number>();
  for (const d of lost) {
    const r = (d.lostReason ?? "").trim() || "Onbekend";
    lostMap.set(r, (lostMap.get(r) ?? 0) + 1);
  }
  const lostReasons = [...lostMap.entries()]
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Overdue follow-ups (reuse the queue).
  const overdueFollowUps = await countDueFollowUps(opts.recruiterId, opts.scope);

  // Sentiment of recent relationship notes (last 90 days).
  const since90 = new Date(now.getTime() - 90 * DAY);
  const noteScope: Prisma.CrmNoteWhereInput =
    opts.scope === "mine" && opts.recruiterId
      ? { OR: [{ deal: { ownerId: opts.recruiterId } }, { authorId: opts.recruiterId }] }
      : {};
  const sentimentRows = await db.crmNote.groupBy({
    by: ["sentiment"],
    where: { ...noteScope, createdAt: { gte: since90 }, sentiment: { not: null } },
    _count: true,
  });
  const sentiment = { positive: 0, neutral: 0, negative: 0 };
  for (const r of sentimentRows) {
    if (r.sentiment === "POSITIVE") sentiment.positive = r._count;
    else if (r.sentiment === "NEGATIVE") sentiment.negative = r._count;
    else if (r.sentiment === "NEUTRAL") sentiment.neutral = r._count;
  }

  // Activity volume by type (last 30 days).
  const since30 = new Date(now.getTime() - 30 * DAY);
  const activityRows = await db.crmNote.groupBy({
    by: ["type"],
    where: { ...noteScope, createdAt: { gte: since30 } },
    _count: true,
  });
  const activityByType = activityRows
    .map((r) => ({ type: r.type, count: r._count }))
    .sort((a, b) => b.count - a.count);

  // Per-recruiter leaderboard (meaningful for the team scope).
  const byOwner = new Map<
    string,
    { name: string; open: number; won: number; lost: number; wonValue: number }
  >();
  for (const d of deals) {
    if (!d.ownerId) continue;
    const cur =
      byOwner.get(d.ownerId) ??
      { name: d.owner?.name ?? "—", open: 0, won: 0, lost: 0, wonValue: 0 };
    if (d.status === "OPEN") cur.open++;
    else if (d.status === "WON") {
      cur.won++;
      cur.wonValue += d.value;
    } else if (d.status === "LOST") cur.lost++;
    byOwner.set(d.ownerId, cur);
  }
  const leaderboard = [...byOwner.entries()]
    .map(([ownerId, v]) => {
      const c = v.won + v.lost;
      return {
        ownerId,
        name: v.name,
        open: v.open,
        won: v.won,
        lost: v.lost,
        wonValue: v.wonValue,
        winRate: c > 0 ? Math.round((v.won / c) * 100) : null,
      };
    })
    .sort((a, b) => b.wonValue - a.wonValue || b.won - a.won);

  // Derive the weak-points list (the terugkoppeling).
  const weakPoints: WeakPoint[] = [];
  if (overdueFollowUps > 0) {
    weakPoints.push({
      severity: overdueFollowUps >= 5 ? "high" : "medium",
      title: `${overdueFollowUps} openstaande opvolging${overdueFollowUps === 1 ? "" : "en"} over tijd`,
      detail: "Deals zonder tijdige opvolging koelen af. Plan of voltooi ze in de Opvolging-lijst.",
    });
  }
  if (staleCount > 0) {
    const worst = [...funnel].sort((a, b) => b.stalled - a.stalled)[0];
    weakPoints.push({
      severity: staleCount >= 5 ? "high" : "medium",
      title: `${staleCount} vastgelopen deal${staleCount === 1 ? "" : "s"} (geen activiteit > ${opts.staleAfterDays} dagen)`,
      detail: worst && worst.stalled > 0
        ? `De meeste blijven hangen in "${worst.name}". Pak deze fase als eerste aan.`
        : "Log een actie of verplaats ze naar de juiste fase.",
    });
  }
  if (biggestDrop && biggestDrop.dropPct >= 40) {
    weakPoints.push({
      severity: biggestDrop.dropPct >= 60 ? "high" : "medium",
      title: `Grote uitval tussen "${biggestDrop.fromName}" en "${biggestDrop.toName}" (${biggestDrop.dropPct}%)`,
      detail: "Hier lekt de pipeline het hardst — onderzoek waarom deals deze stap niet halen.",
    });
  }
  if (noContactCount > 0) {
    weakPoints.push({
      severity: noContactCount >= 5 ? "medium" : "low",
      title: `${noContactCount} open deal${noContactCount === 1 ? "" : "s"} zonder één notitie`,
      detail: "Zonder vastgelegd contact is er geen opvolging en geen data om van te leren.",
    });
  }
  if (lostReasons.length && lost.length >= 3) {
    const top = lostReasons[0];
    weakPoints.push({
      severity: "low",
      title: `Meest voorkomende verliesreden: "${top.reason}" (${top.count}×)`,
      detail: "Terugkerende verliesreden — richt hier verbetering op.",
    });
  }
  if (winRate !== null && winRate < 25 && closed >= 4) {
    weakPoints.push({
      severity: "medium",
      title: `Lage winkans (${winRate}%)`,
      detail: "Minder dan 1 op 4 afgesloten deals wordt gewonnen. Kwalificeer strenger aan de voorkant.",
    });
  }
  if (sentiment.negative > 0 && sentiment.negative >= sentiment.positive) {
    weakPoints.push({
      severity: "medium",
      title: `Relatiegevoel onder druk (${sentiment.negative} negatief vs ${sentiment.positive} positief)`,
      detail: "Recente gesprekken voelen overwegend negatief. Investeer in de relatie.",
    });
  }

  return {
    totalOpen: open.length,
    totalOpenValue,
    weightedValue,
    wonCount: won.length,
    lostCount: lost.length,
    winRate,
    avgDealAgeDays,
    staleCount,
    overdueFollowUps,
    noContactCount,
    funnel,
    biggestDrop,
    lostReasons,
    sentiment,
    activityByType,
    leaderboard,
    weakPoints,
  };
}

/** Short one-line description of a deal's source, for cards. */
export function dealSourceLabel(source: string): string {
  return labelFor(DEAL_SOURCES, source);
}
