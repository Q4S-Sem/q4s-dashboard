import Link from "next/link";
import {
  Megaphone,
  Users,
  ClipboardList,
  UserCheck,
  Filter,
  HardHat,
  Star,
  Eye,
} from "lucide-react";
import { db } from "@/lib/db";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import {
  APPLICATION_STATUSES,
  CANDIDATE_RATINGS,
  DISCIPLINES,
  VACANCY_STATUSES,
} from "@/lib/domain";
import { SectionCard, ActionLink, Bar, Empty } from "../_ui";

export const metadata = { title: "Recruitment — dashboard" };
export const dynamic = "force-dynamic";

export default async function RecruitmentDashboardPage() {
  const [
    vacanciesTotal,
    vacanciesPublished,
    candidatesTotal,
    applicationsTotal,
    applicationsPlaced,
    applicationsByStatus,
    candidatesByDiscipline,
    candidatesByRating,
    topVacancies,
  ] = await Promise.all([
    db.vacancy.count(),
    db.vacancy.count({ where: { status: "PUBLISHED" } }),
    db.candidate.count(),
    db.application.count(),
    db.application.count({ where: { status: "PLACED" } }),
    db.application.groupBy({ by: ["status"], _count: { _all: true } }),
    db.candidate.groupBy({ by: ["discipline"], _count: { _all: true } }),
    db.candidate.groupBy({ by: ["rating"], _count: { _all: true } }),
    db.vacancy.findMany({
      orderBy: [{ views: "desc" }, { createdAt: "desc" }],
      take: 8,
      select: {
        id: true,
        title: true,
        status: true,
        views: true,
        _count: { select: { applications: true } },
      },
    }),
  ]);

  // ---- Sollicitatie-funnel (per Application.status, vaste volgorde) ----
  const appCountByStatus: Record<string, number> = {};
  for (const row of applicationsByStatus) {
    appCountByStatus[row.status] = row._count._all;
  }
  const funnel = APPLICATION_STATUSES.map((s) => ({
    label: s.label,
    color: s.color ?? "slate",
    value: appCountByStatus[s.value] ?? 0,
  }));
  const funnelMax = Math.max(0, ...funnel.map((f) => f.value));

  // ---- Kandidaten per discipline (null = "Onbekend") ----
  const discMap: Record<string, number> = {};
  for (const row of candidatesByDiscipline) {
    const key = row.discipline ?? "__none__";
    discMap[key] = (discMap[key] ?? 0) + row._count._all;
  }
  const disciplineRows = [
    ...DISCIPLINES.map((d) => ({
      label: d.label,
      color: d.color ?? "slate",
      value: discMap[d.value] ?? 0,
    })),
    {
      label: "Onbekend",
      color: "slate",
      value: discMap["__none__"] ?? 0,
    },
  ]
    .filter((r) => r.value > 0)
    .sort((a, b) => b.value - a.value);
  const disciplineMax = Math.max(0, ...disciplineRows.map((r) => r.value));

  // ---- Kandidaten per rangschikking (per Candidate.rating) ----
  const ratingMap: Record<string, number> = {};
  for (const row of candidatesByRating) {
    ratingMap[row.rating] = row._count._all;
  }
  const ratingRows = CANDIDATE_RATINGS.map((r) => ({
    value: r.value,
    label: r.label,
    color: r.color ?? "slate",
    count: ratingMap[r.value] ?? 0,
  }));
  const ratingMax = Math.max(0, ...ratingRows.map((r) => r.count));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Recruitment — dashboard"
        description="Sollicitatie-funnel, kandidaten en best presterende vacatures. Alles gekoppeld aan de operationele pagina's."
      />

      {/* Kerncijfers */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Vacatures"
          value={vacanciesTotal}
          sub={`${vacanciesPublished} gepubliceerd`}
          icon={<Megaphone className="h-5 w-5" />}
          accent="slate"
        />
        <StatCard
          label="Kandidaten"
          value={candidatesTotal}
          icon={<Users className="h-5 w-5" />}
          accent="slate"
        />
        <StatCard
          label="Sollicitaties"
          value={applicationsTotal}
          icon={<ClipboardList className="h-5 w-5" />}
          accent="slate"
        />
        <StatCard
          label="Geplaatst"
          value={applicationsPlaced}
          icon={<UserCheck className="h-5 w-5" />}
          accent="green"
        />
      </div>

      {/* Funnel + kandidaten per discipline */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          icon={<Filter className="h-4 w-4" />}
          title="Sollicitatie-funnel"
          action={<ActionLink href="/sollicitaties">Alle sollicitaties →</ActionLink>}
        >
          {funnelMax === 0 ? (
            <Empty>Nog geen sollicitaties.</Empty>
          ) : (
            <CardContent className="space-y-3">
              {funnel.map((f) => (
                <Bar
                  key={f.label}
                  label={f.label}
                  value={f.value}
                  max={funnelMax}
                  color={f.color}
                />
              ))}
            </CardContent>
          )}
        </SectionCard>

        <SectionCard
          icon={<HardHat className="h-4 w-4" />}
          title="Kandidaten per discipline"
          action={<ActionLink href="/kandidaten">Talentpool →</ActionLink>}
        >
          {disciplineRows.length === 0 ? (
            <Empty>Nog geen kandidaten.</Empty>
          ) : (
            <CardContent className="space-y-3">
              {disciplineRows.map((r) => (
                <Bar
                  key={r.label}
                  label={r.label}
                  value={r.value}
                  max={disciplineMax}
                  color={r.color}
                />
              ))}
            </CardContent>
          )}
        </SectionCard>
      </div>

      {/* Kandidaten per rangschikking */}
      <SectionCard
        icon={<Star className="h-4 w-4" />}
        title="Kandidaten per rangschikking"
      >
        {ratingMax === 0 ? (
          <Empty>Nog geen kandidaten beoordeeld.</Empty>
        ) : (
          <CardContent>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-3">
                {ratingRows.map((r) => (
                  <Bar
                    key={r.value}
                    label={r.label}
                    value={r.count}
                    max={ratingMax}
                    color={r.color}
                  />
                ))}
              </div>
              <div className="flex flex-wrap content-start gap-2">
                {ratingRows.map((r) => (
                  <span
                    key={r.value}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-sm"
                  >
                    <StatusBadge options={CANDIDATE_RATINGS} value={r.value} />
                    <span className="font-medium tabular-nums text-slate-900">
                      {r.count}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          </CardContent>
        )}
      </SectionCard>

      {/* Best bekeken vacatures */}
      <SectionCard
        icon={<Eye className="h-4 w-4" />}
        title="Best bekeken vacatures"
        action={<ActionLink href="/vacatures">Vacatures maken →</ActionLink>}
      >
        {topVacancies.length === 0 ? (
          <Empty>Nog geen vacatures.</Empty>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Vacature</TH>
                <TH className="text-right">Sollicitaties</TH>
                <TH className="text-right">Weergaven</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {topVacancies.map((v) => (
                <TR key={v.id}>
                  <TD>
                    <Link
                      href={`/vacatures/${v.id}`}
                      className="font-medium text-slate-900 hover:text-emerald-700"
                    >
                      {v.title}
                    </Link>
                  </TD>
                  <TD className="text-right tabular-nums">
                    {v._count.applications}
                  </TD>
                  <TD className="text-right tabular-nums">
                    {v.views.toLocaleString("nl-NL")}
                  </TD>
                  <TD>
                    <StatusBadge options={VACANCY_STATUSES} value={v.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </SectionCard>
    </div>
  );
}