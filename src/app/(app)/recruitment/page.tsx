import Link from "next/link";
import { Kanban, Users, UserCheck, ClipboardList } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import {
  DEAL_STATUSES,
  APPLICATION_STATUSES,
  DISCIPLINES,
  CANDIDATE_AVAILABLE_VALUES,
  labelFor,
} from "@/lib/domain";

export const metadata = { title: "Recruitment" };

export default async function RecruitmentPage() {
  const [
    openDeals,
    candidates,
    availableCandidates,
    openApplications,
    recentDeals,
    recentCandidates,
    recentApplications,
  ] = await Promise.all([
    db.deal.count({ where: { status: "OPEN" } }),
    db.candidate.count(),
    db.candidate.count({
      where: { availability: { in: [...CANDIDATE_AVAILABLE_VALUES] } },
    }),
    db.application.count({
      where: { status: { in: ["NEW", "SCREENING", "PROPOSED"] } },
    }),
    db.deal.findMany({
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, title: true, company: true, status: true },
    }),
    db.candidate.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, firstName: true, lastName: true, discipline: true },
    }),
    db.application.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      include: {
        candidate: { select: { firstName: true, lastName: true } },
        vacancy: { select: { title: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recruitment"
        description="Je CRM-pijplijn en relaties, plus de talentpool: kandidaten opbouwen, beschikbaarheid bijhouden en sollicitaties doorzetten. Vacatures uit MSP-platformen vind je nu in de MSP-hub."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Open deals" value={openDeals} icon={<Kanban className="h-5 w-5" />} accent="brand" />
        <StatCard label="Kandidaten" value={candidates} icon={<Users className="h-5 w-5" />} accent="violet" />
        <StatCard label="Beschikbaar" value={availableCandidates} sub="nu of binnenkort" icon={<UserCheck className="h-5 w-5" />} accent="green" />
        <StatCard label="Open sollicitaties" value={openApplications} icon={<ClipboardList className="h-5 w-5" />} accent="amber" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Recente deals (CRM-pijplijn) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Kanban className="h-4 w-4 text-brand-600" /> Recente deals
            </CardTitle>
            <Link href="/crm" className="text-xs font-medium text-brand-700 hover:underline">
              Pijplijn
            </Link>
          </CardHeader>
          <CardContent className="p-2">
            {recentDeals.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-ink-400">Nog geen deals.</p>
            ) : (
              <ul className="space-y-0.5">
                {recentDeals.map((d) => (
                  <li key={d.id}>
                    <Link
                      href={`/crm/deals/${d.id}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ink-50"
                    >
                      <span className="flex-1 truncate text-sm font-medium text-ink-800">
                        {d.title}
                        <span className="ml-1 text-xs font-normal text-ink-400">· {d.company}</span>
                      </span>
                      <StatusBadge options={DEAL_STATUSES} value={d.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recente kandidaten */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4 text-brand-600" /> Recente kandidaten
            </CardTitle>
            <Link href="/kandidaten" className="text-xs font-medium text-brand-700 hover:underline">
              Alle
            </Link>
          </CardHeader>
          <CardContent className="p-2">
            {recentCandidates.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-ink-400">Nog geen kandidaten.</p>
            ) : (
              <ul className="space-y-0.5">
                {recentCandidates.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/kandidaten/${c.id}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ink-50"
                    >
                      <span className="flex-1 truncate text-sm font-medium text-ink-800">
                        {c.firstName} {c.lastName}
                      </span>
                      <span className="shrink-0 text-xs text-ink-500">
                        {labelFor(DISCIPLINES, c.discipline)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Recente sollicitaties */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ClipboardList className="h-4 w-4 text-brand-600" /> Recente sollicitaties
            </CardTitle>
            <Link href="/sollicitaties" className="text-xs font-medium text-brand-700 hover:underline">
              Alle
            </Link>
          </CardHeader>
          <CardContent className="p-2">
            {recentApplications.length === 0 ? (
              <p className="px-2 py-6 text-center text-sm text-ink-400">Nog geen sollicitaties.</p>
            ) : (
              <ul className="space-y-0.5">
                {recentApplications.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/sollicitaties/${a.id}`}
                      className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-ink-50"
                    >
                      <span className="flex-1 truncate text-sm font-medium text-ink-800">
                        {a.candidate.firstName} {a.candidate.lastName}
                      </span>
                      <StatusBadge options={APPLICATION_STATUSES} value={a.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
