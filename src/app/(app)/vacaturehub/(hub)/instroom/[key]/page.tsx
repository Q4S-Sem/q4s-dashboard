import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Filter, Rocket, Plug, ExternalLink, Download } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { StatusBadge } from "@/components/ui/badge";
import { VMS_STATUSES } from "@/lib/domain";
import { formatDate, cn } from "@/lib/utils";
import { bulkFilterVacancies, bulkPublishRelevant } from "../../../actions";
import { pullNow } from "../../../intake-actions";
import { getSource, sourceWhere, OVERIG_KEY } from "../../data";
import { HubVacancyList, HUB_VACANCY_SELECT, toHubVacancies } from "../../HubVacancyList";

type SP = {
  tab?: string;
  filtered?: string;
  published?: string;
  remaining?: string;
  error?: string;
  pull?: string;
  received?: string;
  created?: string;
  msg?: string;
};

const TABS = [
  { key: "unknown", label: "Te beoordelen" },
  { key: "relevant", label: "Relevant" },
  { key: "irrelevant", label: "Afgewezen" },
  { key: "all", label: "Alles" },
];

export async function generateMetadata({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const s = await getSource(key);
  return { title: `${s?.name ?? "Bron"} · Vacaturehub` };
}

export default async function BronPage({
  params,
  searchParams,
}: {
  params: Promise<{ key: string }>;
  searchParams: Promise<SP>;
}) {
  const { key } = await params;
  const sp = await searchParams;
  const source = await getSource(key);
  if (!source) notFound();

  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "unknown";
  const relevanceWhere =
    tab === "unknown"
      ? { relevance: "UNKNOWN" }
      : tab === "relevant"
        ? { relevance: "RELEVANT" }
        : tab === "irrelevant"
          ? { relevance: "IRRELEVANT" }
          : {};

  const rows = await db.vacancy.findMany({
    where: { ...sourceWhere(key), ...relevanceWhere },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: HUB_VACANCY_SELECT,
  });
  const vacancies = toHubVacancies(rows);
  const back = `/vacaturehub/instroom/${key}?tab=${tab}`;
  const mode = tab === "irrelevant" ? "rejected" : tab === "relevant" ? "publish" : "judge";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/vacaturehub/instroom"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="h-4 w-4" /> Alle opdrachtgevers
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {source.id && (
            <form action={pullNow}>
              <input type="hidden" name="id" value={source.id} />
              <input type="hidden" name="back" value={`/vacaturehub/instroom/${key}`} />
              <SubmitButton variant="outline" size="sm" pendingLabel="Ophalen…">
                <Download className="h-4 w-4" /> Nu ophalen
              </SubmitButton>
            </form>
          )}
          {source.website && (
            <a
              href={source.website.startsWith("http") ? source.website : `https://${source.website}`}
              target="_blank"
              rel="noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ExternalLink className="h-4 w-4" /> Website
            </a>
          )}
          {source.id && (
            <Link href={`/connectors/${source.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Plug className="h-4 w-4" /> Koppeling
            </Link>
          )}
        </div>
      </div>

      {sp.error === "ai" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          De AI-actie is niet gelukt. Controleer de sleutel bij Instellingen › API-sleutels.
        </p>
      )}
      {sp.pull === "ok" && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Opgehaald: {sp.received} ontvangen · {sp.created} nieuw toegevoegd.
        </p>
      )}
      {sp.pull === "no-config" && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Deze koppeling heeft nog geen API-adres en sleutel — vul die in bij de koppeling.
        </p>
      )}
      {sp.pull === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Ophalen mislukt: {sp.msg}
        </p>
      )}
      {sp.filtered !== undefined && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {sp.filtered} vacature(s) beoordeeld · {sp.remaining} nog te gaan bij deze bron.
        </p>
      )}
      {sp.published !== undefined && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {sp.published} vacature(s) gepubliceerd · {sp.remaining} relevante nog te doen.
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-xl font-bold tracking-tight text-slate-900">{source.name}</h2>
        {source.key !== OVERIG_KEY && <StatusBadge options={VMS_STATUSES} value={source.status} />}
        {source.lastIn && (
          <span className="text-sm text-slate-500">laatste levering {formatDate(source.lastIn)}</span>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Binnengekomen" value={source.total} accent="slate" />
        <StatCard label="Te beoordelen" value={source.unknown} accent={source.unknown > 0 ? "amber" : "slate"} />
        <StatCard label="Relevant" value={source.relevant} accent="violet" />
        <StatCard label="Live op de site" value={source.published} accent="green" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI-filter voor deze bron</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <form action={bulkFilterVacancies}>
            <input type="hidden" name="source" value={key} />
            <input type="hidden" name="back" value={back} />
            <SubmitButton variant="outline" pendingLabel="AI beoordeelt…" disabled={source.unknown === 0}>
              <Filter className="h-4 w-4" /> Beoordeel {source.unknown} nieuwe
            </SubmitButton>
          </form>
          <form action={bulkPublishRelevant}>
            <input type="hidden" name="source" value={key} />
            <input type="hidden" name="back" value={`/vacaturehub/instroom/${key}?tab=relevant`} />
            <SubmitButton pendingLabel="AI schrijft…" disabled={source.relevant - source.published <= 0}>
              <Rocket className="h-4 w-4" /> Publiceer relevante
            </SubmitButton>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/vacaturehub/instroom/${key}?tab=${t.key}`}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition-colors",
              tab === t.key
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <HubVacancyList
        vacancies={vacancies}
        mode={mode}
        back={back}
        emptyTitle="Niets in deze lijst"
        emptyDescription="Er staat op dit moment niets van deze opdrachtgever in dit onderdeel."
      />
    </div>
  );
}
