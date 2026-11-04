import type * as React from "react";
import Link from "next/link";
import { ArrowRight, Kanban } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { SubmitButton } from "@/components/ui/submit-button";
import { afgelopen24Uur } from "@/lib/vandaag";
import { getOpenTasks } from "@/lib/activities";
import { DISCIPLINES, labelFor } from "@/lib/domain";
import { formatDate, cn } from "@/lib/utils";
import { sollicitatieNaarPipeline } from "@/app/(app)/crm/deals/actions";

export const metadata = { title: "Overzicht" };
export const dynamic = "force-dynamic";

/**
 * Overzicht voor de recruiter: alleen wat dagelijks gebruikt wordt.
 * Vier cijfers, sollicitaties om te beoordelen (met één klik als lead),
 * de pipeline per fase en de opvolging. Verder niets.
 */

const RIJEN = 8;
const teLaat = (iso: string) => new Date(iso).getTime() < Date.now();
const STIP: Record<string, string> = {
  slate: "bg-ink-400", violet: "bg-violet-500", amber: "bg-amber-500", green: "bg-emerald-500",
  emerald: "bg-emerald-500", blue: "bg-blue-500", red: "bg-red-500", cyan: "bg-cyan-500",
};

function Blok({ titel, href, linkLabel, children }: { titel: string; href: string; linkLabel: string; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-md border border-ink-200 bg-white">
      <header className="flex h-11 items-center justify-between border-b border-ink-200 px-4">
        <h2 className="text-[13px] font-semibold text-ink-900">{titel}</h2>
        <Link href={href} className="inline-flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink-900">
          {linkLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </header>
      {children}
    </section>
  );
}

const Leeg = ({ children }: { children: React.ReactNode }) => (
  <p className="px-4 py-8 text-center text-[13px] text-ink-400">{children}</p>
);

export default async function OverzichtPage() {
  const sinds24u = afgelopen24Uur();
  const [binnen, teBeoordelen, nieuweSollicitaties, online, stages, perFase, taken] = await Promise.all([
    db.candidate.count({ where: { createdAt: { gte: sinds24u } } }),
    db.application.count({ where: { status: "NEW" } }),
    db.application.findMany({
      where: { status: "NEW" },
      orderBy: { createdAt: "desc" },
      take: RIJEN,
      select: {
        id: true, createdAt: true, vacancyId: true,
        candidate: { select: { id: true, firstName: true, lastName: true, discipline: true } },
        vacancy: { select: { title: true } },
      },
    }),
    db.vacancy.count({ where: { status: "PUBLISHED" } }),
    db.crmStage.findMany({ where: { active: true }, orderBy: { order: "asc" }, select: { id: true, name: true, color: true, isLost: true } }),
    db.deal.groupBy({ by: ["stageId"], where: { status: "OPEN", candidateId: { not: null } }, _count: true }),
    getOpenTasks(),
  ]);

  const fase = new Map(perFase.map((f) => [f.stageId, f._count]));
  const inPipeline = perFase.reduce((n, f) => n + f._count, 0);
  const leads = new Set(
    (
      await db.deal.findMany({
        where: { status: "OPEN", candidateId: { in: nieuweSollicitaties.map((a) => a.candidate.id) } },
        select: { candidateId: true, vacancyId: true },
      })
    ).map((d) => `${d.candidateId}:${d.vacancyId}`),
  );
  const opvolging = taken.filter((t) => t.entityType === "candidate" || t.entityType === "application").slice(0, RIJEN);

  const cijfers = [
    { label: "Binnen (24 uur)", waarde: binnen, href: "/kandidaten" },
    { label: "Te beoordelen", waarde: teBeoordelen, href: "/sollicitaties" },
    { label: "In pipeline", waarde: inPipeline, href: "/crm" },
    { label: "Vacatures online", waarde: online, href: "/website?tab=online" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Overzicht" description="Wat er vandaag speelt. Klik door om het af te handelen." />

      <div className="grid grid-cols-2 overflow-hidden rounded-md border border-ink-200 bg-white lg:grid-cols-4">
        {cijfers.map((c, i) => (
          <Link
            key={c.label}
            href={c.href}
            className={cn("px-5 py-4 transition-colors hover:bg-ink-50", i > 0 && "border-l border-ink-200", i === 2 && "max-lg:border-l-0 max-lg:border-t", i === 3 && "max-lg:border-t")}
          >
            <p className="text-xs text-ink-500">{c.label}</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-ink-900">{c.waarde}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[3fr_2fr]">
        <Blok titel={`Sollicitaties te beoordelen (${teBeoordelen})`} href="/sollicitaties" linkLabel="Alle sollicitaties">
          {nieuweSollicitaties.length === 0 ? (
            <Leeg>Alles is beoordeeld.</Leeg>
          ) : (
            <ul className="divide-y divide-ink-100">
              {nieuweSollicitaties.map((a) => (
                <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-[13px]">
                  <div className="min-w-0 flex-1">
                    <Link href={`/kandidaten/${a.candidate.id}`} className="font-medium text-ink-900 hover:underline">
                      {a.candidate.firstName} {a.candidate.lastName}
                    </Link>
                    <p className="truncate text-xs text-ink-500">
                      {[a.vacancy?.title ?? "Open sollicitatie", a.candidate.discipline && labelFor(DISCIPLINES, a.candidate.discipline), formatDate(a.createdAt)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                  {a.vacancyId &&
                    (leads.has(`${a.candidate.id}:${a.vacancyId}`) ? (
                      <span className="text-xs font-medium text-ink-500">In pipeline</span>
                    ) : (
                      <form action={sollicitatieNaarPipeline}>
                        <input type="hidden" name="applicationId" value={a.id} />
                        <input type="hidden" name="returnTo" value="/recruitment" />
                        <SubmitButton size="sm" variant="outline" pendingLabel="…">
                          <Kanban className="h-4 w-4" /> Lead
                        </SubmitButton>
                      </form>
                    ))}
                </li>
              ))}
            </ul>
          )}
        </Blok>

        <div className="min-w-0 space-y-5">
          <Blok titel="Pipeline" href="/crm" linkLabel="Naar het bord">
            <ul className="divide-y divide-ink-100">
              {stages.map((s) => (
                <li key={s.id}>
                  <Link href="/crm" className="flex items-center gap-2.5 px-4 py-2.5 text-[13px] hover:bg-ink-50">
                    <span className={cn("h-2 w-2 rounded-full", STIP[s.color] ?? "bg-ink-400")} />
                    <span className="flex-1 text-ink-700">{s.name}</span>
                    <span className={cn("tabular-nums font-medium", fase.get(s.id) ? "text-ink-900" : "text-ink-300")}>{fase.get(s.id) ?? 0}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </Blok>

          <Blok titel="Opvolgen" href="/agenda/taken" linkLabel="Alle taken">
            {opvolging.length === 0 ? (
              <Leeg>Geen open taken.</Leeg>
            ) : (
              <ul className="divide-y divide-ink-100">
                {opvolging.map((t) => {
                  const telaat = t.dueAt && teLaat(t.dueAt);
                  return (
                    <li key={t.id}>
                      <Link href={t.href} className="block px-4 py-2.5 text-[13px] hover:bg-ink-50">
                        <span className="line-clamp-1 text-ink-900">{t.body}</span>
                        <span className="text-xs text-ink-500">
                          {t.entityLabel}
                          {t.dueAt && <span className={telaat ? "text-red-600" : ""}> · {telaat ? "te laat, " : ""}{formatDate(t.dueAt)}</span>}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Blok>
        </div>
      </div>
    </div>
  );
}
