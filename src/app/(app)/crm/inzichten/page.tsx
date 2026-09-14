import {
  BarChart3,
  AlertTriangle,
  AlertCircle,
  Info,
  Kanban,
  Gauge,
  Flame,
  CalendarClock,
  Clock,
  Trophy,
  Activity,
  Heart,
  PieChart,
  Filter,
  Building2,
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { db } from "@/lib/db";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { CRM_NOTE_TYPES, labelFor, type BadgeColor } from "@/lib/domain";
import { currentRecruiterId, getCrmSettings, getInsights, type WeakPoint } from "@/lib/crm";

export const metadata = { title: "CRM-inzichten" };
export const dynamic = "force-dynamic";

/** Solid bar colours per badge kleur (voor de gerangschikte balken). */
const BAR: Record<BadgeColor, string> = {
  slate: "bg-ink-400",
  blue: "bg-blue-500",
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  violet: "bg-violet-500",
  cyan: "bg-cyan-500",
  orange: "bg-orange-500",
};

/** Hex per badge kleur — voor de donut (conic-gradient) en legenda-stippen. */
const HEX: Record<BadgeColor, string> = {
  slate: "#94a3b8",
  blue: "#3b82f6",
  green: "#10b981",
  amber: "#f59e0b",
  red: "#ef4444",
  violet: "#8b5cf6",
  cyan: "#06b6d4",
  orange: "#f97316",
};

function WeakPointRow({ wp }: { wp: WeakPoint }) {
  const map = {
    high: { ring: "border-red-200 bg-red-50", text: "text-red-700", Icon: AlertTriangle },
    medium: { ring: "border-amber-200 bg-amber-50", text: "text-amber-800", Icon: AlertCircle },
    low: { ring: "border-ink-200 bg-ink-50", text: "text-ink-600", Icon: Info },
  }[wp.severity];
  const Icon = map.Icon;
  return (
    <li className={cn("flex gap-3 rounded-xl border p-3.5", map.ring)}>
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", map.text)} />
      <div>
        <p className={cn("text-sm font-semibold", map.text)}>{wp.title}</p>
        <p className="mt-0.5 text-sm text-ink-600">{wp.detail}</p>
      </div>
    </li>
  );
}

export default async function InzichtenPage() {
  const recruiterId = await currentRecruiterId();
  const settings = await getCrmSettings(recruiterId);
  // Inzichten zijn altijd algemeen/team-breed — geen Mijn cijfers/Team-schakelaar.
  const scope = "all" as const;

  const ins = await getInsights({ recruiterId, scope, staleAfterDays: settings.staleAfterDays });

  // Recent gewonnen deals (echte data) — voor de "Recent gewonnen"-lijst.
  const recentWon = await db.deal.findMany({
    where: { status: "WON" },
    orderBy: { updatedAt: "desc" },
    take: 5,
    include: {
      client: { select: { companyName: true } },
    },
  });

  const maxFunnel = Math.max(1, ...ins.funnel.map((f) => f.count));
  const totalSentiment = ins.sentiment.positive + ins.sentiment.neutral + ins.sentiment.negative;
  const funnelTotal = ins.funnel.reduce((s, f) => s + f.count, 0);
  const maxActivity = Math.max(1, ...ins.activityByType.map((a) => a.count));

  // Donut: verdeling van open deals over de fases (alleen fases met deals).
  const donutStages = ins.funnel.filter((f) => f.count > 0);
  let acc = 0;
  const donutSegments = donutStages.map((f) => {
    const start = funnelTotal ? (acc / funnelTotal) * 360 : 0;
    acc += f.count;
    const end = funnelTotal ? (acc / funnelTotal) * 360 : 0;
    return { ...f, start, end, pct: funnelTotal ? Math.round((f.count / funnelTotal) * 100) : 0 };
  });
  const donutGradient = donutSegments.length
    ? `conic-gradient(${donutSegments
        .map((s) => `${HEX[s.color]} ${s.start}deg ${s.end}deg`)
        .join(", ")})`
    : "conic-gradient(#e5e7eb 0deg 360deg)";

  const hasData = ins.totalOpen > 0 || ins.wonCount > 0 || ins.lostCount > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inzichten"
        description="Terugkoppeling uit alles wat je vastlegt: waar staat de pipeline, en — belangrijker — waar liggen de zwakke punten?"
      />

      {/* KPI-cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Open deals" value={ins.totalOpen} icon={<Kanban className="h-5 w-5" />} accent="brand" />
        <StatCard label="Gewogen waarde" value={formatCurrency(ins.weightedValue)} icon={<Gauge className="h-5 w-5" />} accent="violet" />
        <StatCard label="Winkans" value={ins.winRate === null ? "—" : `${ins.winRate}%`} sub={ins.winRate === null ? "nog niets afgesloten" : `${ins.wonCount} gewonnen · ${ins.lostCount} verloren`} icon={<Trophy className="h-5 w-5" />} accent="green" />
        <StatCard label="Vastgelopen" value={ins.staleCount} icon={<Flame className="h-5 w-5" />} accent={ins.staleCount > 0 ? "red" : "slate"} />
        <StatCard label="Opvolgen te laat" value={ins.overdueFollowUps} icon={<CalendarClock className="h-5 w-5" />} accent={ins.overdueFollowUps > 0 ? "amber" : "slate"} />
        <StatCard label="Gem. leeftijd" value={`${ins.avgDealAgeDays}d`} sub="open deals" icon={<Clock className="h-5 w-5" />} accent="slate" />
      </div>

      {/* Zwakke punten */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Zwakke punten
          </CardTitle>
          {ins.weakPoints.length > 0 && (
            <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
              {ins.weakPoints.length} aandachtspunt{ins.weakPoints.length === 1 ? "" : "en"}
            </span>
          )}
        </CardHeader>
        <CardContent>
          {ins.weakPoints.length === 0 ? (
            <p className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/50 px-4 py-6 text-center text-sm text-emerald-700">
              Geen duidelijke zwakke punten — mooi bezig. Blijf contactmomenten vastleggen zodat dit betrouwbaar blijft.
            </p>
          ) : (
            <ul className="grid gap-2 md:grid-cols-2">
              {ins.weakPoints.map((wp, i) => (
                <WeakPointRow key={i} wp={wp} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Pipeline: gerangschikte balken + donut */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-ink-400" /> Pipeline per fase
            </CardTitle>
            {ins.biggestDrop && (
              <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-semibold text-red-600">
                Grootste uitval: {ins.biggestDrop.fromName} → {ins.biggestDrop.toName} ({ins.biggestDrop.dropPct}%)
              </span>
            )}
          </CardHeader>
          <CardContent>
            {funnelTotal === 0 ? (
              <p className="py-6 text-center text-sm text-ink-500">Nog geen open deals in de pipeline.</p>
            ) : (
              <ul className="space-y-3">
                {ins.funnel.map((f, i) => (
                  <li key={f.key} className="rounded-xl border border-ink-100 px-4 py-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink-100 text-[11px] font-semibold text-ink-500">
                          {i + 1}
                        </span>
                        <span className="truncate text-sm font-semibold text-ink-800">{f.name}</span>
                        {f.stalled > 0 && (
                          <span className="shrink-0 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-600">
                            {f.stalled} vastgelopen
                          </span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-3 text-xs tabular-nums text-ink-500">
                        <span>{formatCurrency(f.value)}</span>
                        <span className="w-7 text-right text-sm font-bold text-ink-900">{f.count}</span>
                      </span>
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-ink-100">
                      <div
                        className={cn("h-full rounded-full transition-all", BAR[f.color])}
                        style={{ width: `${Math.max(3, Math.round((f.count / maxFunnel) * 100))}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Donut: verdeling over fases */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PieChart className="h-4 w-4 text-ink-400" /> Verdeling
            </CardTitle>
          </CardHeader>
          <CardContent>
            {funnelTotal === 0 ? (
              <p className="py-6 text-center text-sm text-ink-500">Nog geen open deals.</p>
            ) : (
              <div className="flex flex-col items-center gap-5">
                <div
                  className="relative h-40 w-40 shrink-0 rounded-full"
                  style={{ background: donutGradient }}
                >
                  <div className="absolute inset-[22%] flex flex-col items-center justify-center rounded-full bg-white">
                    <span className="text-2xl font-bold tabular-nums text-ink-900">{funnelTotal}</span>
                    <span className="text-[11px] text-ink-400">open deals</span>
                  </div>
                </div>
                <ul className="w-full space-y-1.5">
                  {donutSegments.map((s) => (
                    <li key={s.key} className="flex items-center justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: HEX[s.color] }} />
                        <span className="truncate text-ink-700">{s.name}</span>
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums text-ink-500">{s.pct}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Conversie-trechter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-ink-400" /> Conversie-trechter
          </CardTitle>
          <span className="text-xs text-ink-400">Van open pipeline tot gewonnen deals</span>
        </CardHeader>
        <CardContent>
          {(() => {
            const steps = [
              { label: "Open deals", count: ins.totalOpen, color: "blue" as BadgeColor },
              { label: "Gewonnen", count: ins.wonCount, color: "green" as BadgeColor },
              { label: "Verloren", count: ins.lostCount, color: "red" as BadgeColor },
            ];
            const maxStep = Math.max(1, ...steps.map((s) => s.count));
            const totalClosed = ins.wonCount + ins.lostCount;
            return (
              <div className="grid gap-3 sm:grid-cols-3">
                {steps.map((s) => {
                  const denom = s.label === "Open deals" ? Math.max(1, ins.totalOpen) : Math.max(1, totalClosed);
                  const pct = s.label === "Open deals" ? 100 : totalClosed ? Math.round((s.count / totalClosed) * 100) : 0;
                  return (
                    <div key={s.label} className="rounded-xl border border-ink-100 bg-ink-50/40 p-4">
                      <div className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-sm font-medium text-ink-700">
                          <span className="h-2.5 w-2.5 rounded-full" style={{ background: HEX[s.color] }} />
                          {s.label}
                        </span>
                        <span className="text-xs font-semibold tabular-nums text-ink-400">{pct}%</span>
                      </div>
                      <p className="mt-2 text-2xl font-bold tabular-nums text-ink-900">{s.count}</p>
                      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-ink-100">
                        <div
                          className={cn("h-full rounded-full", BAR[s.color])}
                          style={{ width: `${Math.round((s.count / maxStep) * 100)}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Win / verlies */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-ink-400" /> Winnen &amp; verliezen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-3">
              <div className="flex-1 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center">
                <p className="text-2xl font-bold tabular-nums text-emerald-700">{ins.wonCount}</p>
                <p className="text-xs font-medium text-emerald-700">Gewonnen</p>
              </div>
              <div className="flex-1 rounded-xl border border-red-100 bg-red-50 p-3 text-center">
                <p className="text-2xl font-bold tabular-nums text-red-700">{ins.lostCount}</p>
                <p className="text-xs font-medium text-red-700">Verloren</p>
              </div>
              <div className="flex-1 rounded-xl border border-ink-100 bg-ink-50 p-3 text-center">
                <p className="text-2xl font-bold tabular-nums text-ink-700">{ins.winRate === null ? "—" : `${ins.winRate}%`}</p>
                <p className="text-xs font-medium text-ink-500">Winkans</p>
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Verliesredenen</p>
              {ins.lostReasons.length === 0 ? (
                <p className="text-sm text-ink-500">Nog geen verloren deals geregistreerd.</p>
              ) : (
                <ul className="space-y-2">
                  {ins.lostReasons.map((r) => {
                    const maxReason = Math.max(1, ...ins.lostReasons.map((x) => x.count));
                    return (
                      <li key={r.reason}>
                        <div className="mb-1 flex items-center justify-between text-sm">
                          <span className="truncate text-ink-700">{r.reason}</span>
                          <span className="shrink-0 font-semibold tabular-nums text-ink-500">{r.count}×</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                          <div className="h-full rounded-full bg-red-400" style={{ width: `${Math.round((r.count / maxReason) * 100)}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Relatie + activiteit */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-ink-400" /> Relatie &amp; activiteit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">Relatiegevoel (90 dagen)</p>
              {totalSentiment === 0 ? (
                <p className="text-sm text-ink-500">Nog geen gevoel vastgelegd bij contactmomenten.</p>
              ) : (
                <>
                  <div className="flex h-3 overflow-hidden rounded-full">
                    <div className="bg-emerald-400" style={{ width: `${(ins.sentiment.positive / totalSentiment) * 100}%` }} />
                    <div className="bg-ink-300" style={{ width: `${(ins.sentiment.neutral / totalSentiment) * 100}%` }} />
                    <div className="bg-red-400" style={{ width: `${(ins.sentiment.negative / totalSentiment) * 100}%` }} />
                  </div>
                  <div className="mt-1.5 flex gap-4 text-xs text-ink-500">
                    <span>😊 {ins.sentiment.positive}</span>
                    <span>😐 {ins.sentiment.neutral}</span>
                    <span>☹️ {ins.sentiment.negative}</span>
                  </div>
                </>
              )}
            </div>
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-400">
                <Activity className="h-3.5 w-3.5" /> Activiteit (30 dagen)
              </p>
              {ins.activityByType.length === 0 ? (
                <p className="text-sm text-ink-500">Nog niets vastgelegd deze maand.</p>
              ) : (
                <ul className="space-y-2">
                  {ins.activityByType.map((a) => (
                    <li key={a.type}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-ink-700">{labelFor(CRM_NOTE_TYPES, a.type)}</span>
                        <span className="font-semibold tabular-nums text-ink-500">{a.count}</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-100">
                        <div className="h-full rounded-full bg-brand-400" style={{ width: `${Math.round((a.count / maxActivity) * 100)}%` }} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent gewonnen */}
      {recentWon.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-emerald-500" /> Recent gewonnen
            </CardTitle>
          </CardHeader>
          <ul className="divide-y divide-ink-100">
            {recentWon.map((d) => {
              const company = d.client?.companyName ?? d.company;
              return (
                <li key={d.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">{d.title}</p>
                    <p className="truncate text-xs text-ink-500">
                      {company} · {formatDate(d.updatedAt)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-700">
                    {formatCurrency(d.value)}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Leaderboard (team) */}
      {scope === "all" && ins.leaderboard.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Per recruiter</CardTitle>
          </CardHeader>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Recruiter</TH>
                <TH className="text-right">Open</TH>
                <TH className="text-right">Gewonnen</TH>
                <TH className="text-right">Verloren</TH>
                <TH className="text-right">Winkans</TH>
                <TH className="text-right">Omzet gewonnen</TH>
              </TR>
            </THead>
            <TBody>
              {ins.leaderboard.map((l) => (
                <TR key={l.ownerId}>
                  <TD className="font-medium text-ink-900">{l.name}</TD>
                  <TD className="text-right tabular-nums">{l.open}</TD>
                  <TD className="text-right tabular-nums text-emerald-700">{l.won}</TD>
                  <TD className="text-right tabular-nums text-red-600">{l.lost}</TD>
                  <TD className="text-right tabular-nums">{l.winRate === null ? "—" : `${l.winRate}%`}</TD>
                  <TD className="text-right tabular-nums font-semibold">{formatCurrency(l.wonValue)}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </Card>
      )}

      {!hasData && (
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" />}
          title="Nog geen data"
          description="Zodra je deals aanmaakt en contactmomenten vastlegt, verschijnen hier de cijfers en zwakke punten."
        />
      )}
    </div>
  );
}
