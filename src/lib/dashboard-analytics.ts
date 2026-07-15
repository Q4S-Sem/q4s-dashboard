import { db } from "./db";
import { round2 } from "./utils";
import {
  type Option,
  type BadgeColor,
  BADGE_HEX,
  DISCIPLINES,
  EMPLOYMENT_TYPES,
  CANDIDATE_SOURCES,
  CANDIDATE_AVAILABILITY,
  CANDIDATE_AVAILABLE_VALUES,
  EXPENSE_CATEGORIES,
  DEAL_STATUSES,
  RECEIVED_INVOICE_STATUSES,
} from "./domain";

// ---------------------------------------------------------------------------
// Samenstelling/verdeling + risico-analyses voor het dashboard: de
// cirkeldiagrammen (pie/donut) én de aanvullende analyses die een detacherings-/
// recruitmentbedrijf nodig heeft om "niets te missen". Eén lib met parallelle
// queries. Bedragen zijn ex btw waar het omzet betreft, incl btw waar het
// verplichtingen betreft (declaraties, ontvangen facturen, openstaand). Per veld
// staat aangegeven of het PERIODE-gescoped is of een HUIDIGE STAND (snapshot).
// ---------------------------------------------------------------------------

export type Slice = { name: string; value: number; color: string };
export type Bar = { label: string; value: number; count?: number };
export type StageBar = { name: string; value: number; weighted: number; color: BadgeColor };

const MONTH_FMT = new Intl.DateTimeFormat("nl-NL", { month: "short" });
const DAYMONTH_FMT = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" });
const DAY_MS = 86_400_000;

/** Groepeer een tellingen-map naar gekleurde slices volgens een option-set.
 *  Onbekende waarden vallen in de OVERIG/ONBEKEND-optie, of anders in een losse
 *  grijze "Overig"-slice. Alleen slices > 0 blijven over. */
function slicesFor(options: Option[], counts: Map<string, number>): Slice[] {
  const known = new Set(options.map((o) => o.value));
  const fallback = options.find((o) => o.value === "OVERIG" || o.value === "ONBEKEND");
  let extra = 0;
  for (const [k, v] of counts) if (!known.has(k)) extra += v;

  const slices: Slice[] = [];
  for (const o of options) {
    let v = counts.get(o.value) ?? 0;
    if (extra > 0 && fallback && o.value === fallback.value) v += extra;
    if (v > 0) slices.push({ name: o.label, value: round2(v), color: BADGE_HEX[o.color ?? "slate"] });
  }
  if (extra > 0 && !fallback) slices.push({ name: "Overig", value: round2(extra), color: BADGE_HEX.slate });
  return slices;
}

function add(map: Map<string, number>, key: string, amount: number) {
  map.set(key, (map.get(key) ?? 0) + amount);
}

function monthStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

/** Maandbuckets (label + count) vanaf `now` tot `now + months` maanden, gevuld
 *  door `dates` op hun maand te tellen. Lege maanden blijven staan (0). */
function monthlyBuckets(now: Date, months: number, dates: Date[]): Bar[] {
  const buckets: { key: string; label: string; value: number }[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: MONTH_FMT.format(d), value: 0 });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const dt of dates) {
    const m = monthStart(dt);
    const b = byKey.get(`${m.getFullYear()}-${m.getMonth()}`);
    if (b) b.value += 1;
  }
  return buckets.map((b) => ({ label: b.label, value: b.value, count: b.value }));
}

export type AgingBucket = { label: string; amount: number; count: number };

