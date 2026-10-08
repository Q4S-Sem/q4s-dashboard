import Link from "next/link";
import { Plus, Briefcase, Building2, Users2, MapPin, CalendarClock, ArrowRight, Sparkles, Kanban } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants, segmentVariants } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { formatDate, cn } from "@/lib/utils";
import { DISCIPLINES, labelFor, type BadgeColor } from "@/lib/domain";
import { VacatureTabs } from "./VacatureTabs";

export const metadata = { title: "Vacatures" };
export const dynamic = "force-dynamic";

const ICOON_KNOP =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-ink-200 bg-white text-ink-600 transition-colors hover:border-ink-400 hover:text-ink-900";

/**
 * Vacatures = deals bij bedrijven, in een tab-switch:
 *  - OPEN: nog geen kandidaat gekoppeld → hier zoek je met AI de juiste persoon.
 *  - PIPELINE: een kandidaat gekoppeld → de vacature staat in de pipeline.
 * Compacte rijen met icoonknoppen en een filter per discipline.
 */
export default async function VacaturesPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; d?: string }>;
}) {
  const sp = await searchParams;
  const view = sp.view === "pipeline" ? "pipeline" : "open";
  const vak = sp.d ?? "";

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

  const inView = deals.filter((d) => (view === "pipeline" ? d.candidateId : !d.candidateId));
  const vakken = [...new Set(inView.map((d) => d.discipline).filter((x): x is string => !!x))].sort((a, b) =>
    labelFor(DISCIPLINES, a).localeCompare(labelFor(DISCIPLINES, b), "nl"),
  );
  const rows = vak ? inView.filter((d) => d.discipline === vak) : inView;
  const nu = new Date().getTime();
  const vakHref = (d: string) => `/crm/vacatures?view=${view}${d ? `&d=${d}` : ""}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vacatures"
        description="Alle vacatures op één plek: zoek met AI de juiste kandidaat, volg de pipeline en zet de vacature online op de website."
        actions={
          <Link href="/crm/vacatures/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuwe vacature
          </Link>
        }
      />

      <VacatureTabs actief={view} />

      {vakken.length > 1 && (
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-ink-50 p-1" role="group" aria-label="Filter op discipline">
          <Link href={vakHref("")} scroll={false} aria-pressed={!vak} className={segmentVariants(!vak, "h-7 text-xs")}>
            Alle disciplines
          </Link>
          {vakken.map((d) => (
            <Link key={d} href={vakHref(d)} scroll={false} aria-pressed={vak === d} className={segmentVariants(vak === d, "h-7 text-xs")}>
              {labelFor(DISCIPLINES, d)}
            </Link>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-6 w-6" />}
          title={vak ? "Geen vacatures in deze discipline" : view === "pipeline" ? "Nog geen geplaatste vacatures" : "Geen openstaande vacatures"}
          description={
            view === "pipeline"
              ? "Zodra je een kandidaat aan een vacature koppelt, verschijnt die hier én op het pipeline-bord."
              : "Leg een vacature vast of alle vacatures hebben al een kandidaat. 🎉"
          }
          action={
            view === "open" ? (
              <Link href="/crm/vacatures/nieuw" className={buttonVariants()}>
                <Plus className="h-4 w-4" /> Nieuwe vacature
              </Link>
            ) : undefined
          }
        />
      ) : (
        <Card className="divide-y divide-ink-100 overflow-hidden">
          {rows.map((k) => {
            const overdue = k.expectedCloseDate && k.expectedCloseDate.getTime() < nu;
            const kandidaat = k.candidateId ? candName.get(k.candidateId) : null;
            return (
              <div key={k.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <Link href={`/crm/vacatures/${k.id}`} className="block truncate font-semibold text-ink-900 hover:text-brand-700">
                    {k.title}
                  </Link>
                  <p className="flex items-center gap-3 truncate text-xs text-ink-500">
                    <span className="inline-flex items-center gap-1 truncate">
                      <Building2 className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                      {k.client?.companyName ?? k.company}
                    </span>
                    {k.client?.city && (
                      <span className="hidden items-center gap-1 sm:inline-flex">
                        <MapPin className="h-3 w-3 text-ink-400" /> {k.client.city}
                      </span>
                    )}
                    {kandidaat && (
                      <span className="inline-flex items-center gap-1 font-medium text-ink-700">
                        <Users2 className="h-3 w-3 text-ink-400" /> {kandidaat}
                      </span>
                    )}
                  </p>
                </div>
                {k.positions > 1 && (
                  <span className="hidden items-center gap-0.5 text-xs text-ink-500 md:inline-flex">
                    <Users2 className="h-3.5 w-3.5" /> {k.positions}
                  </span>
                )}
                {k.expectedCloseDate && (
                  <span className={cn("hidden items-center gap-1 text-xs tabular-nums md:inline-flex", overdue ? "font-semibold text-red-600" : "text-ink-400")} title="Verwachte startdatum">
                    <CalendarClock className="h-3.5 w-3.5" /> {formatDate(k.expectedCloseDate)}
                  </span>
                )}
                <div className="hidden w-32 shrink-0 justify-end sm:flex">
                  {k.discipline && <StatusBadge options={DISCIPLINES} value={k.discipline} />}
                </div>
                {view === "pipeline" && <Badge color={(k.stage.color as BadgeColor) ?? "slate"}>{k.stage.name}</Badge>}
                {view === "open" && (
                  <Link href={`/crm/vacatures/${k.id}/match`} title="Zoek match met AI" aria-label={`Zoek match voor ${k.title}`} className={ICOON_KNOP}>
                    <Sparkles className="h-4 w-4" />
                  </Link>
                )}
                {view === "pipeline" && (
                  <Link href="/crm" title="Naar de pipeline" aria-label="Naar de pipeline" className={ICOON_KNOP}>
                    <Kanban className="h-4 w-4" />
                  </Link>
                )}
                <Link href={`/crm/vacatures/${k.id}`} title="Openen" aria-label={`${k.title} openen`} className={ICOON_KNOP}>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            );
          })}
        </Card>
      )}
    </div>
  );
}
