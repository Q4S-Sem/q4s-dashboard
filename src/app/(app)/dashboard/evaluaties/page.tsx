import Link from "next/link";
import { ClipboardCheck, Star, CheckCircle2, FileText, BarChart3, PieChart } from "lucide-react";
import { db } from "@/lib/db";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { EVALUATION_STATUSES, EVALUATION_TYPES, labelFor } from "@/lib/domain";
import { averageOfScores, parseJsonMap } from "@/lib/evaluation-forms";
import { SectionCard, ActionLink, Bar, Empty } from "../_ui";

export const metadata = { title: "Evaluaties — dashboard" };
export const dynamic = "force-dynamic";

const nl1 = (n: number) =>
  n.toLocaleString("nl-NL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

function avgOf(scoresJson: string | null): number | null {
  return averageOfScores(parseJsonMap(scoresJson));
}

export default async function EvaluatiesDashboardPage() {
  const [total, definitief, concept, scoreRows, recent] = await Promise.all([
    db.evaluation.count(),
    db.evaluation.count({ where: { status: "DEFINITIEF" } }),
    db.evaluation.count({ where: { status: "CONCEPT" } }),
    db.evaluation.findMany({
      select: { year: true, quarter: true, type: true, scoresJson: true },
    }),
    db.evaluation.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        consultant: { select: { firstName: true, lastName: true } },
      },
    }),
  ]);

  // ---- Gemiddelde score (over alle evaluaties met een score) ----
  const allScores = scoreRows
    .map((e) => avgOf(e.scoresJson))
    .filter((x): x is number => x !== null);
  const overallAvg = allScores.length
    ? Math.round((allScores.reduce((s, v) => s + v, 0) / allScores.length) * 10) / 10
    : null;

  // ---- Gemiddelde score per kwartaal ("Qx YYYY") ----
  const quarterMap = new Map<
    string,
    { year: number; quarter: number; sum: number; n: number }
  >();
  for (const e of scoreRows) {
    const a = avgOf(e.scoresJson);
    if (a === null) continue;
    const key = `${e.year}-${e.quarter}`;
    const cur =
      quarterMap.get(key) ?? { year: e.year, quarter: e.quarter, sum: 0, n: 0 };
    cur.sum += a;
    cur.n += 1;
    quarterMap.set(key, cur);
  }
  const quarterBars = Array.from(quarterMap.values())
    .map((q) => ({
      label: `Q${q.quarter} ${q.year}`,
      year: q.year,
      quarter: q.quarter,
      avg: Math.round((q.sum / q.n) * 10) / 10,
    }))
    .sort((a, b) => a.year - b.year || a.quarter - b.quarter);

  // ---- Evaluaties per type ----
  const typeCounts = new Map<string, number>();
  for (const e of scoreRows) {
    typeCounts.set(e.type, (typeCounts.get(e.type) ?? 0) + 1);
  }
  const typeBars = EVALUATION_TYPES.map((t) => ({
    label: t.label,
    value: typeCounts.get(t.value) ?? 0,
  })).filter((t) => t.value > 0);
  const maxTypeCount = Math.max(1, ...typeBars.map((t) => t.value));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Evaluaties — dashboard"
        description="Inzicht in alle ingevulde evaluaties: scores, verdeling per kwartaal en per type, en de laatst ingevulde formulieren."
      />

      {/* Kerncijfers */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Aantal evaluaties"
          value={total}
          icon={<ClipboardCheck className="h-5 w-5" />}
          accent="slate"
        />
        <StatCard
          label="Gemiddelde score"
          value={overallAvg !== null ? `${nl1(overallAvg)} / 4` : "—"}
          sub={
            overallAvg !== null
              ? `over ${allScores.length} evaluatie${allScores.length === 1 ? "" : "s"}`
              : "nog geen scores"
          }
          icon={<Star className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          label="Definitief"
          value={definitief}
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          label="Concept"
          value={concept}
          icon={<FileText className="h-5 w-5" />}
          accent="amber"
        />
      </div>

      {/* Grafieken: score per kwartaal + per type */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          icon={<BarChart3 className="h-4 w-4" />}
          title="Gemiddelde score per kwartaal"
          action={<span className="hidden text-sm text-ink-400 sm:inline">schaal 1–4</span>}
        >
          {quarterBars.length === 0 ? (
            <Empty>Nog geen scores om te tonen.</Empty>
          ) : (
            <CardContent>
              <div className="space-y-3">
                {quarterBars.map((q) => (
                  <Bar
                    key={q.label}
                    label={q.label}
                    value={q.avg}
                    max={4}
                    color="green"
                    display={`${nl1(q.avg)} / 4`}
                  />
                ))}
              </div>
            </CardContent>
          )}
        </SectionCard>

        <SectionCard icon={<PieChart className="h-4 w-4" />} title="Evaluaties per type">
          {typeBars.length === 0 ? (
            <Empty>Nog geen evaluaties om te tonen.</Empty>
          ) : (
            <CardContent>
              <div className="space-y-3">
                {typeBars.map((t) => (
                  <Bar
                    key={t.label}
                    label={t.label}
                    value={t.value}
                    max={maxTypeCount}
                    color="slate"
                  />
                ))}
              </div>
            </CardContent>
          )}
        </SectionCard>
      </div>

      {/* Recente evaluaties */}
      <SectionCard
        icon={<ClipboardCheck className="h-4 w-4" />}
        title="Recente evaluaties"
        action={<ActionLink href="/evaluaties/vcu">Alle evaluaties →</ActionLink>}
      >
        {recent.length === 0 ? (
          <Empty>Nog geen evaluaties ingevuld.</Empty>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Persoon</TH>
                <TH>Type</TH>
                <TH>Periode</TH>
                <TH className="text-right">Gem. score</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {recent.map((e) => {
                const a = avgOf(e.scoresJson);
                return (
                  <TR key={e.id}>
                    <TD>
                      <Link
                        href={`/evaluaties/${e.id}`}
                        className="font-medium text-ink-900 hover:text-emerald-700"
                      >
                        {e.consultant.firstName} {e.consultant.lastName}
                      </Link>
                    </TD>
                    <TD className="text-ink-600">
                      {labelFor(EVALUATION_TYPES, e.type)}
                    </TD>
                    <TD className="whitespace-nowrap tabular-nums text-ink-600">
                      Q{e.quarter} {e.year}
                    </TD>
                    <TD className="text-right tabular-nums">
                      {a !== null ? (
                        <span className="font-medium text-ink-900">{nl1(a)} / 4</span>
                      ) : (
                        <span className="text-ink-400">—</span>
                      )}
                    </TD>
                    <TD>
                      <StatusBadge options={EVALUATION_STATUSES} value={e.status} />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}