export type DashboardComposition = {
  // Omzet-mix (periode, op verkoopfacturen ex btw)
  omzetPerDiscipline: Slice[];
  omzetPerDienstverband: Slice[];
  omzetTotaal: number; // som van de facturen-omzet (voor labeling/consistentiecheck)
  // Kosten (periode)
  declaratiesPerCategorie: Slice[];
  // Bezetting & levering
  utilization: Slice[]; // huidige stand
  bezettingPct: number; // huidige stand
  benchCount: number;
  plaatsingenPerDienstverband: Slice[]; // huidige stand (actieve plaatsingen)
  urenTrend: Bar[]; // periode, per week
  // Debiteuren & cash (huidige stand)
  invoiceAging: AgingBucket[];
  dso: number | null; // periode (betaald in periode); null = geen data
  ontvangenStatus: Slice[]; // huidige stand, op bedrag
  // Risico: aflopend & compliance (vooruitkijkend 90 dagen)
  aflopendePlaatsingen: Bar[];
  aflopendePlaatsingen30: number;
  verlopendeCertificaten: Bar[];
  verlopendeCertificaten30: number;
  // Recruitment
  kandidatenPerBron: Slice[]; // periode (instroom)
  talentpoolBeschikbaarheid: Slice[]; // huidige stand
  talentpoolInzetbaar: number;
  // Sales / CRM
  winVerlies: Slice[]; // WON/LOST in periode + OPEN huidig
  winratePct: number | null;
  pipelineWaarde: StageBar[]; // huidige stand, open deals per fase
};

