import Link from "next/link";
import { Plus, Briefcase, Building2, Coins, Users2, MapPin, CalendarClock, ArrowRight, Sparkles, GitBranchPlus, Kanban } from "lucide-react";
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
 * Vacatures = deals bij bedrijven. We splitsen ze in twee overzichten:
 *  - OPEN: nog geen kandidaat gekoppeld → hier zoek je met AI de juiste persoon.
 *  - GEVULD: een kandidaat gekoppeld → de vacature staat in de pipeline.
 */
export default async function VacaturesPage() {
  const deals = await db.deal.findMany({
    where: { status: "OPEN" },
    include: {
      stage: true,
      client: { select: { id: true, companyName: true, city: true } },
      vacancy: { select: { id: true, title: true } },
    },
    orderBy: [{ expectedCloseDate: "asc" }, { createdAt: "desc" }],
  });

  // Kandidaatnamen voor de gevulde vacatures ophalen (Deal.candidateId heeft geen relatie).
  const candIds = [...new Set(deals.map((d) => d.candidateId).filter((x): x is string => !!x))];
  const cands = candIds.length
    ? await db.candidate.findMany({ where: { id: { in: candIds } }, select: { id: true, firstName: true, lastName: true } })
    : [];
  const candName = new Map(cands.map((c) => [c.id, `${c.firstName} ${c.lastName}`.trim()]));

  const open = deals.filter((d) => !d.candidateId);
  const filled = deals.filter((d) => d.candidateId);

  const totalValue = open.reduce((s, k) => s + k.value, 0);
  const totalPositions = open.reduce((s, k) => s + k.positions, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vacatures"
        description="Alle vacatures bij je bedrijven. Voor de openstaande vacatures zoek je met één klik met AI de best passende kandidaat uit de talentpool; koppel je iemand, dan stroomt de vacature door naar de pipeline."
        actions={
          <Link href="/crm/vacatures/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuwe vacature
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Open vacatures" value={open.length} icon={<Briefcase className="h-5 w-5" />} accent="brand" />
        <StatCard label="Te vullen posities" value={totalPositions} icon={<Users2 className="h-5 w-5" />} accent="violet" />
        <StatCard label="In pipeline" value={filled.length} icon={<Kanban className="h-5 w-5" />} accent="green" />
        <StatCard label="Verwachte waarde" value={formatCurrency(totalValue)} icon={<Coins className="h-5 w-5" />} accent="amber" />
      </div>

      {deals.length === 0 ? (
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
        <>
          {/* OPEN vacatures — zoek hier met AI de juiste kandidaat */}
          <section className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
                Openstaand — kandidaat gezocht ({open.length})
              </h2>
            </div>

            {open.length === 0 ? (
              <Card className="p-6 text-center text-sm text-ink-500">
                Alle vacatures hebben een kandidaat. 🎉
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {open.map((k) => {
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
                          href={`/crm/vacatures/${k.id}/match`}
                          title="Laat AI de best passende kandidaten uit de talentpool zoeken"
                          className={cn(buttonVariants({ variant: "primary", size: "sm" }), "justify-center")}
                        >
                          <Sparkles className="h-4 w-4" /> Zoek match
                        </Link>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </section>

          {/* GEVULDE vacatures — kandidaat gekoppeld, staat in de pipeline */}
          {filled.length > 0 && (
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
                  Kandidaat geplaatst — in pipeline ({filled.length})
                </h2>
                <Link href="/crm" className="text-sm text-brand-700 hover:underline">
                  Naar de pipeline
                </Link>
              </div>

              <Card>
                <ul className="divide-y divide-ink-100">
                  {filled.map((k) => (
                    <li key={k.id} className="flex items-center gap-3 px-5 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                        <GitBranchPlus className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <Link href={`/crm/deals/${k.id}`} className="block truncate font-medium text-ink-900 hover:text-brand-700">
                          {k.title}
                        </Link>
                        <p className="flex items-center gap-2 truncate text-xs text-ink-500">
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3.5 w-3.5 text-ink-400" />
                            {k.client?.companyName ?? k.company}
                          </span>
                          {k.candidateId && candName.get(k.candidateId) && (
                            <span className="inline-flex items-center gap-1 font-medium text-ink-600">
                              <Users2 className="h-3 w-3 text-ink-400" /> {candName.get(k.candidateId)}
                            </span>
                          )}
                        </p>
                      </div>
                      <div className="hidden w-28 shrink-0 justify-end sm:flex">
                        {k.discipline && <StatusBadge options={DISCIPLINES} value={k.discipline} />}
                      </div>
                      <Badge color={(k.stage.color as BadgeColor) ?? "slate"}>{k.stage.name}</Badge>
                      <Link href={`/crm/deals/${k.id}`} className={cn(buttonVariants({ variant: "outline", size: "sm" }), "shrink-0")}>
                        Openen <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            </section>
          )}
        </>
      )}
    </div>
  );
}
