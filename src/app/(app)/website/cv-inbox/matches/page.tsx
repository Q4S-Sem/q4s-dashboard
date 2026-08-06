import Link from "next/link";
import {
  ArrowLeft,
  Target,
  Sparkles,
  Upload,
  Phone,
  Search,
  X,
  CheckCircle2,
  ArrowRight,
  Clock,
  Briefcase,
  Users2,
} from "lucide-react";
import { db } from "@/lib/db";
import { Avatar } from "@/components/ui/avatar";
import { person } from "@/lib/people";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { cn, formatDate } from "@/lib/utils";
import { DISCIPLINES, CANDIDATE_AVAILABILITY, VACANCY_STATUSES, labelFor } from "@/lib/domain";
import { isAIConfigured } from "@/lib/ai";
import { runCvMatching, searchMatchesForVacancy, stopSourcing, convertCvToLead } from "../../actions";

export const metadata = { title: "CV-matches" };
export const dynamic = "force-dynamic";

function telHref(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, "");
  return digits.replace(/[^\d]/g, "").length >= 6 ? `tel:${digits}` : null;
}
function scoreClass(pct: number): string {
  if (pct >= 70) return "bg-emerald-100 text-emerald-800";
  if (pct >= 50) return "bg-amber-100 text-amber-800";
  return "bg-ink-100 text-ink-600";
}

