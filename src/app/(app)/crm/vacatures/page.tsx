import Link from "next/link";
import { Plus, Briefcase, Building2, Coins, Users2, MapPin, CalendarClock, ArrowRight, GitBranchPlus } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { DISCIPLINES, type BadgeColor } from "@/lib/domain";

export const metadata = { title: "Vacatures" };
export const dynamic = "force-dynamic";

/**
 * Vacatures = openstaande vacature-leads bij bedrijven waar (nog) GEEN kandidaat
 * aan gekoppeld is. Dit is de "voorsprong": je hoort bij een bedrijfsbezoek dat er
 * een project/vacature aankomt en legt het hier vast, vóór je iemand zoekt. Zodra
 * je een kandidaat koppelt, verschijnt de deal op het pipeline-bord.
 */
export default async function VacaturesPage() {
  const vacatures = await db.deal.findMany({
    where: { status: "OPEN", candidateId: null },
    include: {
      stage: true,
      owner: { select: { name: true } },
      client: { select: { id: true, companyName: true, city: true } },
      vacancy: { select: { id: true, title: true } },
    },
    orderBy: [{ expectedCloseDate: "asc" }, { createdAt: "desc" }],
  });

  const totalValue = vacatures.reduce((s, k) => s + k.value, 0);
  const totalPositions = vacatures.reduce((s, k) => s + k.positions, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vacatures"
        description="Bedrijven waar (binnenkort) een vacature ingevuld moet worden — je voorsprong. Leg een vacature vast na een bezoek of tip, nog vóór je een kandidaat zoekt. Koppel later een kandidaat en de vacature stroomt door naar de pipeline."
        actions={
          <Link href="/crm/vacatures/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuwe vacature
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Openstaande vacatures" value={vacatures.length} icon={<Briefcase className="h-5 w-5" />} accent="brand" />
        <StatCard label="Te vullen posities" value={totalPositions} icon={<Users2 className="h-5 w-5" />} accent="violet" />
        <StatCard label="Verwachte waarde" value={formatCurrency(totalValue)} icon={<Coins className="h-5 w-5" />} accent="green" />
      </div>

      {vacatures.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-6 w-6" />}
          title="Nog geen vacatures"
          description="Leg je eerste vacature vast: een bedrijf waar een vacature aankomt. Zo mis je geen voorsprong meer."
          action={
            <Link href="/crm/vacatures/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe vacature
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {vacatures.map((k) => {
            const overdue = k.expectedCloseDate && k.expectedCloseDate.getTime() < Date.now();
            return (
              <Card key={k.id} className="flex flex-col p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <Link href={`/crm/deals/${k.id}`} className="block truncate font-semibold text-ink-900 hover:text-brand-700">
                      {k.title}
                    </Link>
                    <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-500">
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                      {k.client ? (
                        <Link href={`/opdrachtgevers/${k.client.id}`} className="truncate hover:text-brand-700">
                          {k.client.companyName}
                        </Link>
                      ) : (
                        <span className="truncate">{k.company}</span>
                      )}
                    </p>
                  </div>
                  <Badge color={(k.stage.color as BadgeColor) ?? "slate"}>{k.stage.name}</Badge>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {k.discipline && <StatusBadge options={DISCIPLINES} value={k.discipline} />}
                  {k.positions > 1 && (
                    <span className="inline-flex items-center gap-0.5 text-xs text-ink-500">
                      <Users2 className="h-3.5 w-3.5" /> {k.positions} posities
                    </span>
                  )}
                  {k.value > 0 && (
                    <span className="text-xs font-semibold tabular-nums text-ink-700">{formatCurrency(k.value)}</span>
                  )}
                </div>

                {k.vacancy && (
                  <p className="mt-2 flex items-center gap-1.5 truncate text-xs text-ink-500">
                    <Briefcase className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                    <Link href={`/vacatures/${k.vacancy.id}`} className="truncate hover:text-brand-700">
                      {k.vacancy.title}
                    </Link>
                  </p>
                )}

                <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-100 pt-2.5 text-[11px] text-ink-400">
                  <span className="inline-flex items-center gap-1 truncate">
                    {k.client?.city && (
                      <>
                        <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{k.client.city}</span>
                      </>
                    )}
                  </span>
                  {k.expectedCloseDate && (
                    <span className={cn("inline-flex items-center gap-0.5", overdue ? "font-semibold text-red-600" : "")} title="Verwachte startdatum">
                      <CalendarClock className="h-3 w-3" /> {formatDate(k.expectedCloseDate)}
                    </span>
                  )}
                </div>

                <div className="mt-2.5 flex items-center gap-2">
                  <Link
                    href={`/crm/deals/${k.id}`}
                    className={cn(buttonVariants({ variant: "outline", size: "sm" }), "flex-1 justify-center")}
                  >
                    Openen <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                  <Link
                    href="/kandidaten"
                    title="Koppel een kandidaat uit de talentpool"
                    className={cn(buttonVariants({ variant: "primary", size: "sm" }), "justify-center")}
                  >
                    <GitBranchPlus className="h-4 w-4" /> Kandidaat
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
