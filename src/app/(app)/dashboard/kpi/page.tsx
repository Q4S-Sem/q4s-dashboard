import {
  Megaphone,
  Users,
  CalendarClock,
  ClipboardList,
  Filter,
  TrendingUp,
  Target,
  BellRing,
} from "lucide-react";
import { db } from "@/lib/db";
import { CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { APPLICATION_STATUSES } from "@/lib/domain";
import { formatDate, formatHours, formatPercent } from "@/lib/utils";
import { buildRecruitmentKpis } from "@/lib/recruitment-kpi";
import { SectionCard, ActionLink, Bar, Empty } from "../_ui";

export const metadata = { title: "Recruitment-KPI's — dashboard" };
export const dynamic = "force-dynamic";

/**
 * Management-overzicht van de recruitment-KPI's en de knelpunten daarin.
 * ALLEEN-LEZEN: deze pagina haalt records op en rekent; er wordt niets gewijzigd,
 * verstuurd of van status veranderd. Het rekenwerk staat in src/lib/recruitment-kpi.ts.
 */
export default async function RecruitmentKpiPage() {
  const [applications, vacancies, candidates] = await Promise.all([
    db.application.findMany({
      select: { id: true, status: true, createdAt: true, updatedAt: true },
    }),
    db.vacancy.findMany({ select: { id: true, status: true } }),
    db.candidate.findMany({ select: { id: true, availability: true, updatedAt: true } }),
  ]);

  const kpis = buildRecruitmentKpis({
    now: new Date(),
    applications,
    vacancies,
    candidates,
  });
  const { funnel, timeToPlace, capacity, stalled, bottleneck, slowestStage, labels } = kpis;
  const reachedMax = Math.max(0, ...funnel.stages.map((s) => s.reached));

  return (
    <div className="space-y-8">
      <p className="-mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-500">
        Kerncijfers en knelpunten van de recruitment-pijplijn: waar sollicitaties blijven hangen, hoe lang
        een plaatsing duurt en wat er zonder opvolging ligt. Alleen-lezen — er wordt hier niets gewijzigd.
        Peildatum: {formatDate(kpis.generatedAt)}.
      </p>

      {/* Kerncijfers */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={labels.openVacancies}
          value={capacity.openVacancies}
          sub={`${capacity.activeCandidates} ${labels.activeCandidates.toLowerCase()}`}
          icon={<Megaphone className="h-5 w-5" />}
          accent="slate"
        />
        <StatCard
          label={labels.candidatesPerOpenVacancy}
          value={formatHours(capacity.candidatesPerOpenVacancy)}
          sub={
            capacity.openVacancies === 0
              ? "Geen gepubliceerde vacatures"
              : `${capacity.activeCandidates} kandidaten op ${capacity.openVacancies} vacature(s)`
          }
          icon={<Users className="h-5 w-5" />}
          accent="violet"
        />
        <StatCard
          label={labels.timeToPlace}
          value={`${formatHours(timeToPlace.averageDays)} dgn`}
          sub={`Mediaan ${formatHours(timeToPlace.medianDays)} dagen · ${timeToPlace.placed} geplaatst`}
          icon={<CalendarClock className="h-5 w-5" />}
          accent="brand"
        />
        <StatCard
          label="Sollicitaties in de pijplijn"
          value={funnel.inPipeline}
          sub={`${funnel.rejected.count} ${labels.rejected.toLowerCase()} (${formatPercent(funnel.rejected.share)} van ${funnel.total})`}
          icon={<ClipboardList className="h-5 w-5" />}
          accent="green"
        />
      </div>

      {/* Funnel + doorstroom per fase */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          icon={<Filter className="h-4 w-4" />}
          title={labels.funnel}
          action={<ActionLink href="/sollicitaties">Alle sollicitaties →</ActionLink>}
        >
          {funnel.inPipeline === 0 ? (
            <Empty>Nog geen sollicitaties in de pijplijn.</Empty>
          ) : (
            <CardContent className="space-y-3">
              {funnel.stages.map((s) => (
                <Bar
                  key={s.status}
                  label={s.label}
                  value={s.reached}
                  max={reachedMax}
                  color={s.color}
                  display={`${s.reached} bereikt · ${s.current} nu`}
                />
              ))}
              <p className="pt-1 text-xs leading-relaxed text-ink-400">
                {labels.reached} = het aantal sollicitaties in deze fase plus alle latere fasen. Afgewezen
                sollicitaties tellen niet mee: hun laatst bereikte fase is niet vastgelegd.
              </p>
            </CardContent>
          )}
        </SectionCard>

        <SectionCard icon={<TrendingUp className="h-4 w-4" />} title={labels.conversion}>
          {funnel.inPipeline === 0 ? (
            <Empty>Nog geen doorstroom te berekenen.</Empty>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Fase</TH>
                  <TH className="text-right">Nu</TH>
                  <TH className="text-right">Bereikt</TH>
                  <TH className="text-right">Doorstroom</TH>
                  <TH className="text-right">Gem. dagen</TH>
                </TR>
              </THead>
              <TBody>
                {funnel.stages.map((s) => (
                  <TR key={s.status}>
                    <TD>
                      <StatusBadge options={APPLICATION_STATUSES} value={s.status} />
                      <span className="mt-1 block text-xs text-ink-400">{s.conversionLabel}</span>
                    </TD>
                    <TD className="text-right tabular-nums">{s.current}</TD>
                    <TD className="text-right tabular-nums">{s.reached}</TD>
                    <TD className="text-right tabular-nums">
                      {s.conversionRate === null ? "—" : formatPercent(s.conversionRate)}
                    </TD>
                    <TD className="text-right tabular-nums">{formatHours(s.avgDaysInStage)}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </SectionCard>
      </div>

      {/* Knelpunten */}
      <SectionCard icon={<Target className="h-4 w-4" />} title="Knelpunten in de pijplijn">
        {!bottleneck && !slowestStage ? (
          <Empty>Nog te weinig sollicitaties om een knelpunt aan te wijzen.</Empty>
        ) : (
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-sm border border-ink-200 bg-ink-50/60 p-4">
              <p className="q4s-label">{labels.bottleneck}</p>
              {bottleneck ? (
                <>
                  <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-ink-900">
                    {bottleneck.fromLabel} → {bottleneck.label}
                    <span className="tabular-nums text-rose-600">
                      {formatPercent(bottleneck.conversionRate)}
                    </span>
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-500">{bottleneck.reason}</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-ink-400">Nog geen doorstroom te berekenen.</p>
              )}
            </div>
            <div className="rounded-sm border border-ink-200 bg-ink-50/60 p-4">
              <p className="q4s-label">{labels.slowestStage}</p>
              {slowestStage ? (
                <>
                  <p className="mt-2 flex items-center gap-2 text-lg font-semibold text-ink-900">
                    {slowestStage.label}
                    <span className="tabular-nums text-amber-600">
                      {formatHours(slowestStage.avgDaysInStage)} dagen
                    </span>
                  </p>
                  <p className="mt-2 text-sm leading-relaxed text-ink-500">{slowestStage.reason}</p>
                </>
              ) : (
                <p className="mt-2 text-sm text-ink-400">Geen open sollicitaties in de pijplijn.</p>
              )}
            </div>
          </CardContent>
        )}
      </SectionCard>

      {/* Zonder opvolging */}
      <SectionCard
        icon={<BellRing className="h-4 w-4" />}
        title="Zonder opvolging"
        action={<ActionLink href="/dashboard/automatisering">Automatische acties →</ActionLink>}
      >
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <StatCard
              label={labels.stalledCandidates}
              value={stalled.candidates}
              sub={`Langer dan ${stalled.candidateThresholdDays} dagen niet bijgewerkt`}
              icon={<Users className="h-5 w-5" />}
              accent={stalled.candidates > 0 ? "amber" : "slate"}
            />
            <StatCard
              label={labels.stalledApplications}
              value={stalled.applications}
              sub={`Langer dan ${stalled.applicationThresholdDays} dagen niet bijgewerkt`}
              icon={<ClipboardList className="h-5 w-5" />}
              accent={stalled.applications > 0 ? "amber" : "slate"}
            />
          </div>
          <p className="text-xs leading-relaxed text-ink-400">
            Dezelfde drempels als de automatische-acties-regels &ldquo;Kandidaat zonder recruiter-opvolging&rdquo;
            en &ldquo;Sollicitatie zonder recruiter-opvolging&rdquo;. Alleen open sollicitaties (Nieuw, Screening,
            Voorgesteld) tellen mee.
          </p>
        </CardContent>
      </SectionCard>
    </div>
  );
}
