import Link from "next/link";
import { ClipboardCheck, Plus, Star, CheckCircle2, FileText, Printer } from "lucide-react";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { scoreLabel, SCORE_BADGE } from "@/lib/evaluaties";
import { averageOfScores, parseJsonMap } from "@/lib/evaluation-forms";
import { EVALUATION_STATUSES, QUARTERS } from "@/lib/domain";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";

type SP = { year?: string; quarter?: string; opgeslagen?: string };

function hrefWith(basePath: string, sp: SP, patch: SP): string {
  // `opgeslagen` bewust niet meenemen: die melding hoort bij één actie, niet bij
  // elke filterklik daarna.
  const { opgeslagen: _weg, ...rest } = sp;
  const merged = { ...rest, ...patch };
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(merged)) if (v) qs.set(k, String(v));
  const s = qs.toString();
  return s ? `${basePath}?${s}` : basePath;
}

function FilterPill({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "rounded-lg bg-brand-600 px-3 py-1.5 text-sm font-medium text-white"
          : "rounded-lg border border-ink-200 bg-white px-3 py-1.5 text-sm text-ink-600 hover:bg-ink-50"
      }
    >
      {children}
    </Link>
  );
}

/**
 * The evaluatie-overzicht for a single form type (VCU or UITZENDKRACHT). Each
 * type has its own page now, so there's no type-switch — just kwartaal + jaar.
 */
export async function EvaluatiesList({
  type,
  basePath,
  title,
  description,
  sp,
}: {
  type: string;
  basePath: string;
  title: string;
  description: string;
  sp: SP;
}) {
  const bewaard = sp.opgeslagen?.trim() || null;
  const year = sp.year ? Number(sp.year) : undefined;
  const quarter = sp.quarter ? Number(sp.quarter) : undefined;

  const where = {
    type,
    ...(year ? { year } : {}),
    ...(quarter ? { quarter } : {}),
  };

  const [evals, yearsRaw] = await Promise.all([
    db.evaluation.findMany({
      where,
      orderBy: [{ year: "desc" }, { quarter: "desc" }, { evaluationDate: "desc" }],
      include: { consultant: { select: { firstName: true, lastName: true } } },
    }),
    db.evaluation.findMany({
      where: { type },
      distinct: ["year"],
      select: { year: true },
      orderBy: { year: "desc" },
    }),
  ]);
  const years = yearsRaw.map((y) => y.year);

  const avgOf = (ev: { scoresJson: string | null }) =>
    averageOfScores(parseJsonMap(ev.scoresJson));
  const scored = evals.map(avgOf).filter((x): x is number => x !== null);
  const avg = scored.length
    ? Math.round((scored.reduce((s, v) => s + v, 0) / scored.length) * 10) / 10
    : null;
  const definitief = evals.filter((e) => e.status === "DEFINITIEF").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {/* Het blanco formulier hoort hier: je hebt het nodig op het moment
                dat je aan dit type evaluatie denkt, niet op een aparte
                beheerpagina. */}
            <Link
              href={`/evaluaties/sjabloon/${type.toLowerCase()}`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Printer className="h-4 w-4" /> Blanco formulier
            </Link>
            <Link href={`/evaluaties/nieuw?type=${type}`} className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe evaluatie
            </Link>
          </div>
        }
      />

      {/* Na opslaan land je hier, niet op het detailscherm. Deze regel bevestigt
          dat het gelukt is en houdt dat scherm één klik weg. */}
      {bewaard && (
        <p className="flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 shrink-0" /> Evaluatie opgeslagen.
          <Link href={`/evaluaties/${bewaard}`} className="font-medium underline">
            Openen
          </Link>
          <span className="text-emerald-700/70">of</span>
          <Link href={`/evaluaties/${bewaard}/print`} className="font-medium underline">
            printen / PDF
          </Link>
        </p>
      )}

      {/* Filters: kwartaal + jaar (geen type-switch meer) */}
      <Card>
        <CardContent className="space-y-3 py-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-16 text-xs font-semibold uppercase tracking-wide text-ink-400">
              Kwartaal
            </span>
            <FilterPill active={!quarter} href={hrefWith(basePath, sp, { quarter: undefined })}>
              Alle
            </FilterPill>
            {QUARTERS.map((q) => (
              <FilterPill
                key={q.value}
                active={quarter === Number(q.value)}
                href={hrefWith(basePath, sp, { quarter: q.value })}
              >
                Q{q.value}
              </FilterPill>
            ))}
          </div>

          {years.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-16 text-xs font-semibold uppercase tracking-wide text-ink-400">
                Jaar
              </span>
              <FilterPill active={!year} href={hrefWith(basePath, sp, { year: undefined })}>
                Alle
              </FilterPill>
              {years.map((y) => (
                <FilterPill
                  key={y}
                  active={year === y}
                  href={hrefWith(basePath, sp, { year: String(y) })}
                >
                  {y}
                </FilterPill>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Overzicht */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Evaluaties" value={evals.length} icon={<ClipboardCheck className="h-5 w-5" />} />
        <StatCard
          label="Gemiddelde score"
          value={avg !== null ? `${avg.toLocaleString("nl-NL")} / 4` : "—"}
          sub={avg !== null ? scoreLabel(Math.round(avg)) : "nog geen scores"}
          accent="amber"
          icon={<Star className="h-5 w-5" />}
        />
        <StatCard label="Definitief" value={definitief} accent="green" icon={<CheckCircle2 className="h-5 w-5" />} />
      </div>

      {evals.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck className="h-6 w-6" />}
          title="Nog geen evaluaties"
          description="Vul de eerste evaluatie van dit type in voor een medewerker."
          action={
            <Link href={`/evaluaties/nieuw?type=${type}`} className={buttonVariants({ variant: "outline" })}>
              <Plus className="h-4 w-4" /> Nieuwe evaluatie
            </Link>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Medewerker</TH>
                  <TH>Periode</TH>
                  <TH>Inlener</TH>
                  <TH>Score</TH>
                  <TH>Status</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {evals.map((e) => {
                  const a = avgOf(e);
                  return (
                    <TR key={e.id}>
                      <TD className="font-medium text-ink-900">
                        {e.consultant.firstName} {e.consultant.lastName}
                      </TD>
                      <TD className="whitespace-nowrap">
                        Q{e.quarter} · {e.year}
                      </TD>
                      <TD className="text-ink-600">{e.clientName ?? "—"}</TD>
                      <TD>
                        {a !== null ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 rounded-sm px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
                              SCORE_BADGE[Math.round(a)],
                            )}
                          >
                            {a.toLocaleString("nl-NL")} · {scoreLabel(Math.round(a))}
                          </span>
                        ) : (
                          <span className="text-ink-400">—</span>
                        )}
                      </TD>
                      <TD>
                        <StatusBadge options={EVALUATION_STATUSES} value={e.status} />
                      </TD>
                      <TD className="text-right">
                        <Link
                          href={`/evaluaties/${e.id}`}
                          className={buttonVariants({ variant: "outline", size: "sm" })}
                        >
                          <FileText className="h-4 w-4" /> Bekijken
                        </Link>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
