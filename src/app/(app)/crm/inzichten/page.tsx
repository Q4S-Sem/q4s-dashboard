import Link from "next/link";
import {
  ArrowLeft,
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
} from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatCurrency, cn } from "@/lib/utils";
import { CRM_NOTE_TYPES, labelFor, type BadgeColor } from "@/lib/domain";
import { isAIConfigured } from "@/lib/ai";
import { currentRecruiterId, getCrmSettings, getInsights, type WeakPoint } from "@/lib/crm";
import { AiAnalysis } from "./AiAnalysis";

export const metadata = { title: "CRM-inzichten" };
export const dynamic = "force-dynamic";

const BAR: Record<BadgeColor, string> = {
  slate: "bg-slate-300",
  blue: "bg-blue-400",
  green: "bg-emerald-400",
  amber: "bg-amber-400",
  red: "bg-red-400",
  violet: "bg-violet-400",
  cyan: "bg-cyan-400",
};

function WeakPointRow({ wp }: { wp: WeakPoint }) {
  const map = {
    high: { ring: "border-red-200 bg-red-50", text: "text-red-700", Icon: AlertTriangle },
    medium: { ring: "border-amber-200 bg-amber-50", text: "text-amber-800", Icon: AlertCircle },
    low: { ring: "border-slate-200 bg-slate-50", text: "text-slate-600", Icon: Info },
  }[wp.severity];
  const Icon = map.Icon;
  return (
    <li className={cn("flex gap-3 rounded-lg border p-3", map.ring)}>
      <Icon className={cn("mt-0.5 h-5 w-5 shrink-0", map.text)} />
      <div>
        <p className={cn("text-sm font-semibold", map.text)}>{wp.title}</p>
        <p className="mt-0.5 text-sm text-slate-600">{wp.detail}</p>
      </div>
    </li>
  );
}

