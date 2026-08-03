import Link from "next/link";
import {
  Wallet,
  TrendingUp,
  Coins,
  Briefcase,
  HardHat,
  ArrowRight,
  Banknote,
  Percent,
  AlertTriangle,
  Receipt,
  Sparkles,
  ClipboardList,
  Award,
  ClipboardCheck,
  Globe,
  ListChecks,
  ChevronRight,
  ChevronLeft,
  Star,
  Users,
  Building2,
  Layers,
  Timer,
  CalendarClock,
  UserCheck,
  Trophy,
  Target,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { cn, formatCurrency, round2 } from "@/lib/utils";
import {
  INVOICE_STATUSES,
  APPLICATION_STATUSES,
  QUARTERS,
  colorFor,
} from "@/lib/domain";
import { averageOfScores, parseJsonMap } from "@/lib/evaluation-forms";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import { DashboardChart } from "./DashboardChart";
import { DashboardPie } from "./DashboardPie";
import { DashboardLine } from "./DashboardLine";
import { KpiTile, SectionHeading, HubTile, MiniBar, ResultRow, type DashColor } from "./_kpi";
import { invoicingOverview, pendingWorkByConsultant, companyCostsThisYear } from "@/lib/facturatie";
import { dashboardComposition } from "@/lib/dashboard-analytics";
import type { ReactNode } from "react";

export const metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

const monthFmt = new Intl.DateTimeFormat("nl-NL", { month: "short" });

function effectiveStatus(status: string, dueDate: Date, now: Date) {
  if (status === "SENT" && dueDate < now) return "OVERDUE";
  return status;
}
function quarterOf(d: Date) {
  return Math.floor(d.getMonth() / 3) + 1;
}

/** Domein-badgekleur → dashboard-kleur voor de gekleurde bars. */
const BADGE_TO_DASH: Record<string, DashColor> = {
  blue: "blue",
  green: "emerald",
  amber: "amber",
  violet: "violet",
  red: "rose",
  cyan: "cyan",
  slate: "slate",
};

/** Kaart met een kop (icoon + titel + optionele actie) en een chart eronder. */
function ChartCard({
  title,
  icon,
  iconColor = "text-slate-500",
  action,
  note,
  children,
}: {
  title: string;
  icon: ReactNode;
  iconColor?: string;
  action?: ReactNode;
  note?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <span className={cn("shrink-0", iconColor)}>{icon}</span>
          {title}
        </CardTitle>
        {action}
      </CardHeader>
      <CardContent>
        {children}
        {note && <div className="mt-3 text-xs text-slate-400">{note}</div>}
      </CardContent>
    </Card>
  );
}

/** Lijst van gekleurde horizontale bars (schaalt op de grootste waarde). */
function BarList({
  rows,
}: {
  rows: { label: string; value: number; color: DashColor; display?: ReactNode }[];
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.every((r) => r.value === 0)) {
    return <p className="py-6 text-center text-sm text-slate-400">Nog geen gegevens.</p>;
  }
  return (
    <div className="space-y-2.5">
      {rows.map((r) => (
        <MiniBar key={r.label} label={r.label} value={r.value} max={max} color={r.color} display={r.display} />
      ))}
    </div>
  );
}

type SP = { q?: string; year?: string };

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const START_YEAR = 2026;
  const maxYear = Math.max(START_YEAR, now.getFullYear());
  let year = sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : now.getFullYear();
  year = Math.min(Math.max(year, START_YEAR), maxYear);

  // Periode = heel jaar ("all") of een kwartaal (1..4). Default = huidig kwartaal.
  const isYear = sp.q === "all";
  const qNum = isYear
    ? null
    : sp.q && /^[1-4]$/.test(sp.q)
      ? Number(sp.q)
      : quarterOf(now);
  const qParam = isYear ? "all" : String(qNum);

  const periodStart = isYear ? new Date(year, 0, 1) : new Date(year, (qNum! - 1) * 3, 1);
  const periodEnd = isYear ? new Date(year + 1, 0, 1) : new Date(year, qNum! * 3, 1);
  const periodLabel = isYear ? `${year}` : `Q${qNum} ${year}`;
  const shortLabel = isYear ? `${year}` : `Q${qNum}`;
  const soon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 60);

  const [
    periodBillable,
    periodPlacements,
    activePlacements,
    consultantsCount,
    clientsCount,
    submittedCount,
    sentInvoices,
    pendingConsultants,
    overview,
    costs,
  ] = await Promise.all([
    db.timesheet.findMany({
      where: { status: { in: ["APPROVED", "INVOICED"] }, weekStart: { gte: periodStart, lt: periodEnd } },
      include: { entries: true, placement: { include: { consultant: { select: { employmentType: true } } } } },
    }),
    // Plaatsingen die de periode overlappen (start vóór einde periode én nog niet
    // geëindigd vóór het begin ervan) — de periode-versie van "actieve plaatsingen".
    db.placement.findMany({
      where: { startDate: { lt: periodEnd }, OR: [{ endDate: null }, { endDate: { gte: periodStart } }] },
      select: { id: true, consultantId: true, clientId: true },
    }),
    db.placement.findMany({ where: { status: "ACTIVE" }, include: { consultant: true, client: true } }),
    db.consultant.count({ where: { active: true } }),
    db.client.count(),
    db.timesheet.count({ where: { status: "SUBMITTED" } }),
    db.invoice.findMany({ where: { status: "SENT" } }),
    pendingWorkByConsultant(),
    invoicingOverview({ start: periodStart, end: periodEnd }),
    companyCostsThisYear({ start: periodStart, end: periodEnd }),
  ]);

  const periodConsultants = new Set(periodPlacements.map((p) => p.consultantId)).size;
  const periodClients = new Set(
    periodPlacements.map((p) => p.clientId).filter((id): id is string => id !== null),
  ).size;

  // ---- Nettowinst: brutomarge (omzet − inkoop) minus onze EIGEN kosten ----
  const brutomarge = overview.marge;
  const nettoWinst = round2(overview.marge - costs.totaal);
  const winstPct = overview.omzet > 0 ? Math.round((nettoWinst / overview.omzet) * 100) : 0;

  const [
    certs,
    openApplications,
    candidatesCount,
    vacPublished,
    vacConcept,
    vacViews,
    expensesNew,
    periodEvals,
    recentInvoices,
    recentApplications,
    applicationsByStatus,
  ] = await Promise.all([
    db.certificate.findMany({ where: { expiryDate: { not: null } }, select: { expiryDate: true, consultantId: true } }),
    db.application.count({ where: { status: { in: ["NEW", "SCREENING", "PROPOSED"] } } }),
    db.candidate.count(),
    db.vacancy.count({ where: { status: "PUBLISHED" } }),
    db.vacancy.count({ where: { status: "CONCEPT" } }),
    db.vacancy.aggregate({ where: { status: "PUBLISHED" }, _sum: { views: true } }),
    db.expense.aggregate({ where: { status: "NEW" }, _count: { _all: true }, _sum: { amount: true } }),
    db.evaluation.findMany({
      where: { year, ...(isYear ? {} : { quarter: qNum! }) },
      select: { scoresJson: true },
    }),
    db.invoice.findMany({
      where: { issueDate: { gte: periodStart, lt: periodEnd } },
      orderBy: [{ issueDate: "desc" }, { number: "desc" }],
      take: 5,
      include: { client: true },
    }),
    db.application.findMany({
      where: { createdAt: { gte: periodStart, lt: periodEnd } },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { candidate: true, vacancy: true },
    }),
    db.application.groupBy({
      by: ["status"],
      where: { createdAt: { gte: periodStart, lt: periodEnd } },
      _count: { _all: true },
    }),
  ]);

  // ---- Activiteits-heatmap (laatste ~53 weken, altijd het lopende venster) ----
  const heatStart = new Date(now);
  heatStart.setDate(heatStart.getDate() - 53 * 7);
  const [tsDates, invDates, appDates, evDates, expDates] = await Promise.all([
    db.timesheetEntry.findMany({ where: { date: { gte: heatStart } }, select: { date: true } }),
    db.invoice.findMany({ where: { issueDate: { gte: heatStart } }, select: { issueDate: true } }),
    db.application.findMany({ where: { createdAt: { gte: heatStart } }, select: { createdAt: true } }),
    db.calendarEvent.findMany({ where: { start: { gte: heatStart } }, select: { start: true } }),
    db.expense.findMany({ where: { date: { gte: heatStart } }, select: { date: true } }),
  ]);
  const activityCounts: Record<string, number> = {};
  const bump = (d: Date | null) => {
    if (!d) return;
    const x = new Date(d);
    const key = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
    activityCounts[key] = (activityCounts[key] ?? 0) + 1;
  };
  for (const r of tsDates) bump(r.date);
  for (const r of invDates) bump(r.issueDate);
  for (const r of appDates) bump(r.createdAt);
  for (const r of evDates) bump(r.start);
  for (const r of expDates) bump(r.date);

  // ---- Omzet/inkoop/marge per maand binnen de periode (billable timesheets) ----
  const months = [] as { y: number; m: number; label: string; omzet: number; inkoop: number; marge: number }[];
  for (
    let d = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);
    d < periodEnd;
    d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
  ) {
    months.push({ y: d.getFullYear(), m: d.getMonth(), label: monthFmt.format(d), omzet: 0, inkoop: 0, marge: 0 });
  }
  let periodOmzet = 0;
  let periodMarge = 0;
  for (const t of periodBillable) {
    const d = new Date(t.weekStart);
    const hours = t.entries.reduce((s, e) => s + e.hours, 0);
    const omzet = hours * t.placement.chargeRate;
    // Eigen loondienst-personeel heeft géén inkoopfactuur (salaris) → geen inkoop
    // hier, consistent met invoicingOverview/brutomarge. Anders zou de dashboard-
    // marge de loonkost als fantoom-inkoop aftrekken en botsen met de facturatie-
    // sectie op dezelfde pagina.
    const inkoop = t.placement.consultant.employmentType === "LOONDIENST" ? 0 : hours * t.placement.costRate;
    const marge = omzet - inkoop;
    const mo = months.find((x) => x.y === d.getFullYear() && x.m === d.getMonth());
    if (mo) {
      mo.omzet += omzet;
      mo.inkoop += inkoop;
      mo.marge += marge;
    }
    periodOmzet += omzet;
    periodMarge += marge;
  }
  periodOmzet = round2(periodOmzet);
  periodMarge = round2(periodMarge);
  const periodMargePct = periodOmzet > 0 ? Math.round((periodMarge / periodOmzet) * 100) : 0;
  const chartData = months.map((m) => ({
    month: m.label,
    omzet: round2(m.omzet),
    inkoop: round2(m.inkoop),
    marge: round2(m.marge),
  }));

  // ---- Samenstelling/verdeling + risico-analyses (cirkeldiagrammen e.d.) ----
  const comp = await dashboardComposition({ start: periodStart, end: periodEnd }, now);
  const agingTones: DashColor[] = ["slate", "blue", "amber", "orange", "rose"];

  // ---- Recruitment-pipeline (sollicitaties aangemaakt in de periode, per status) ----
  const statusCount = new Map(applicationsByStatus.map((r) => [r.status, r._count._all]));
  const pipeline = APPLICATION_STATUSES.map((s) => ({
    label: s.label,
    value: statusCount.get(s.value) ?? 0,
    color: BADGE_TO_DASH[colorFor(APPLICATION_STATUSES, s.value)] ?? "slate",
  }));
  const pipelineMax = Math.max(1, ...pipeline.map((p) => p.value));

  // ---- Top klanten in de periode ----
  const topClients = overview.perClient.slice(0, 5);
  const topClientMax = Math.max(1, ...topClients.map((c) => c.omzet));

  // ---- Verbeterpunten / aandacht (altijd de HUIDIGE stand — actielijst) ----
  const overdueInvoices = sentInvoices.filter((i) => i.dueDate < now);
  const overdueAmount = round2(overdueInvoices.reduce((s, i) => s + i.total, 0));
  const expiredCerts = certs.filter((c) => c.expiryDate && c.expiryDate < now).length;
  const expiringCerts = certs.filter((c) => c.expiryDate && c.expiryDate >= now && c.expiryDate < soon).length;
  const certAlerts = expiredCerts + expiringCerts;
  const lowMarginPlacements = activePlacements.filter(
    (p) => p.chargeRate > 0 && (p.chargeRate - p.costRate) / p.chargeRate < 0.15,
  );
  const expensesNewCount = expensesNew._count._all;

  const evalScores = periodEvals
    .map((e) => averageOfScores(parseJsonMap(e.scoresJson)))
    .filter((x): x is number => x !== null);
  const evalAvg = evalScores.length
    ? Math.round((evalScores.reduce((s, v) => s + v, 0) / evalScores.length) * 10) / 10
    : null;

  const signals: { label: string; value: string; href: string; tone: "red" | "amber" | "blue" | "slate" }[] = [
    { label: "Facturen te laat (over vervaldatum)", value: overdueInvoices.length ? `${overdueInvoices.length} · ${formatCurrency(overdueAmount)}` : "0", href: "/facturen", tone: overdueInvoices.length ? "red" : "slate" },
    { label: "Klaar om te verwerken", value: String(pendingConsultants.length), href: "/verwerken", tone: pendingConsultants.length ? "blue" : "slate" },
    { label: "Urenstaten ter goedkeuring", value: String(submittedCount), href: "/uren", tone: submittedCount ? "amber" : "slate" },
    { label: "Certificaten (bijna) verlopen", value: String(certAlerts), href: "/certificeringen", tone: expiredCerts ? "red" : certAlerts ? "amber" : "slate" },
    { label: "Plaatsingen met lage marge (<15%)", value: String(lowMarginPlacements.length), href: "/plaatsingen", tone: lowMarginPlacements.length ? "amber" : "slate" },
    { label: "Open sollicitaties in pipeline", value: String(openApplications), href: "/sollicitaties", tone: openApplications ? "blue" : "slate" },
    { label: "Declaraties te beoordelen", value: String(expensesNewCount), href: "/declaraties", tone: expensesNewCount ? "amber" : "slate" },
    { label: "Vacatures live op de website", value: String(vacPublished), href: "/website", tone: vacPublished ? "blue" : "amber" },
  ];

  const periodBtn = (label: string, active: boolean, param: string) => (
    <Link
      href={`/dashboard?q=${param}&year=${year}`}
      className={cn(
        "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-blue-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description="Hoe staat Q4S ervoor — omzet, marge, recruitment en dossiers. Filter op heel jaar of een kwartaal; alle cijfers passen zich aan."
      />

      {/* Periodefilter — heel jaar of per kwartaal */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-400">Periode</span>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {periodBtn("Heel jaar", isYear, "all")}
          {QUARTERS.map((qq) => periodBtn(`Q${qq.value}`, !isYear && qNum === Number(qq.value), qq.value))}
        </div>
        <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
          {year > START_YEAR ? (
            <Link href={`/dashboard?q=${qParam}&year=${year - 1}`} aria-label="Vorig jaar" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          ) : (
            <span className="cursor-not-allowed p-1.5 text-slate-200"><ChevronLeft className="h-4 w-4" /></span>
          )}
          <span className="min-w-[3rem] text-center text-sm font-semibold text-slate-900">{year}</span>
          {year < maxYear ? (
            <Link href={`/dashboard?q=${qParam}&year=${year + 1}`} aria-label="Volgend jaar" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900">
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="cursor-not-allowed p-1.5 text-slate-200"><ChevronRight className="h-4 w-4" /></span>
          )}
        </div>
      </div>

      {/* Kerncijfers (periode) — kleurrijke KPI-tegels */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile color="blue" label={`Omzet ${shortLabel}`} value={formatCurrency(periodOmzet)} sub={periodLabel} icon={<TrendingUp className="h-5 w-5" />} />
        <KpiTile color="emerald" label={`Marge ${shortLabel}`} value={formatCurrency(periodMarge)} sub={`${periodMargePct}% marge`} icon={<Percent className="h-5 w-5" />} />
        <KpiTile color="violet" label={`Plaatsingen ${shortLabel}`} value={periodPlacements.length} sub="actief in periode" icon={<Briefcase className="h-5 w-5" />} />
        <KpiTile color="cyan" label={`Werknemers ${shortLabel}`} value={periodConsultants} sub={`${periodClients} klanten`} icon={<HardHat className="h-5 w-5" />} />
      </div>

      {/* Chart + Verbeterpunten */}
      <div>
        <SectionHeading
          title={`Omzet, inkoop & marge ${periodLabel}`}
          color="blue"
          action={<Link href="/totaaloverzicht" className="text-sm font-medium text-blue-700 hover:text-blue-800">Totaaloverzicht →</Link>}
        />
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardContent className="pt-5">
              <DashboardChart data={chartData} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-500" /> Verbeterpunten
              </CardTitle>
              <span className="text-xs text-slate-400">huidige stand</span>
            </CardHeader>
            <CardContent className="space-y-1">
              {signals.map((s) => (
                <Link key={s.label} href={s.href} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-slate-50">
                  <span className="text-sm text-slate-700">{s.label}</span>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2.5 py-0.5 text-xs font-bold",
                        s.tone === "red" && "bg-rose-100 text-rose-700",
                        s.tone === "amber" && "bg-amber-100 text-amber-700",
                        s.tone === "blue" && "bg-blue-100 text-blue-700",
                        s.tone === "slate" && "bg-slate-100 text-slate-500",
                      )}
                    >
                      {s.value}
                    </span>
                    <ArrowRight className="h-4 w-4 text-slate-300" />
                  </span>
                </Link>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Recruitment-pipeline + Top klanten — twee kleurrijke bar-panelen */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-violet-600" /> Recruitment-pipeline
            </CardTitle>
            <Link href="/sollicitaties" className="text-sm font-medium text-violet-700 hover:text-violet-800">Alle</Link>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {pipeline.map((p) => (
              <MiniBar key={p.label} label={p.label} value={p.value} max={pipelineMax} color={p.color} />
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" /> Top klanten (omzet {periodLabel})
            </CardTitle>
            <Link href="/totaaloverzicht" className="text-sm font-medium text-blue-700 hover:text-blue-800">Overzicht</Link>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {topClients.length === 0 ? (
              <p className="py-4 text-center text-sm text-slate-400">Nog geen omzet.</p>
            ) : (
              topClients.map((c) => (
                <MiniBar
                  key={c.clientId}
                  label={c.name}
                  value={c.omzet}
                  max={topClientMax}
                  color="blue"
                  display={<span className="text-xs">{formatCurrency(c.omzet)}</span>}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Facturatie periode — kleurrijke KPI-tegels */}
      <div>
        <SectionHeading
          title={`Facturatie ${periodLabel}`}
          color="emerald"
          action={<Link href="/totaaloverzicht" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">Volledig overzicht →</Link>}
        />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <KpiTile color="blue" label="Omzet" value={formatCurrency(overview.omzet)} icon={<TrendingUp className="h-5 w-5" />} />
          <KpiTile color="violet" label="Inkoop" value={formatCurrency(overview.inkoop)} icon={<Coins className="h-5 w-5" />} />
          <KpiTile color="emerald" label="Marge" value={formatCurrency(overview.marge)} sub={`${overview.margePct}% marge`} icon={<Percent className="h-5 w-5" />} />
          <KpiTile color="amber" label="Openstaand" value={formatCurrency(overview.openstaand)} icon={<Wallet className="h-5 w-5" />} />
          <KpiTile color="orange" label="Te betalen" value={formatCurrency(overview.teBetalen)} icon={<Banknote className="h-5 w-5" />} />
        </div>
      </div>

      {/* Wat we overhouden — brutomarge én nettowinst, met de uitsplitsing ertussen */}
      <div>
        <SectionHeading
          title={`Wat Q4S overhoudt (${periodLabel})`}
          color="emerald"
          action={<Link href="/totaaloverzicht" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">Totaaloverzicht →</Link>}
        />
        <div className="grid gap-6 lg:grid-cols-5">
          {/* Twee losse cijfers */}
          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-1">
            <KpiTile
              color="emerald"
              label="Brutomarge"
              value={formatCurrency(brutomarge)}
              sub={`${overview.margePct}% van omzet · ná inkoop werkers`}
              icon={<Percent className="h-5 w-5" />}
            />
            <KpiTile
              color={nettoWinst >= 0 ? "emerald" : "rose"}
              label="Nettowinst — wat we overhouden"
              value={formatCurrency(nettoWinst)}
              sub={`${winstPct}% van omzet · ná onze eigen kosten`}
              icon={<Banknote className="h-5 w-5" />}
            />
          </div>

          {/* De uitsplitsing: van omzet naar winst */}
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5 text-emerald-600" /> Van omzet naar winst
              </CardTitle>
              <span className="text-xs text-slate-400">{periodLabel} · ex. btw</span>
            </CardHeader>
            <CardContent className="pt-2">
              <ResultRow label="Omzet (verkoop aan klanten)" amount={overview.omzet} />
              <ResultRow label="Inkoop (wat we de werkers betalen)" amount={overview.inkoop} variant="cost" />
              <ResultRow label="Brutomarge" amount={brutomarge} variant="subtotal" />
              <ResultRow label="Loonkosten eigen team" amount={costs.loonkosten} variant="cost" />
              <ResultRow label="Bonussen" amount={costs.bonussen} variant="cost" />
              <ResultRow label="Declaraties" amount={costs.declaraties} variant="cost" />
              <ResultRow label="Nettowinst — wat Q4S overhoudt" amount={nettoWinst} variant="total" />
              {costs.loonkostenGeschat && (
                <p className="mt-3 text-xs text-slate-400">
                  Loonkosten geschat op de maandsalarissen van het actieve team × {costs.monthsElapsed} maanden — er zijn nog geen loonstroken voor deze periode vastgelegd. Zodra je loonstroken invoert, rekent het dashboard met de echte bedragen.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Omzet-mix — cirkeldiagrammen (per discipline / dienstverband) + kosten */}
      <div>
        <SectionHeading
          title={`Omzet- & kostenmix (${periodLabel})`}
          color="blue"
          action={<span className="hidden text-xs text-slate-400 sm:inline">op verkoopfacturen · ex btw</span>}
        />
        <div className="grid gap-6 lg:grid-cols-3">
          <ChartCard
            title="Omzet per discipline"
            icon={<Layers className="h-5 w-5" />}
            iconColor="text-blue-600"
            action={<Link href="/dashboard/rapportage" className="text-sm font-medium text-blue-700 hover:text-blue-800">Rapportage</Link>}
          >
            <DashboardPie data={comp.omzetPerDiscipline} kind="currency" centerLabel="omzet" />
          </ChartCard>
          <ChartCard
            title="Omzet per dienstverband"
            icon={<Coins className="h-5 w-5" />}
            iconColor="text-violet-600"
            note="ZZP vs loondienst vs uitzend — zie je of ZZP over-/onder-indexeert op omzet."
          >
            <DashboardPie data={comp.omzetPerDienstverband} kind="currency" centerLabel="omzet" />
          </ChartCard>
          <ChartCard
            title="Declaraties per categorie"
            icon={<Receipt className="h-5 w-5" />}
            iconColor="text-orange-600"
            action={<Link href="/declaraties" className="text-sm font-medium text-orange-700 hover:text-orange-800">Alle</Link>}
          >
            <DashboardPie data={comp.declaratiesPerCategorie} kind="currency" centerLabel="declaraties" />
          </ChartCard>
        </div>
      </div>

      {/* Bezetting & levering */}
      <div>
        <SectionHeading title="Bezetting & levering" color="violet" />
        <div className="grid gap-6 lg:grid-cols-3">
          <ChartCard
            title="Bezetting vs bank"
            icon={<Users className="h-5 w-5" />}
            iconColor="text-emerald-600"
            action={<Link href="/plaatsingen" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">Plaatsingen</Link>}
            note={`${comp.benchCount} van de actieve werknemers op de bank · huidige stand`}
          >
            <DashboardPie data={comp.utilization} kind="count" centerLabel={`${comp.bezettingPct}% bezet`} />
          </ChartCard>
          <ChartCard
            title="Actieve plaatsingen per dienstverband"
            icon={<Briefcase className="h-5 w-5" />}
            iconColor="text-violet-600"
            note="huidige stand"
          >
            <DashboardPie data={comp.plaatsingenPerDienstverband} kind="count" centerLabel="plaatsingen" />
          </ChartCard>
          <ChartCard
            title="Geregistreerde uren per week"
            icon={<TrendingUp className="h-5 w-5" />}
            iconColor="text-blue-600"
            note="Leidende indicator vóór de facturatie."
          >
            <DashboardLine data={comp.urenTrend} unit="u" />
          </ChartCard>
        </div>
      </div>

      {/* Debiteuren & cash (huidige stand) */}
      <div>
        <SectionHeading
          title="Debiteuren & cash"
          color="amber"
          action={<Link href="/facturen" className="text-sm font-medium text-amber-700 hover:text-amber-800">Facturen →</Link>}
        />
        <div className="grid gap-6 lg:grid-cols-3">
          <ChartCard
            title="Openstaande facturen — ouderdom"
            icon={<Wallet className="h-5 w-5" />}
            iconColor="text-amber-600"
            note="huidige stand · verzonden, nog niet betaald"
          >
            <BarList
              rows={comp.invoiceAging.map((b, i) => ({
                label: b.label,
                value: b.amount,
                color: agingTones[i] ?? "slate",
                display: <span className="text-xs">{formatCurrency(b.amount)}</span>,
              }))}
            />
          </ChartCard>
          <ChartCard
            title="Gem. betaaltermijn (DSO)"
            icon={<Timer className="h-5 w-5" />}
            iconColor="text-blue-600"
            note={`facturen betaald in ${periodLabel}`}
          >
            <div className="flex flex-col items-center justify-center py-8">
              <span className="text-5xl font-bold tracking-tight text-blue-700">
                {comp.dso != null ? comp.dso : "—"}
              </span>
              <span className="mt-2 text-sm text-slate-500">
                {comp.dso != null ? "dagen gemiddeld tot betaling" : "geen betaalde facturen in periode"}
              </span>
            </div>
          </ChartCard>
          <ChartCard
            title="Ontvangen ZZP-facturen"
            icon={<Banknote className="h-5 w-5" />}
            iconColor="text-emerald-600"
            action={<Link href="/ontvangen-facturen" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">Alle</Link>}
            note="huidige stand · wat wij nog moeten betalen"
          >
            <DashboardPie data={comp.ontvangenStatus} kind="currency" centerLabel="ontvangen" />
          </ChartCard>
        </div>
      </div>

      {/* Risico — komende 90 dagen */}
      <div>
        <SectionHeading title="Risico — komende 90 dagen" color="rose" />
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Aflopende plaatsingen per maand"
            icon={<CalendarClock className="h-5 w-5" />}
            iconColor="text-rose-600"
            action={<Link href="/plaatsingen" className="text-sm font-medium text-rose-700 hover:text-rose-800">Plaatsingen</Link>}
            note={`${comp.aflopendePlaatsingen30} plaatsing${comp.aflopendePlaatsingen30 === 1 ? "" : "en"} loopt binnen 30 dagen af — tijd om te verlengen of te herplaatsen.`}
          >
            <BarList
              rows={comp.aflopendePlaatsingen.map((b) => ({
                label: b.label,
                value: b.value,
                color: "amber" as DashColor,
              }))}
            />
          </ChartCard>
          <ChartCard
            title="Verlopende certificaten per maand"
            icon={<Award className="h-5 w-5" />}
            iconColor="text-rose-600"
            action={<Link href="/certificeringen" className="text-sm font-medium text-rose-700 hover:text-rose-800">Certificaten</Link>}
            note={`${comp.verlopendeCertificaten30} certifica${comp.verlopendeCertificaten30 === 1 ? "at" : "ten"} verloopt binnen 30 dagen — mag anders niet ingezet worden.`}
          >
            <BarList
              rows={comp.verlopendeCertificaten.map((b) => ({
                label: b.label,
                value: b.value,
                color: "rose" as DashColor,
              }))}
            />
          </ChartCard>
        </div>
      </div>

      {/* Recruitment & sales */}
      <div>
        <SectionHeading title={`Recruitment & sales (${periodLabel})`} color="cyan" />
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard
            title="Bron van instroom (kandidaten)"
            icon={<Sparkles className="h-5 w-5" />}
            iconColor="text-cyan-600"
            action={<Link href="/website/cvs" className="text-sm font-medium text-cyan-700 hover:text-cyan-800">CV's</Link>}
            note="Welk kanaal levert kandidaten — stuurt je budget/keuze."
          >
            <DashboardPie data={comp.kandidatenPerBron} kind="count" centerLabel="kandidaten" />
          </ChartCard>
          <ChartCard
            title="Talentpool-beschikbaarheid"
            icon={<UserCheck className="h-5 w-5" />}
            iconColor="text-emerald-600"
            action={<Link href="/kandidaten/beschikbaar" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">Beschikbaar</Link>}
            note="huidige stand · hoeveel talent direct inzetbaar op de plank ligt"
          >
            <DashboardPie
              data={comp.talentpoolBeschikbaarheid}
              kind="count"
              centerLabel={`${comp.talentpoolInzetbaar} inzetbaar`}
            />
          </ChartCard>
          <ChartCard
            title="Win/verlies (CRM)"
            icon={<Trophy className="h-5 w-5" />}
            iconColor="text-amber-600"
            action={<Link href="/crm" className="text-sm font-medium text-amber-700 hover:text-amber-800">Pipeline</Link>}
            note={`gewonnen/verloren afgesloten in ${periodLabel} · open = huidige stand`}
          >
            <DashboardPie
              data={comp.winVerlies}
              kind="count"
              centerLabel={comp.winratePct != null ? `${comp.winratePct}% winrate` : "geen afgesloten"}
            />
          </ChartCard>
          <ChartCard
            title="Pipeline-waarde per fase"
            icon={<Target className="h-5 w-5" />}
            iconColor="text-violet-600"
            action={<Link href="/crm" className="text-sm font-medium text-violet-700 hover:text-violet-800">CRM</Link>}
            note="huidige stand · open deals; verwachte (gewogen) waarde tussen haakjes"
          >
            <BarList
              rows={comp.pipelineWaarde.map((s) => ({
                label: s.name,
                value: s.value,
                color: BADGE_TO_DASH[s.color] ?? "slate",
                display: (
                  <span className="text-xs">
                    {formatCurrency(s.value)}
                    <span className="text-slate-400"> · {formatCurrency(s.weighted)}</span>
                  </span>
                ),
              }))}
            />
          </ChartCard>
        </div>
      </div>

      {/* Alle onderdelen — kleurrijke hub-tegels */}
      <div>
        <SectionHeading title="Alle onderdelen" color="violet" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <HubTile color="blue" icon={<ListChecks className="h-5 w-5" />} title="Facturatie" href="/verwerken"
            rows={[["Te verwerken", String(pendingConsultants.length)], ["Openstaand", formatCurrency(overview.openstaand)], ["Te betalen", formatCurrency(overview.teBetalen)]]} />
          <HubTile color="violet" icon={<Sparkles className="h-5 w-5" />} title="Recruitment" href="/recruitment"
            rows={[["Open sollicitaties", String(openApplications)], ["Kandidaten", String(candidatesCount)], ["Vacatures (live/concept)", `${vacPublished} / ${vacConcept}`]]} />
          <HubTile color="emerald" icon={<Briefcase className="h-5 w-5" />} title="Plaatsingen" href="/plaatsingen"
            rows={[["Actief nu", String(activePlacements.length)], ["Lage marge (<15%)", String(lowMarginPlacements.length)], ["Werknemers", String(consultantsCount)]]} />
          <HubTile color="amber" icon={<Award className="h-5 w-5" />} title="Certificaten" href="/certificeringen"
            rows={[["Verlopen", String(expiredCerts)], ["Verloopt binnenkort", String(expiringCerts)]]} />
          <HubTile color="cyan" icon={<ClipboardCheck className="h-5 w-5" />} title={`Evaluaties ${shortLabel}`} href="/evaluaties/vcu"
            rows={[["Aantal", String(periodEvals.length)], ["Gem. score", evalAvg !== null ? `${evalAvg.toLocaleString("nl-NL")} / 4` : "—"]]} />
          <HubTile color="orange" icon={<Receipt className="h-5 w-5" />} title="Declaraties" href="/declaraties"
            rows={[["Te beoordelen", String(expensesNewCount)], ["Openstaand bedrag", formatCurrency(round2(expensesNew._sum.amount ?? 0))]]} />
          <HubTile color="indigo" icon={<Globe className="h-5 w-5" />} title="Website" href="/website"
            rows={[["Live vacatures", String(vacPublished)], ["Weergaven", String(vacViews._sum.views ?? 0)]]} />
          <HubTile color="rose" icon={<Star className="h-5 w-5" />} title="Talentpool" href="/kandidaten"
            rows={[["Kandidaten", String(candidatesCount)], ["In pipeline", String(openApplications)]]} />
        </div>
      </div>

      {/* Recente activiteit (in de periode) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-600" /> Recente facturen
            </CardTitle>
            <Link href="/facturen" className="text-sm font-medium text-blue-700 hover:text-blue-800">Alle facturen</Link>
          </CardHeader>
          {recentInvoices.length === 0 ? (
            <CardContent className="text-sm text-slate-500">Geen facturen in {periodLabel}.</CardContent>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Nummer</TH>
                  <TH>Klant</TH>
                  <TH className="text-right">Bedrag</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {recentInvoices.map((inv) => (
                  <TR key={inv.id}>
                    <TD>
                      <Link href={`/facturen/${inv.id}`} className="font-medium text-slate-900 hover:text-blue-700">{inv.number}</Link>
                    </TD>
                    <TD className="truncate text-slate-600">{inv.client.companyName}</TD>
                    <TD className="text-right tabular-nums">{formatCurrency(inv.total)}</TD>
                    <TD><StatusBadge options={INVOICE_STATUSES} value={effectiveStatus(inv.status, inv.dueDate, now)} /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-violet-600" /> Recente sollicitaties
            </CardTitle>
            <Link href="/sollicitaties" className="text-sm font-medium text-violet-700 hover:text-violet-800">Alle</Link>
          </CardHeader>
          {recentApplications.length === 0 ? (
            <CardContent className="text-sm text-slate-500">Geen sollicitaties in {periodLabel}.</CardContent>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Kandidaat</TH>
                  <TH>Vacature</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {recentApplications.map((a) => (
                  <TR key={a.id}>
                    <TD>
                      <Link href={`/sollicitaties/${a.id}`} className="font-medium text-slate-900 hover:text-violet-700">
                        {a.candidate.firstName} {a.candidate.lastName}
                      </Link>
                    </TD>
                    <TD className="truncate text-slate-600">{a.vacancy ? a.vacancy.title : "—"}</TD>
                    <TD><StatusBadge options={APPLICATION_STATUSES} value={a.status} /></TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>

      {/* Activiteit — heatmap (laatste ~53 weken) */}
      <div>
        <SectionHeading title="Q4S-activiteit" color="cyan" action={<span className="hidden text-sm text-slate-400 sm:inline">laatste 53 weken · urenstaten · facturen · sollicitaties · agenda · declaraties</span>} />
        <Card>
          <CardContent className="pt-5">
            <ActivityHeatmap counts={activityCounts} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
