import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { deltaPct, periodeUit } from "@/lib/analytics-periode";
import { getWeekOverview } from "@/lib/facturatie-week";
import { volgendePersoon } from "@/lib/facturatie-volgende";
import { DEADLINE_LABEL } from "@/lib/facturatie-checks";
import { PeriodeFilter } from "./_ui";
import {
  Wallet,
  TrendingUp,
  Coins,
  Briefcase,
  ArrowRight,
  Banknote,
  Percent,
  AlertTriangle,
  Receipt,
  Sparkles,
  ClipboardList,
  Award,
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
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { cn, formatCurrency, round2 } from "@/lib/utils";
import {
  INVOICE_STATUSES,
  APPLICATION_STATUSES,
  colorFor,
} from "@/lib/domain";
import { ActivityHeatmap } from "@/components/activity-heatmap";
import { DashboardChart } from "./DashboardChart";
import { DashboardPie } from "./DashboardPie";
import { DashboardLine } from "./DashboardLine";
import { KpiTile, SectionCard, SectionHeading, MiniBar, ResultRow, type DashColor } from "./_kpi";
import { CountUpValue } from "./CountUpValue";
import { invoicingOverview, companyCostsThisYear } from "@/lib/facturatie";
import { dashboardComposition } from "@/lib/dashboard-analytics";
import { currentUser } from "@/lib/session";
import type { ReactNode } from "react";

export const metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";


function effectiveStatus(status: string, dueDate: Date, now: Date) {
  if (status === "SENT" && dueDate < now) return "OVERDUE";
  return status;
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
  iconColor = "text-ink-500",
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
        {note && <div className="mt-3 text-xs text-ink-400">{note}</div>}
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
    return <p className="py-6 text-center text-sm text-ink-400">Nog geen gegevens.</p>;
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
  const p = periodeUit(sp, now);
  const { start: periodStart, end: periodEnd, label: periodLabel, short: shortLabel } = p;
  const soon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 60);
  // Vandaag-venster + start van de lopende ISO-week (maandag) voor de
  // begroetingskaarten bovenaan.
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const isoWeekStart = new Date(todayStart);
  isoWeekStart.setDate(isoWeekStart.getDate() - ((isoWeekStart.getDay() + 6) % 7));

  // Plaatsingen die een venster overlappen (start vóór het einde, niet geëindigd vóór het begin).
  const overlapt = (start: Date, end: Date) => ({
    startDate: { lt: end },
    OR: [{ endDate: null }, { endDate: { gte: start } }],
  });
  const [
    periodPlacements,
    prevPlacementsCount,
    activePlacements,
    sentInvoices,
    week,
    overview,
    prevOverview,
    costs,
  ] = await Promise.all([
    // Plaatsingen die de periode overlappen (start vóór einde periode én nog niet
    // geëindigd vóór het begin ervan) — de periode-versie van "actieve plaatsingen".
    db.placement.findMany({
      where: overlapt(periodStart, periodEnd),
      select: { id: true, consultantId: true, clientId: true },
    }),
    db.placement.count({ where: overlapt(p.prevStart, p.prevEnd) }),
    db.placement.findMany({ where: { status: "ACTIVE" }, include: { consultant: true, client: true } }),
    db.invoice.findMany({ where: { status: "SENT" } }),
    // Dezelfde stand als Facturatie → Week verwerken (deze week).
    getWeekOverview(undefined, now),
    // Omzet/marge komen uit de FACTUREN — precies zoals Facturatie → Rapportage.
    invoicingOverview({ start: periodStart, end: periodEnd }),
    invoicingOverview({ start: p.prevStart, end: p.prevEnd }),
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
    vacPublished,
    expensesNew,
    recentInvoices,
    recentApplications,
    applicationsByStatus,
    readyInvoices,
    paidThisWeek,
    todayTasks,
    me,
  ] = await Promise.all([
    db.certificate.findMany({ where: { expiryDate: { not: null } }, select: { expiryDate: true, consultantId: true } }),
    db.application.count({ where: { status: { in: ["NEW", "SCREENING", "PROPOSED"] } } }),
    db.vacancy.count({ where: { status: "PUBLISHED" } }),
    db.expense.count({ where: { status: "NEW" } }),
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
    // Verzendmap: vrijgegeven verkoopfacturen die klaarstaan om te versturen.
    db.invoice.findMany({ where: { status: "READY" }, select: { total: true } }),
    // Betaald in de lopende ISO-week (ma t/m nu).
    db.invoice.findMany({
      where: { status: "PAID", paidDate: { gte: isoWeekStart } },
      select: { total: true },
    }),
    // Agenda-taken van vandaag (open TODO's met een tijd vandaag).
    db.activity.findMany({
      where: { kind: "TODO", done: false, dueAt: { gte: todayStart, lt: todayEnd } },
      orderBy: { dueAt: "asc" },
      take: 5,
      select: { id: true, body: true, dueAt: true, type: true },
    }),
    currentUser(),
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

  // ---- Omzet/inkoop/marge per maand — uit de facturen, net als Rapportage ----
  const chartData = overview.perMonth.map((m) => ({ month: m.label, omzet: m.omzet, inkoop: m.inkoop, marge: m.marge }));
  const periodMargePct = overview.margePct;

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
  const expensesNewCount = expensesNew;

  // ---- Week verwerken (zelfde cijfers als Facturatie → Week verwerken) ----
  const ws = week.stats;
  const eersteVerwerken = volgendePersoon(week.rows);
  const deadlineVoorbij = now.getTime() > week.week.deadline.getTime();

  const signals: { label: string; value: string; href: string; tone: "red" | "amber" | "blue" | "slate" }[] = [
    { label: "Facturen te laat (over vervaldatum)", value: overdueInvoices.length ? `${overdueInvoices.length} · ${formatCurrency(overdueAmount)}` : "0", href: "/facturatie/verkoop?tab=telaat", tone: overdueInvoices.length ? "red" : "slate" },
    { label: `Week ${week.week.isoWeek}: klaar voor akkoord`, value: String(ws.klaar), href: "/facturatie?filter=klaar", tone: ws.klaar ? "blue" : "slate" },
    { label: `Week ${week.week.isoWeek}: met fouten`, value: String(ws.fout), href: "/facturatie?filter=fout", tone: ws.fout ? "red" : "slate" },
    { label: "Certificaten (bijna) verlopen", value: String(certAlerts), href: "/certificeringen", tone: expiredCerts ? "red" : certAlerts ? "amber" : "slate" },
    { label: "Plaatsingen met lage marge (<15%)", value: String(lowMarginPlacements.length), href: "/plaatsingen", tone: lowMarginPlacements.length ? "amber" : "slate" },
    { label: "Open sollicitaties in pipeline", value: String(openApplications), href: "/sollicitaties", tone: openApplications ? "blue" : "slate" },
    { label: "Declaraties te beoordelen", value: String(expensesNewCount), href: "/facturatie/inkoop?tab=declaraties", tone: expensesNewCount ? "amber" : "slate" },
    { label: "Vacatures live op de website", value: String(vacPublished), href: "/website", tone: vacPublished ? "blue" : "amber" },
  ];

  // ---- "Nu te doen": de belangrijkste acties van vandaag, afgeleid uit de
  // bestaande signalen — met een directe actieknop per regel (mockup-stijl).
  type Todo = { key: string; title: string; sub: string; href: string; cta: string; tone: DashColor; primary?: boolean };
  const todos: Todo[] = [];
  if (ws.klaar > 0 && eersteVerwerken?.href) {
    todos.push({
      key: "verwerken",
      title: `Week ${week.week.isoWeek}: ${ws.klaar} ${ws.klaar === 1 ? "persoon" : "personen"} klaar voor akkoord`,
      sub: `Week verwerken · begin bij ${eersteVerwerken.naam}`,
      href: eersteVerwerken.href, cta: "Start", tone: "blue", primary: true,
    });
  }
  if (ws.fout > 0) {
    todos.push({
      key: "fouten",
      title: `Week ${week.week.isoWeek}: ${ws.fout} ${ws.fout === 1 ? "week" : "weken"} met fouten`,
      sub: "Week verwerken · urenstaat en factuur kloppen niet",
      href: "/facturatie?filter=fout", cta: "Bekijk", tone: "amber",
    });
  }
  if (deadlineVoorbij && ws.nietIngeleverd > 0) {
    todos.push({
      key: "telaat",
      title: `${ws.nietIngeleverd} ${ws.nietIngeleverd === 1 ? "persoon heeft" : "personen hebben"} week ${week.week.isoWeek} nog niet ingeleverd`,
      sub: `Deadline ${DEADLINE_LABEL} verstreken`,
      href: "/facturatie?filter=niet", cta: "Bekijk", tone: "amber",
    });
  }
  if (overdueInvoices.length > 0) {
    todos.push({
      key: "overdue",
      title: `${overdueInvoices.length} factu${overdueInvoices.length === 1 ? "ur is" : "ren zijn"} over de vervaldatum (${formatCurrency(overdueAmount)})`,
      sub: "Herinnering staat klaar",
      href: "/facturatie/verkoop?tab=telaat", cta: "Bekijk", tone: "amber",
    });
  }
  if (certAlerts > 0) {
    todos.push({
      key: "certs",
      title: `${certAlerts} certifica${certAlerts === 1 ? "at" : "ten"} (bijna) verlopen`,
      sub: "Certificeringen · hercertificering plannen",
      href: "/certificeringen", cta: "Plan", tone: "amber",
    });
  }
  if (openApplications > 0) {
    todos.push({
      key: "sollicitaties",
      title: `${openApplications} open sollicitatie${openApplications === 1 ? "" : "s"} in de pipeline`,
      sub: "Sollicitaties · screenen of voorstellen",
      href: "/sollicitaties", cta: "Review", tone: "violet",
    });
  }
  if (expensesNewCount > 0) {
    todos.push({
      key: "declaraties",
      title: `${expensesNewCount} declaratie${expensesNewCount === 1 ? "" : "s"} te beoordelen`,
      sub: "Declaraties · goedkeuren of afwijzen",
      href: "/facturatie/inkoop?tab=declaraties", cta: "Beoordeel", tone: "emerald",
    });
  }
  const topTodos = todos.slice(0, 5);

  // Facturatie deze week (echte stand): verzendmap, wacht op controle, betaald.
  const readyTotal = round2(readyInvoices.reduce((s, i) => s + i.total, 0));
  const paidWeekTotal = round2(paidThisWeek.reduce((s, i) => s + i.total, 0));
  const timeFmt = new Intl.DateTimeFormat("nl-NL", { hour: "2-digit", minute: "2-digit" });
  const greeting = now.getHours() < 12 ? "Goedemorgen" : now.getHours() < 18 ? "Goedemiddag" : "Goedenavond";
  const firstName = me?.name?.split(" ")[0] ?? "";


  return (
    <div className="space-y-8">
      {/* Kop: persoonlijke begroeting (mockup-stijl) + periodefilter rechts */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="q4s-display text-[26px]">
            {greeting}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-0.5 text-sm text-ink-400">
            Dit speelt er vandaag. Begin bovenaan bij &quot;Nu te doen&quot;.
          </p>
        </div>
        <PeriodeFilter basePath="/dashboard" periode={p} />
      </div>

      {/* Kerncijfers (periode) — Studio Admin-stijl statuskaarten met delta t.o.v.
          de vorige periode, mini-trendlijn per maand en tellende cijfers. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SectionCard
          label={`Omzet ${shortLabel}`}
          value={<CountUpValue value={overview.omzet} />}
          deltaPct={deltaPct(overview.omzet, prevOverview.omzet)}
          hint={`${formatCurrency(prevOverview.omzet)} in ${p.prevLabel} · gefactureerd ex btw`}
          href={`/facturatie/rapportage?jaar=${p.year}&kwartaal=${p.q ?? "jaar"}`}
          spark={overview.perMonth.map((m) => m.omzet)}
          sparkColor="blue"
          delay={0}
        />
        <SectionCard
          label={`Marge ${shortLabel}`}
          value={<CountUpValue value={overview.marge} />}
          deltaPct={deltaPct(overview.marge, prevOverview.marge)}
          hint={`${periodMargePct}% van omzet · ${formatCurrency(prevOverview.marge)} in ${p.prevLabel}`}
          href={`/facturatie/rapportage?jaar=${p.year}&kwartaal=${p.q ?? "jaar"}`}
          spark={overview.perMonth.map((m) => m.marge)}
          sparkColor="emerald"
          delay={70}
        />
        <SectionCard
          label={`Plaatsingen ${shortLabel}`}
          value={<CountUpValue value={periodPlacements.length} format="number" />}
          deltaPct={deltaPct(periodPlacements.length, prevPlacementsCount)}
          hint={`${prevPlacementsCount} in ${p.prevLabel}`}
          href="/plaatsingen"
          delay={140}
        />
        <SectionCard
          label={`Werknemers ${shortLabel}`}
          value={<CountUpValue value={periodConsultants} format="number" />}
          hint={`${periodClients} klanten`}
          href="/medewerkers"
          delay={210}
        />
      </div>

      {/* Nu te doen + Facturatie deze week / Vandaag — mockup-layout met echte
          data. De takenlijst verdwijnt vanzelf als alles is afgehandeld. */}
      <div className="grid gap-4 lg:grid-cols-[1.55fr_1fr]">
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Nu te doen</CardTitle>
            <Link href="/dashboard/te-doen" className="text-sm font-medium text-ink-500 hover:text-ink-900">Alles bekijken</Link>
          </CardHeader>
          {topTodos.length === 0 ? (
            <CardContent className="pb-5 text-sm text-ink-500">
              Niets dringends. Alles is afgehandeld.
            </CardContent>
          ) : (
            <div className="divide-y divide-ink-100">
              {topTodos.map((t) => (
                <div key={t.key} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-ink-50">
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      t.tone === "blue" && "bg-blue-500",
                      t.tone === "amber" && "bg-amber-500",
                      t.tone === "violet" && "bg-violet-500",
                      t.tone === "emerald" && "bg-emerald-500",
                    )}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-ink-900">{t.title}</p>
                    <p className="truncate text-xs text-ink-400">{t.sub}</p>
                  </div>
                  <Link
                    href={t.href}
                    className={buttonVariants({ variant: t.primary ? "primary" : "outline", size: "sm", className: "shrink-0" })}
                  >
                    {t.cta}
                  </Link>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="grid gap-4 self-start">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-emerald-700">
                <span className="h-2.5 w-2.5 rounded-sm bg-emerald-600" /> Facturatie deze week
              </CardTitle>
              <Link href="/facturatie/verkoop" className="text-sm font-medium text-ink-500 hover:text-ink-900">Naar facturen</Link>
            </CardHeader>
            <div className="divide-y divide-ink-100">
              <Link href="/facturatie/verkoop?tab=klaar" className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-ink-50">
                <div>
                  <p className="text-[13.5px] font-semibold text-ink-900">Klaar om te versturen</p>
                  <p className="text-xs text-ink-400">Verkoopfacturen · status Klaar</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-[11.5px] font-bold text-blue-700">{readyInvoices.length} factu{readyInvoices.length === 1 ? "ur" : "ren"}</span>
                  <span className="text-[13.5px] font-bold tabular-nums text-ink-900">{formatCurrency(readyTotal)}</span>
                </div>
              </Link>
              <Link href="/facturatie" className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-ink-50">
                <div>
                  <p className="text-[13.5px] font-semibold text-ink-900">Week {week.week.isoWeek} verwerkt</p>
                  <p className="text-xs text-ink-400">Week verwerken · {ws.klaar} klaar · {ws.fout} fout · {ws.nietIngeleverd} niet ingeleverd</p>
                </div>
                <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11.5px] font-bold tabular-nums text-amber-700">
                  {week.rows.filter((r) => r.gefactureerd || r.vastgelegd).length} / {ws.actief}
                </span>
              </Link>
              <Link href="/facturatie/verkoop?tab=betaald" className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-ink-50">
                <div>
                  <p className="text-[13.5px] font-semibold text-ink-900">Ontvangen deze week</p>
                  <p className="text-xs text-ink-400">Betaalde verkoopfacturen</p>
                </div>
                <div className="flex items-center gap-2.5">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11.5px] font-bold text-emerald-700">{paidThisWeek.length} factu{paidThisWeek.length === 1 ? "ur" : "ren"}</span>
                  <span className="text-[13.5px] font-bold tabular-nums text-ink-900">{formatCurrency(paidWeekTotal)}</span>
                </div>
              </Link>
            </div>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-indigo-700">
                <span className="h-2.5 w-2.5 rounded-sm bg-indigo-600" /> Vandaag
              </CardTitle>
              <Link href="/agenda" className="text-sm font-medium text-ink-500 hover:text-ink-900">Naar agenda</Link>
            </CardHeader>
            {todayTasks.length === 0 ? (
              <CardContent className="pb-5 text-sm text-ink-500">Geen geplande taken vandaag.</CardContent>
            ) : (
              <div className="divide-y divide-ink-100">
                {todayTasks.map((t) => (
                  <Link key={t.id} href="/agenda/taken" className="flex items-start gap-3 px-5 py-3 transition-colors hover:bg-ink-50">
                    <span className="mt-0.5 shrink-0 rounded-full bg-ink-50 px-2.5 py-0.5 text-[11.5px] font-bold tabular-nums text-ink-600">
                      {t.dueAt ? timeFmt.format(t.dueAt) : "—"}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-ink-900">{t.body}</p>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>

      {/* Chart + Verbeterpunten */}
      <div>
        <SectionHeading
          title={`Omzet, inkoop & marge ${periodLabel}`}
          color="blue"
          action={<Link href={`/facturatie/rapportage?jaar=${p.year}&kwartaal=${p.q ?? "jaar"}`} className="text-sm font-bold text-brand-700 hover:text-brand-800 hover:underline underline-offset-2">Rapportage →</Link>}
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
              <span className="text-xs text-ink-400">huidige stand</span>
            </CardHeader>
            <CardContent className="space-y-1">
              {signals.map((s) => (
                <Link key={s.label} href={s.href} className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 hover:bg-ink-50">
                  <span className="text-sm text-ink-700">{s.label}</span>
                  <span className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-sm px-2.5 py-0.5 text-xs font-bold",
                        s.tone === "red" && "bg-rose-100 text-rose-700",
                        s.tone === "amber" && "bg-amber-100 text-amber-700",
                        s.tone === "blue" && "bg-blue-100 text-blue-700",
                        s.tone === "slate" && "bg-ink-100 text-ink-500",
                      )}
                    >
                      {s.value}
                    </span>
                    <ArrowRight className="h-4 w-4 text-ink-300" />
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
            <Link href={`/facturatie/rapportage?jaar=${p.year}&kwartaal=${p.q ?? "jaar"}`} className="text-sm font-bold text-brand-700 hover:text-brand-800 hover:underline underline-offset-2">Overzicht</Link>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {topClients.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-400">Nog geen omzet.</p>
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

      {/* Wat we overhouden — brutomarge én nettowinst, met de uitsplitsing ertussen */}
      <div>
        <SectionHeading
          title={`Wat Q4S overhoudt (${periodLabel})`}
          color="emerald"
          action={<Link href={`/facturatie/rapportage?jaar=${p.year}&kwartaal=${p.q ?? "jaar"}`} className="text-sm font-medium text-emerald-700 hover:text-emerald-800">Rapportage →</Link>}
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
              <span className="text-xs text-ink-400">{periodLabel} · ex. btw</span>
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
                <p className="mt-3 text-xs text-ink-400">
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
          action={<span className="hidden text-xs text-ink-400 sm:inline">op verkoopfacturen · ex btw</span>}
        />
        <div className="grid gap-6 lg:grid-cols-3">
          <ChartCard
            title="Omzet per discipline"
            icon={<Layers className="h-5 w-5" />}
            iconColor="text-blue-600"
            action={<Link href="/dashboard/rapportage" className="text-sm font-bold text-brand-700 hover:text-brand-800 hover:underline underline-offset-2">Rapportage</Link>}
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
            action={<Link href="/facturatie/inkoop?tab=declaraties" className="text-sm font-medium text-orange-700 hover:text-orange-800">Alle</Link>}
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
          action={<Link href="/facturatie/verkoop" className="text-sm font-medium text-amber-700 hover:text-amber-800">Facturen →</Link>}
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
              <span className="mt-2 text-sm text-ink-500">
                {comp.dso != null ? "dagen gemiddeld tot betaling" : "geen betaalde facturen in periode"}
              </span>
            </div>
          </ChartCard>
          <ChartCard
            title="Ontvangen ZZP-facturen"
            icon={<Banknote className="h-5 w-5" />}
            iconColor="text-emerald-600"
            action={<Link href="/facturatie/inkoop" className="text-sm font-medium text-emerald-700 hover:text-emerald-800">Alle</Link>}
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
            action={<Link href="/website/cv-inbox" className="text-sm font-medium text-cyan-700 hover:text-cyan-800">CV&apos;s</Link>}
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
                    <span className="text-ink-400"> · {formatCurrency(s.weighted)}</span>
                  </span>
                ),
              }))}
            />
          </ChartCard>
        </div>
      </div>

      {/* Recente activiteit (in de periode) */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-blue-600" /> Recente facturen
            </CardTitle>
            <Link href="/facturatie/verkoop" className="text-sm font-bold text-brand-700 hover:text-brand-800 hover:underline underline-offset-2">Alle facturen</Link>
          </CardHeader>
          {recentInvoices.length === 0 ? (
            <CardContent className="text-sm text-ink-500">Geen facturen in {periodLabel}.</CardContent>
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
                      <Link href={`/facturatie/verkoop/${inv.id}`} className="font-bold text-ink-900 hover:text-brand-600">{inv.number}</Link>
                    </TD>
                    <TD className="truncate text-ink-600">{inv.client.companyName}</TD>
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
            <CardContent className="text-sm text-ink-500">Geen sollicitaties in {periodLabel}.</CardContent>
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
                      <Link href={`/sollicitaties/${a.id}`} className="font-medium text-ink-900 hover:text-violet-700">
                        {a.candidate.firstName} {a.candidate.lastName}
                      </Link>
                    </TD>
                    <TD className="truncate text-ink-600">{a.vacancy ? a.vacancy.title : "—"}</TD>
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
        <SectionHeading title="Q4S-activiteit" color="cyan" action={<span className="hidden text-sm text-ink-400 sm:inline">laatste 53 weken · urenstaten · facturen · sollicitaties · agenda · declaraties</span>} />
        <Card>
          <CardContent className="pt-5">
            <ActivityHeatmap counts={activityCounts} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