export async function dashboardComposition(
  { start, end }: { start: Date; end: Date },
  now: Date,
): Promise<DashboardComposition> {
  const in30 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 30);
  const in90 = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 90);
  // Aantal kalendermaanden dat het 90-dagen-venster raakt (3 óf 4, afhankelijk van
  // de dag in de maand). Zo verdwijnt niets uit de query-set uit de maandbars.
  const lastDayIn90 = new Date(in90.getTime() - DAY_MS);
  const riskMonths = Math.max(
    1,
    (lastDayIn90.getFullYear() - now.getFullYear()) * 12 + (lastDayIn90.getMonth() - now.getMonth()) + 1,
  );

  const [
    invoiceLines,
    expenses,
    activeConsultants,
    activePlacements,
    timesheets,
    sentInvoices,
    paidInvoices,
    receivedByStatus,
    endingPlacements,
    expiringCerts,
    candBySource,
    candByAvailability,
    dealWon,
    dealLost,
    dealOpen,
    openDeals,
  ] = await Promise.all([
    // Omzet-mix: verkoopfactuurregels van niet-geannuleerde facturen met issueDate
    // in de periode, gekoppeld aan de werknemer (discipline + dienstverband).
    db.invoiceLine.findMany({
      where: { invoice: { status: { not: "CANCELLED" }, issueDate: { gte: start, lt: end } } },
      select: {
        amount: true,
        placement: { select: { consultant: { select: { discipline: true, employmentType: true } } } },
      },
    }),
    // Declaraties: goedgekeurd/uitbetaald, in de periode (zelfde bron als de eigen-
    // kosten in companyCostsThisYear).
    db.expense.findMany({
      where: {
        status: { in: ["APPROVED", "PAID"] },
        OR: [{ date: { gte: start, lt: end } }, { date: null, createdAt: { gte: start, lt: end } }],
      },
      select: { category: true, amount: true },
    }),
    db.consultant.findMany({ where: { active: true }, select: { id: true } }),
    db.placement.findMany({
      where: { status: "ACTIVE" },
      select: { consultantId: true, consultant: { select: { employmentType: true } } },
    }),
    db.timesheet.findMany({
      where: { weekStart: { gte: start, lt: end } },
      select: { weekStart: true, entries: { select: { hours: true } } },
    }),
    db.invoice.findMany({ where: { status: "SENT" }, select: { total: true, dueDate: true } }),
    db.invoice.findMany({
      where: { status: "PAID", paidDate: { gte: start, lt: end } },
      select: { issueDate: true, paidDate: true },
    }),
    db.receivedInvoice.groupBy({ by: ["status"], _sum: { amount: true } }),
    db.placement.findMany({
      where: { status: "ACTIVE", endDate: { gte: now, lt: in90 } },
      select: { endDate: true },
    }),
    db.certificate.findMany({
      where: { expiryDate: { gte: now, lt: in90 } },
      select: { expiryDate: true },
    }),
    db.candidate.groupBy({ by: ["source"], where: { createdAt: { gte: start, lt: end } }, _count: { _all: true } }),
    db.candidate.groupBy({ by: ["availability"], _count: { _all: true } }),
    db.deal.count({ where: { status: "WON", closedAt: { gte: start, lt: end } } }),
    db.deal.count({ where: { status: "LOST", closedAt: { gte: start, lt: end } } }),
    db.deal.count({ where: { status: "OPEN" } }),
    db.deal.findMany({
      where: { status: "OPEN" },
      select: { value: true, probability: true, stage: { select: { name: true, order: true, color: true } } },
    }),
  ]);

  // ---- Omzet per discipline + per dienstverband (zelfde factuurregel-basis) ----
  const omzetByDisc = new Map<string, number>();
  const omzetByEmpl = new Map<string, number>();
  let omzetTotaal = 0;
  for (const l of invoiceLines) {
    const c = l.placement?.consultant;
    omzetTotaal += l.amount;
    add(omzetByDisc, c?.discipline || "OVERIG", l.amount);
    add(omzetByEmpl, c?.employmentType || "OVERIG", l.amount);
  }
  const omzetPerDiscipline = slicesFor(DISCIPLINES, omzetByDisc);
  // employmentType kent geen OVERIG-optie → onbekende regels labelen we los.
  const omzetPerDienstverband = slicesForWithOther(EMPLOYMENT_TYPES, omzetByEmpl, "Onbekend");

  // ---- Declaraties per categorie ----
  const expByCat = new Map<string, number>();
  for (const e of expenses) add(expByCat, e.category || "OVERIG", e.amount);
  const declaratiesPerCategorie = slicesFor(EXPENSE_CATEGORIES, expByCat);

  // ---- Bezetting vs bank (huidige stand) ----
  const placedIds = new Set(activePlacements.map((p) => p.consultantId));
  const activeIds = new Set(activeConsultants.map((c) => c.id));
  let placed = 0;
  for (const id of activeIds) if (placedIds.has(id)) placed += 1;
  const bench = Math.max(0, activeIds.size - placed);
  const bezettingPct = activeIds.size > 0 ? Math.round((placed / activeIds.size) * 100) : 0;
  const utilization: Slice[] = [
    { name: "Op plaatsing", value: placed, color: BADGE_HEX.green },
    { name: "Op de bank", value: bench, color: BADGE_HEX.amber },
  ].filter((s) => s.value > 0);

  // ---- Actieve plaatsingen per dienstverband ----
  const placByEmpl = new Map<string, number>();
  for (const p of activePlacements) add(placByEmpl, p.consultant.employmentType || "OVERIG", 1);
  const plaatsingenPerDienstverband = slicesForWithOther(EMPLOYMENT_TYPES, placByEmpl, "Onbekend");

  // ---- Uren-trend per week (periode) ----
  const urenByWeek = new Map<number, number>();
  for (const t of timesheets) {
    const key = new Date(t.weekStart).getTime();
    const hours = t.entries.reduce((s, e) => s + e.hours, 0);
    urenByWeek.set(key, (urenByWeek.get(key) ?? 0) + hours);
  }
  const urenTrend: Bar[] = [...urenByWeek.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ts, hours]) => ({ label: DAYMONTH_FMT.format(new Date(ts)), value: round2(hours) }));

  // ---- Ouderdom openstaande verkoopfacturen (huidige stand, incl btw) ----
  const agingDefs = ["Nog niet vervallen", "1–30 dagen", "31–60 dagen", "61–90 dagen", "90+ dagen"];
  const invoiceAging: AgingBucket[] = agingDefs.map((label) => ({ label, amount: 0, count: 0 }));
  for (const i of sentInvoices) {
    const daysLate = Math.floor((now.getTime() - new Date(i.dueDate).getTime()) / DAY_MS);
    const idx = daysLate <= 0 ? 0 : daysLate <= 30 ? 1 : daysLate <= 60 ? 2 : daysLate <= 90 ? 3 : 4;
    invoiceAging[idx].amount = round2(invoiceAging[idx].amount + i.total);
    invoiceAging[idx].count += 1;
  }

  // ---- DSO: gemiddelde betaaltermijn (facturen betaald in de periode) ----
  let dso: number | null = null;
  if (paidInvoices.length > 0) {
    const totalDays = paidInvoices.reduce(
      (s, i) => s + Math.max(0, (new Date(i.paidDate!).getTime() - new Date(i.issueDate).getTime()) / DAY_MS),
      0,
    );
    dso = Math.round(totalDays / paidInvoices.length);
  }

  // ---- Ontvangen ZZP-facturen per status (huidige stand, op bedrag) ----
  const recByStatus = new Map(receivedByStatus.map((r) => [r.status, r._sum.amount ?? 0]));
  const ontvangenStatus = slicesFor(RECEIVED_INVOICE_STATUSES, recByStatus);

  // ---- Aflopende plaatsingen + verlopende certificaten (komende 90 dagen) ----
  const aflopendePlaatsingen = monthlyBuckets(
    now,
    riskMonths,
    endingPlacements.map((p) => new Date(p.endDate!)),
  );
  const aflopendePlaatsingen30 = endingPlacements.filter((p) => new Date(p.endDate!) < in30).length;
  const verlopendeCertificaten = monthlyBuckets(
    now,
    riskMonths,
    expiringCerts.map((c) => new Date(c.expiryDate!)),
  );
  const verlopendeCertificaten30 = expiringCerts.filter((c) => new Date(c.expiryDate!) < in30).length;

  // ---- Recruitment ----
  const bySrc = new Map(candBySource.map((r) => [r.source, r._count._all]));
  const kandidatenPerBron = slicesFor(CANDIDATE_SOURCES, bySrc);
  const byAvail = new Map(candByAvailability.map((r) => [r.availability, r._count._all]));
  const talentpoolBeschikbaarheid = slicesFor(CANDIDATE_AVAILABILITY, byAvail);
  const talentpoolInzetbaar = (CANDIDATE_AVAILABLE_VALUES as readonly string[]).reduce(
    (s, v) => s + (byAvail.get(v) ?? 0),
    0,
  );

  // ---- CRM: win/verlies + pipeline-waarde ----
  const winVerlies: Slice[] = DEAL_STATUSES.map((o) => {
    const value = o.value === "WON" ? dealWon : o.value === "LOST" ? dealLost : dealOpen;
    return { name: o.label, value, color: BADGE_HEX[o.color ?? "slate"] };
  }).filter((s) => s.value > 0);
  const closed = dealWon + dealLost;
  const winratePct = closed > 0 ? Math.round((dealWon / closed) * 100) : null;

  const stageMap = new Map<string, StageBar & { order: number }>();
  for (const d of openDeals) {
    if (!d.stage) continue;
    let s = stageMap.get(d.stage.name);
    if (!s) {
      s = { name: d.stage.name, value: 0, weighted: 0, color: (d.stage.color as BadgeColor) ?? "slate", order: d.stage.order };
      stageMap.set(d.stage.name, s);
    }
    s.value = round2(s.value + d.value);
    s.weighted = round2(s.weighted + (d.value * d.probability) / 100);
  }
  const pipelineWaarde: StageBar[] = [...stageMap.values()]
    .sort((a, b) => a.order - b.order)
    .map(({ order: _order, ...s }) => s);

  return {
    omzetPerDiscipline,
    omzetPerDienstverband,
    omzetTotaal: round2(omzetTotaal),
    declaratiesPerCategorie,
    utilization,
    bezettingPct,
    benchCount: bench,
    plaatsingenPerDienstverband,
    urenTrend,
    invoiceAging,
    dso,
    ontvangenStatus,
    aflopendePlaatsingen,
    aflopendePlaatsingen30,
    verlopendeCertificaten,
    verlopendeCertificaten30,
    kandidatenPerBron,
    talentpoolBeschikbaarheid,
    talentpoolInzetbaar,
    winVerlies,
    winratePct,
    pipelineWaarde,
  };
}

/** Als slicesFor, maar voor option-sets zonder OVERIG/ONBEKEND: onbekende
 *  waarden komen in een losse slice met het meegegeven label. */
function slicesForWithOther(options: Option[], counts: Map<string, number>, otherLabel: string): Slice[] {
  const known = new Set(options.map((o) => o.value));
  const slices: Slice[] = [];
  for (const o of options) {
    const v = counts.get(o.value) ?? 0;
    if (v > 0) slices.push({ name: o.label, value: round2(v), color: BADGE_HEX[o.color ?? "slate"] });
  }
  let extra = 0;
  for (const [k, v] of counts) if (!known.has(k)) extra += v;
  if (extra > 0) slices.push({ name: otherLabel, value: round2(extra), color: BADGE_HEX.slate });
  return slices;
}
