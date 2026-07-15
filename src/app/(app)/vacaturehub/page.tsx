import Link from "next/link";
import {
  Filter,
  Sparkles,
  CheckCircle2,
  FileText,
  Plug,
  Upload,
  ArrowRight,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { isAIConfigured } from "@/lib/ai";
import {
  VACANCY_SOURCES,
  VACANCY_RELEVANCE,
  VACANCY_STATUSES,
} from "@/lib/domain";
import {
  bulkFilterVacancies,
  bulkPublishRelevant,
  processVacancy,
} from "./actions";

export const metadata = { title: "Vacaturehub" };

const FILTERS = [
  { key: "all", label: "Alle" },
  { key: "UNKNOWN", label: "Onbeoordeeld" },
  { key: "RELEVANT", label: "Relevant" },
  { key: "IRRELEVANT", label: "Niet relevant" },
];

export default async function VacaturehubPage({
  searchParams,
}: {
  searchParams: Promise<{
    filtered?: string;
    published?: string;
    remaining?: string;
    error?: string;
    relevance?: string;
  }>;
}) {
  const sp = await searchParams;
  const activeFilter =
    sp.relevance && ["UNKNOWN", "RELEVANT", "IRRELEVANT"].includes(sp.relevance)
      ? sp.relevance
      : "all";

  const [total, unknown, relevant, published, toPublish, connectors, vacancies] =
    await Promise.all([
      db.vacancy.count(),
      db.vacancy.count({ where: { relevance: "UNKNOWN" } }),
      db.vacancy.count({ where: { relevance: "RELEVANT" } }),
      db.vacancy.count({ where: { status: "PUBLISHED" } }),
      db.vacancy.count({ where: { relevance: "RELEVANT", status: { not: "PUBLISHED" } } }),
      db.vmsConnector.findMany({
        orderBy: [{ priority: "desc" }, { name: "asc" }],
        include: { _count: { select: { vacancies: true } } },
      }),
      db.vacancy.findMany({
        where: activeFilter === "all" ? {} : { relevance: activeFilter },
        orderBy: { createdAt: "desc" },
        take: 100,
        include: { vmsConnector: { select: { name: true } } },
      }),
    ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Vacaturehub"
        description="Eén centrale vacaturedatabase: instroom uit alle VMS-platformen, AI filtert de relevante opdrachten en publiceert ze op q4s.nl."
      />

      {!isAIConfigured() && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Tip:</strong> stel <code>ANTHROPIC_API_KEY</code> in je{" "}
          <code>.env</code> in om automatisch te filteren en publiceren.
        </p>
      )}
      {sp.error === "ai" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          AI-actie mislukt. Controleer of ANTHROPIC_API_KEY is ingesteld.
        </p>
      )}
      {sp.filtered !== undefined && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {sp.filtered} vacature(s) beoordeeld · {sp.remaining} nog onbeoordeeld.
        </p>
      )}
      {sp.published !== undefined && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {sp.published} vacature(s) verwerkt en gepubliceerd · {sp.remaining} relevante nog te publiceren.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Vacatures totaal" value={total} icon={<FileText className="h-5 w-5" />} accent="brand" />
        <StatCard label="Onbeoordeeld" value={unknown} icon={<Filter className="h-5 w-5" />} accent="amber" />
        <StatCard label="Relevant" value={relevant} icon={<Sparkles className="h-5 w-5" />} accent="violet" />
        <StatCard label="Gepubliceerd" value={published} icon={<CheckCircle2 className="h-5 w-5" />} accent="green" />
      </div>

      {/* AI pipeline */}
      <Card>
        <CardHeader>
          <CardTitle>AI-pijplijn</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <form action={bulkFilterVacancies}>
              <SubmitButton variant="outline" pendingLabel="AI filtert…" disabled={unknown === 0}>
                <Filter className="h-4 w-4" /> AI-filter onbeoordeelde ({unknown})
              </SubmitButton>
            </form>
            <form action={bulkPublishRelevant}>
              <SubmitButton pendingLabel="Verwerken…" disabled={toPublish === 0}>
                <Sparkles className="h-4 w-4" /> Verwerk &amp; publiceer relevante ({toPublish})
              </SubmitButton>
            </form>
          </div>
          <p className="text-xs text-slate-500">
            AI beoordeelt elke vacature op de Q4S-niche (QA/QC, HSE, Inspectie, Welding,
            Coating, E&amp;I, Civiel, Offshore, Commissioning, Project Management). Relevante
            vacatures worden automatisch uitgeschreven en op q4s.nl gepubliceerd. Per klik
            wordt een batch verwerkt — klik nogmaals voor de rest.
          </p>
        </CardContent>
      </Card>

      {/* Connectors / intake */}
      <Card>
        <CardHeader>
          <CardTitle>Instroom per connector</CardTitle>
          <Link href="/vacatures/importeren" className={buttonVariants({ variant: "outline", size: "sm" })}>
            <Upload className="h-4 w-4" /> Bulk-import
          </Link>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {connectors.map((c) => (
            <Link
              key={c.id}
              href={`/connectors/${c.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 px-4 py-3 hover:bg-slate-50"
            >
              <span className="flex items-center gap-2 text-sm font-medium text-slate-900">
                <Plug className="h-4 w-4 text-slate-400" /> {c.name}
              </span>
              <span className="flex items-center gap-2 text-xs text-slate-500">
                {c._count.vacancies} vacature(s) <ArrowRight className="h-4 w-4 text-slate-300" />
              </span>
            </Link>
          ))}
          <p className="col-span-full text-xs text-slate-500">
            Een echte automatische API-koppeling per platform vereist credentials van de
            opdrachtgever; tot die tijd komt instroom binnen via plakken, CSV of e-mail.
          </p>
        </CardContent>
      </Card>

      {/* Vacancy queue */}
      <Card>
        <CardHeader>
          <CardTitle>Vacatures</CardTitle>
          <div className="flex flex-wrap gap-1.5">
            {FILTERS.map((f) => {
              const active = activeFilter === f.key;
              const href = f.key === "all" ? "/vacaturehub" : `/vacaturehub?relevance=${f.key}`;
              return (
                <Link
                  key={f.key}
                  href={href}
                  className={cn(
                    "rounded-full px-3 py-1 text-xs font-medium",
                    active ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  )}
                >
                  {f.label}
                </Link>
              );
            })}
          </div>
        </CardHeader>
        {vacancies.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={<FileText className="h-6 w-6" />}
              title="Geen vacatures"
              description="Importeer vacatures via een connector, bulk-import of voeg ze handmatig toe."
            />
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Titel</TH>
                <TH>Bron</TH>
                <TH>Relevantie</TH>
                <TH>Status</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {vacancies.map((v) => (
                <TR key={v.id}>
                  <TD>
                    <Link href={`/vacatures/${v.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {v.title}
                    </Link>
                    {v.vmsConnector && (
                      <span className="ml-2 text-xs text-slate-400">{v.vmsConnector.name}</span>
                    )}
                  </TD>
                  <TD>
                    <StatusBadge options={VACANCY_SOURCES} value={v.source} />
                  </TD>
                  <TD>
                    <StatusBadge options={VACANCY_RELEVANCE} value={v.relevance} />
                  </TD>
                  <TD>
                    <StatusBadge options={VACANCY_STATUSES} value={v.status} />
                  </TD>
                  <TD className="text-right">
                    {v.status !== "PUBLISHED" && v.relevance !== "IRRELEVANT" && (
                      <form action={processVacancy} className="inline">
                        <input type="hidden" name="id" value={v.id} />
                        <SubmitButton variant="outline" size="sm" pendingLabel="Bezig…">
                          Verwerk
                        </SubmitButton>
                      </form>
                    )}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