export default async function InzichtenPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string }>;
}) {
  const sp = await searchParams;
  const recruiterId = await currentRecruiterId();
  const settings = await getCrmSettings(recruiterId);
  const scope: "mine" | "all" =
    sp.scope === "all" || sp.scope === "mine" ? sp.scope : settings.defaultScope;

  const ins = await getInsights({ recruiterId, scope, staleAfterDays: settings.staleAfterDays });
  const maxFunnel = Math.max(1, ...ins.funnel.map((f) => f.count));
  const totalSentiment = ins.sentiment.positive + ins.sentiment.neutral + ins.sentiment.negative;

  const scopeTab = (value: "mine" | "all", label: string) => (
    <Link
      href={`/crm/inzichten?scope=${value}`}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        scope === value ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-6">
      <Link href="/crm" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Terug naar CRM
      </Link>

      <PageHeader
        title="Inzichten"
        description="Terugkoppeling uit alles wat je vastlegt: waar staat de pipeline, en — belangrijker — waar liggen de zwakke punten?"
      />

      <div className="inline-flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        {scopeTab("mine", "Mijn cijfers")}
        {scopeTab("all", "Team")}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Open deals" value={ins.totalOpen} icon={<Kanban className="h-5 w-5" />} accent="brand" />
        <StatCard label="Gewogen waarde" value={formatCurrency(ins.weightedValue)} icon={<Gauge className="h-5 w-5" />} accent="violet" />
        <StatCard label="Winkans" value={ins.winRate === null ? "—" : `${ins.winRate}%`} icon={<Trophy className="h-5 w-5" />} accent="green" />
        <StatCard label="Vastgelopen" value={ins.staleCount} icon={<Flame className="h-5 w-5" />} accent={ins.staleCount > 0 ? "red" : "slate"} />
        <StatCard label="Opvolgen te laat" value={ins.overdueFollowUps} icon={<CalendarClock className="h-5 w-5" />} accent={ins.overdueFollowUps > 0 ? "amber" : "slate"} />
        <StatCard label="Gem. leeftijd" value={`${ins.avgDealAgeDays}d`} sub="open deals" icon={<Clock className="h-5 w-5" />} accent="slate" />
      </div>

      {/* Weak points — the centrepiece */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" /> Zwakke punten
          </CardTitle>
        </CardHeader>
        <CardContent>
          {ins.weakPoints.length === 0 ? (
            <p className="rounded-lg border border-dashed border-emerald-200 bg-emerald-50/50 px-4 py-6 text-center text-sm text-emerald-700">
              Geen duidelijke zwakke punten — mooi bezig. Blijf contactmomenten vastleggen zodat dit betrouwbaar blijft.
            </p>
          ) : (
            <ul className="space-y-2">
              {ins.weakPoints.map((wp, i) => (
                <WeakPointRow key={i} wp={wp} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Funnel */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-slate-400" /> Pipeline per fase
          </CardTitle>
          {ins.biggestDrop && (
            <span className="text-xs text-red-600">
              Grootste uitval: {ins.biggestDrop.fromName} → {ins.biggestDrop.toName} ({ins.biggestDrop.dropPct}%)
            </span>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {ins.funnel.length === 0 ? (
            <p className="text-sm text-slate-500">Nog geen open deals.</p>
          ) : (
            ins.funnel.map((f) => (
              <div key={f.key}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{f.name}</span>
                  <span className="flex items-center gap-3 text-xs text-slate-500 tabular-nums">
                    {f.stalled > 0 && <span className="text-red-500">{f.stalled} vastgelopen</span>}
                    <span>{formatCurrency(f.value)}</span>
                    <span className="w-6 text-right font-semibold text-slate-700">{f.count}</span>
                  </span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn("h-full rounded-full", BAR[f.color])}
                    style={{ width: `${Math.round((f.count / maxFunnel) * 100)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Win / loss */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-slate-400" /> Winnen &amp; verliezen
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-1 rounded-lg bg-emerald-50 p-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">{ins.wonCount}</p>
                <p className="text-xs text-emerald-700">Gewonnen</p>
              </div>
              <div className="flex-1 rounded-lg bg-red-50 p-3 text-center">
                <p className="text-2xl font-bold text-red-700">{ins.lostCount}</p>
                <p className="text-xs text-red-700">Verloren</p>
              </div>
              <div className="flex-1 rounded-lg bg-slate-50 p-3 text-center">
                <p className="text-2xl font-bold text-slate-700">{ins.winRate === null ? "—" : `${ins.winRate}%`}</p>
                <p className="text-xs text-slate-500">Winkans</p>
              </div>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Verliesredenen</p>
              {ins.lostReasons.length === 0 ? (
                <p className="text-sm text-slate-500">Nog geen verloren deals geregistreerd.</p>
              ) : (
                <ul className="space-y-1.5">
                  {ins.lostReasons.map((r) => (
                    <li key={r.reason} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{r.reason}</span>
                      <span className="font-semibold tabular-nums text-slate-500">{r.count}×</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Relations + activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-slate-400" /> Relatie &amp; activiteit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">Relatiegevoel (90 dagen)</p>
              {totalSentiment === 0 ? (
                <p className="text-sm text-slate-500">Nog geen gevoel vastgelegd bij contactmomenten.</p>
              ) : (
                <div className="flex h-3 overflow-hidden rounded-full">
                  <div className="bg-emerald-400" style={{ width: `${(ins.sentiment.positive / totalSentiment) * 100}%` }} />
                  <div className="bg-slate-300" style={{ width: `${(ins.sentiment.neutral / totalSentiment) * 100}%` }} />
                  <div className="bg-red-400" style={{ width: `${(ins.sentiment.negative / totalSentiment) * 100}%` }} />
                </div>
              )}
              {totalSentiment > 0 && (
                <div className="mt-1.5 flex gap-4 text-xs text-slate-500">
                  <span>😊 {ins.sentiment.positive}</span>
                  <span>😐 {ins.sentiment.neutral}</span>
                  <span>☹️ {ins.sentiment.negative}</span>
                </div>
              )}
            </div>
            <div>
              <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <Activity className="h-3.5 w-3.5" /> Activiteit (30 dagen)
              </p>
              {ins.activityByType.length === 0 ? (
                <p className="text-sm text-slate-500">Nog niets vastgelegd deze maand.</p>
              ) : (
                <ul className="space-y-1.5">
                  {ins.activityByType.map((a) => (
                    <li key={a.type} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">{labelFor(CRM_NOTE_TYPES, a.type)}</span>
                      <span className="font-semibold tabular-nums text-slate-500">{a.count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

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
                  <TD className="font-medium text-slate-900">{l.name}</TD>
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

      {/* AI analysis */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">AI-analyse</CardTitle>
        </CardHeader>
        <CardContent>
          <AiAnalysis scope={scope} configured={isAIConfigured()} />
        </CardContent>
      </Card>

      {ins.totalOpen === 0 && ins.wonCount === 0 && ins.lostCount === 0 && (
        <EmptyState
          icon={<BarChart3 className="h-6 w-6" />}
          title="Nog geen data"
          description="Zodra je deals aanmaakt en contactmomenten vastlegt, verschijnen hier de cijfers en zwakke punten."
        />
      )}
    </div>
  );
}