export default async function CvMatchesPage({
  searchParams,
}: {
  searchParams: Promise<{ matched?: string }>;
}) {
  const { matched } = await searchParams;
  const aiOn = isAIConfigured();

  const searches = await db.vacancy.findMany({
    where: { sourcing: true },
    orderBy: [{ lastMatchedAt: "desc" }, { updatedAt: "desc" }],
    select: {
      id: true,
      title: true,
      discipline: true,
      location: true,
      status: true,
      lastMatchedAt: true,
      _count: { select: { matches: true } },
      matches: {
        orderBy: { score: "desc" },
        take: 12,
        select: {
          id: true,
          score: true,
          reason: true,
          candidate: {
            select: { id: true, firstName: true, lastName: true, phone: true, discipline: true, availability: true, photoFileName: true },
          },
        },
      },
    },
  });

  // Welke gematchte kandidaten zitten al als deal in het CRM?
  const candIds = [...new Set(searches.flatMap((s) => s.matches.map((m) => m.candidate.id)))];
  const deals = candIds.length
    ? await db.deal.findMany({
        where: { candidateId: { in: candIds } },
        select: { id: true, candidateId: true },
        orderBy: { createdAt: "desc" },
      })
    : [];
  const dealByCand = new Map<string, string>();
  for (const d of deals) if (d.candidateId && !dealByCand.has(d.candidateId)) dealByCand.set(d.candidateId, d.id);

  const totalMatches = searches.reduce((s, v) => s + v._count.matches, 0);
  const strong = searches.reduce((s, v) => s + v.matches.filter((m) => m.score >= 0.7).length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="CV-matches"
        description="Je actieve zoekopdrachten. Zet op een vacature “Ik zoek kandidaten” en die komt hier te staan. Klik op “Zoek match” en de AI zoekt de best passende kandidaten uit je CV-database — bel ze of zet ze met één klik als lead in het CRM."
        actions={
          <>
            <Link href="/website/vacatures" className={buttonVariants({ variant: "outline" })}>
              <Briefcase className="h-4 w-4" /> Vacatures
            </Link>
            {searches.length > 0 && (
              <form action={runCvMatching}>
                <SubmitButton pendingLabel="Matchen…">
                  <Sparkles className="h-4 w-4" /> Zoek alle matches
                </SubmitButton>
              </form>
            )}
          </>
        }
      />

      {matched !== undefined && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          Matches bijgewerkt{aiOn ? " met AI-verfijning" : ""}.
        </p>
      )}
      {!aiOn && searches.length > 0 && (
        <p className="rounded-lg bg-ink-50 px-4 py-3 text-xs text-ink-500">
          AI is niet ingesteld — matches zijn op basis van discipline, trefwoorden en regio. Met een AI-sleutel worden ze
          verfijnd op de vacature-eisen.
        </p>
      )}

      {searches.length === 0 ? (
        <Card>
          <div className="p-2">
            <EmptyState
              icon={<Target className="h-6 w-6" />}
              title="Nog geen zoekopdrachten"
              description="Ga naar een vacature en klik op “Ik zoek kandidaten”. De vacature komt dan hier te staan en je kunt met één klik de best passende CV's uit je database zoeken."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Link href="/website/vacatures" className={buttonVariants()}>
                    <Briefcase className="h-4 w-4" /> Naar vacatures
                  </Link>
                  <Link href="/website/cv-inbox/importeren" className={buttonVariants({ variant: "outline" })}>
                    <Upload className="h-4 w-4" /> CV's importeren
                  </Link>
                </div>
              }
            />
          </div>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Zoekopdrachten" value={searches.length} icon={<Search className="h-5 w-5" />} accent="brand" />
            <StatCard label="Matches totaal" value={totalMatches} icon={<Target className="h-5 w-5" />} accent="violet" />
            <StatCard label="Sterke matches" value={strong} sub="≥ 70% (top 12/zoekopdracht)" icon={<Sparkles className="h-5 w-5" />} accent="green" />
          </div>

          <div className="space-y-5">
            {searches.map((v) => {
              const disc = v.discipline ? labelFor(DISCIPLINES, v.discipline) : null;
              return (
                <Card key={v.id} className="overflow-hidden">
                  {/* Kaartkop: vacature + acties */}
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-ink-100 px-5 py-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link href={`/vacatures/${v.id}`} className="text-base font-semibold text-ink-900 hover:text-brand-700">
                          {v.title}
                        </Link>
                        <StatusBadge options={VACANCY_STATUSES} value={v.status} />
                      </div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                        {disc && <span>{disc}</span>}
                        {v.location && <span>{v.location}</span>}
                        <span className="inline-flex items-center gap-1">
                          <Users2 className="h-3.5 w-3.5" /> {v._count.matches} kandidaten
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {v.lastMatchedAt ? `laatst gezocht ${formatDate(v.lastMatchedAt)}` : "nog niet gezocht"}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <form action={searchMatchesForVacancy}>
                        <input type="hidden" name="vacancyId" value={v.id} />
                        <SubmitButton size="sm" pendingLabel="Zoeken…">
                          <Search className="h-4 w-4" /> Zoek match
                        </SubmitButton>
                      </form>
                      <form action={stopSourcing}>
                        <input type="hidden" name="vacancyId" value={v.id} />
                        <SubmitButton size="sm" variant="ghost" pendingLabel="…">
                          <X className="h-4 w-4" /> Stop
                        </SubmitButton>
                      </form>
                    </div>
                  </div>

                  {/* Kandidaten */}
                  {v.matches.length === 0 ? (
                    <div className="px-5 py-10 text-center text-sm text-ink-400">
                      {v.lastMatchedAt
                        ? "Geen passende kandidaten gevonden. Importeer meer CV's of pas de vacature-eisen aan."
                        : "Nog niet gezocht — klik op “Zoek match” om de database te doorzoeken."}
                    </div>
                  ) : (
                    <Table>
                      <THead>
                        <TR className="hover:bg-transparent">
                          <TH>Kandidaat</TH>
                          <TH>Contact</TH>
                          <TH className="text-right">Match</TH>
                          <TH>Beschikbaar</TH>
                          <TH>Waarom</TH>
                          <TH className="text-right">CRM</TH>
                        </TR>
                      </THead>
                      <TBody>
                        {v.matches.map((m) => {
                          const c = m.candidate;
                          const name = `${c.firstName} ${c.lastName}`.trim();
                          const pct = Math.round(m.score * 100);
                          const tel = telHref(c.phone);
                          const dealId = dealByCand.get(c.id) ?? null;
                          const cdisc = c.discipline ? labelFor(DISCIPLINES, c.discipline) : null;
                          return (
                            <TR key={m.id}>
                              <TD>
                                <div className="flex items-center gap-2.5">
                                  <Avatar {...person(c)} size="sm" />
                                  <div className="min-w-0">
                                    <Link href={`/kandidaten/${c.id}`} className="font-semibold text-ink-900 hover:text-brand-600">
                                      {name}
                                    </Link>
                                    {cdisc && <p className="text-xs text-ink-500">{cdisc}</p>}
                                  </div>
                                </div>
                              </TD>
                              <TD>
                                {tel ? (
                                  <a href={tel} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800">
                                    <Phone className="h-3.5 w-3.5" /> {c.phone}
                                  </a>
                                ) : (
                                  <span className="text-xs text-ink-400">geen nummer</span>
                                )}
                              </TD>
                              <TD className="text-right">
                                <span className={cn("inline-block rounded-sm px-2 py-0.5 text-xs font-semibold tabular-nums", scoreClass(pct))}>
                                  {pct}%
                                </span>
                              </TD>
                              <TD>
                                <StatusBadge options={CANDIDATE_AVAILABILITY} value={c.availability} />
                              </TD>
                              <TD>
                                {m.reason ? <span className="line-clamp-2 text-xs text-ink-500">{m.reason}</span> : <span className="text-ink-300">—</span>}
                              </TD>
                              <TD className="text-right">
                                {dealId ? (
                                  <Link
                                    href={`/crm/deals/${dealId}`}
                                    className="inline-flex items-center gap-1.5 rounded-sm bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" /> In CRM
                                  </Link>
                                ) : (
                                  <form action={convertCvToLead}>
                                    <input type="hidden" name="candidateId" value={c.id} />
                                    <button type="submit" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                                      Als lead <ArrowRight className="h-4 w-4" />
                                    </button>
                                  </form>
                                )}
                              </TD>
                            </TR>
                          );
                        })}
                      </TBody>
                    </Table>
                  )}

                  {v._count.matches > v.matches.length && (
                    <p className="border-t border-ink-100 px-5 py-2 text-xs text-ink-400">
                      Top 12 getoond · nog {v._count.matches - v.matches.length} meer matches.
                    </p>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
