import Link from "next/link";
import {
  Inbox,
  Filter,
  Sparkles,
  Rocket,
  ArrowRight,
  Plug,
  CheckCircle2,
  BellRing,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { DISCIPLINES, VMS_STATUSES, ALERT_TYPES, labelFor, colorFor } from "@/lib/domain";
import { formatDate, cn } from "@/lib/utils";
import { bulkFilterVacancies } from "../actions";
import { markAllAlertsRead } from "../intake-actions";
import { getHubCounts, getSources } from "./data";

type SP = { filtered?: string; remaining?: string; error?: string };

/** Eén stap in de trechter van binnenkomst tot live op de site. */
function Step({
  href,
  label,
  value,
  sub,
  icon,
  tone,
}: {
  href: string;
  label: string;
  value: number;
  sub: string;
  icon: React.ReactNode;
  tone: "slate" | "amber" | "violet" | "green";
}) {
  const tones = {
    slate: "bg-ink-100 text-ink-600",
    amber: "bg-amber-50 text-amber-600",
    violet: "bg-violet-50 text-violet-600",
    green: "bg-emerald-50 text-emerald-600",
  };
  return (
    <Link
      href={href}
      className="group flex flex-1 items-center gap-3 rounded-xl border border-ink-200 bg-white p-4 transition-colors hover:border-ink-300 hover:bg-ink-50/60"
    >
      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-2xl font-bold tabular-nums text-ink-900">{value}</span>
        <span className="block text-sm font-medium text-ink-700">{label}</span>
        <span className="block text-xs text-ink-400">{sub}</span>
      </span>
    </Link>
  );
}

export default async function VacaturehubOverzichtPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const [c, sources, latest, alerts, unreadAlerts] = await Promise.all([
    getHubCounts(),
    getSources(),
    db.vacancy.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        title: true,
        discipline: true,
        location: true,
        createdAt: true,
        relevance: true,
        vmsConnector: { select: { name: true } },
      },
    }),
    db.recruiterAlert.findMany({ orderBy: { createdAt: "desc" }, take: 6 }),
    db.recruiterAlert.count({ where: { read: false } }),
  ]);

  const withIntake = sources.filter((s) => s.total > 0).slice(0, 4);

  return (
    <div className="space-y-6">
      {sp.error === "ai" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          De AI-actie is niet gelukt. Controleer de sleutel bij Instellingen › API-sleutels.
        </p>
      )}
      {sp.filtered !== undefined && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {sp.filtered} vacature(s) beoordeeld · {sp.remaining} nog te gaan.
        </p>
      )}

      {/* De route die elke vacature aflegt */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <Step
          href="/vacaturehub/instroom"
          label="Binnengekomen"
          value={c.total}
          sub="uit alle bronnen"
          icon={<Inbox className="h-5 w-5" />}
          tone="slate"
        />
        <span className="hidden items-center self-center text-ink-300 lg:flex">
          <ArrowRight className="h-5 w-5" />
        </span>
        <Step
          href="/vacaturehub/beoordelen"
          label="Te beoordelen"
          value={c.unknown}
          sub="wacht op de AI-filter"
          icon={<Filter className="h-5 w-5" />}
          tone="amber"
        />
        <span className="hidden items-center self-center text-ink-300 lg:flex">
          <ArrowRight className="h-5 w-5" />
        </span>
        <Step
          href="/vacaturehub/relevant"
          label="Past bij Q4S"
          value={c.relevant}
          sub={`${c.toPublish} nog uit te schrijven`}
          icon={<Sparkles className="h-5 w-5" />}
          tone="violet"
        />
        <span className="hidden items-center self-center text-ink-300 lg:flex">
          <ArrowRight className="h-5 w-5" />
        </span>
        <Step
          href="/vacatures"
          label="Live op de site"
          value={c.published}
          sub="zichtbaar op q4s.nl"
          icon={<Rocket className="h-5 w-5" />}
          tone="green"
        />
      </div>

      {/* AI-pijplijn */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" /> AI-filter
          </CardTitle>
          <span className="text-sm text-ink-500">Per klik wordt een batch verwerkt</span>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <form action={bulkFilterVacancies}>
              <input type="hidden" name="back" value="/vacaturehub" />
              <SubmitButton variant="outline" pendingLabel="AI beoordeelt…" disabled={c.unknown === 0}>
                <Filter className="h-4 w-4" /> Beoordeel {c.unknown} nieuwe vacature(s)
              </SubmitButton>
            </form>
            <Link
              href="/vacaturehub/relevant"
              className={buttonVariants({ variant: "outline" })}
            >
              <Sparkles className="h-4 w-4" /> {c.toPublish} klaar om uit te schrijven
            </Link>
          </div>
          <div className="rounded-lg bg-ink-50 px-4 py-3 text-xs text-ink-500">
            De AI legt elke binnengekomen vacature langs de Q4S-niche — QA/QC, HSE, Inspectie,
            Welding, Coating, E&amp;I, Civiel, Offshore, Commissioning en Project Management — en
            zet erbij waaróm iets wel of niet past. Wat past gaat naar Maken, waar je de tekst
            afmaakt en hem zelf live zet; de rest verdwijnt naar Afgewezen. Je kunt elk oordeel zelf
            overrulen.
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Grootste opdrachtgevers */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="h-5 w-5 text-ink-500" /> Grootste opdrachtgevers
            </CardTitle>
            <Link
              href="/vacaturehub/instroom"
              className="shrink-0 text-sm font-medium text-ink-500 hover:text-ink-900"
            >
              Alle bronnen →
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {withIntake.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-400">
                Nog geen instroom. Koppel een platform of importeer een lijst.
              </p>
            ) : (
              withIntake.map((s) => {
                const judged = s.relevant + s.irrelevant;
                const pct = s.total > 0 ? Math.round((judged / s.total) * 100) : 0;
                return (
                  <Link
                    key={s.key}
                    href={`/vacaturehub/instroom/${s.key}`}
                    className="block rounded-xl border border-ink-200 p-3 transition-colors hover:border-ink-300 hover:bg-ink-50/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-ink-900">{s.name}</span>
                      <span className="shrink-0 text-xs tabular-nums text-ink-500">
                        {s.total} vacature(s)
                      </span>
                    </div>
                    <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-ink-100">
                      <span
                        className="bg-emerald-500"
                        style={{ width: `${(s.relevant / Math.max(1, s.total)) * 100}%` }}
                      />
                      <span
                        className="bg-ink-300"
                        style={{ width: `${(s.irrelevant / Math.max(1, s.total)) * 100}%` }}
                      />
                    </div>
                    <div className="mt-1.5 flex flex-wrap gap-x-3 text-[11px] text-ink-500">
                      <span className="text-emerald-700">{s.relevant} relevant</span>
                      <span>{s.irrelevant} afgewezen</span>
                      {s.unknown > 0 && <span className="text-amber-700">{s.unknown} te doen</span>}
                      <span className="ml-auto">{pct}% beoordeeld</span>
                    </div>
                  </Link>
                );
              })
            )}
          </CardContent>
        </Card>

        {/* Laatste instroom */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5 text-ink-500" /> Laatst binnengekomen
            </CardTitle>
            <Link
              href="/vacaturehub/beoordelen"
              className="shrink-0 text-sm font-medium text-ink-500 hover:text-ink-900"
            >
              Naar beoordelen →
            </Link>
          </CardHeader>
          <CardContent className="divide-y divide-ink-100">
            {latest.length === 0 ? (
              <p className="py-6 text-center text-sm text-ink-400">Nog geen vacatures.</p>
            ) : (
              latest.map((v) => (
                <div key={v.id} className="flex items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <Link
                      href={`/vacatures/${v.id}`}
                      className="block truncate text-sm font-medium text-ink-900 hover:text-brand-700"
                    >
                      {v.title}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-400">
                      {v.vmsConnector?.name && <span>{v.vmsConnector.name}</span>}
                      {v.location && <span>· {v.location}</span>}
                      <span>· {formatDate(v.createdAt)}</span>
                    </div>
                  </div>
                  <span className="shrink-0">
                    {v.relevance === "RELEVANT" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : v.discipline ? (
                      <StatusBadge options={DISCIPLINES} value={v.discipline} />
                    ) : null}
                  </span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Meldingen uit de intake — wat de pijplijn zelf heeft gedaan */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-ink-500" /> Meldingen
            {unreadAlerts > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm bg-red-600 px-1.5 text-[11px] font-semibold text-white">
                {unreadAlerts}
              </span>
            )}
          </CardTitle>
          {unreadAlerts > 0 && (
            <form action={markAllAlertsRead}>
              <SubmitButton variant="ghost" size="sm">
                Alles gelezen
              </SubmitButton>
            </form>
          )}
        </CardHeader>
        {alerts.length === 0 ? (
          <CardContent className="text-sm text-ink-500">
            Nog geen meldingen. Elke verwerkte levering zet hier (en in het belletje bovenin) een
            melding neer.
          </CardContent>
        ) : (
          <ul className="divide-y divide-ink-100">
            {alerts.map((a) => (
              <li
                key={a.id}
                className={cn("flex items-start gap-3 px-5 py-3", !a.read && "bg-amber-50/40")}
              >
                <Badge color={colorFor(ALERT_TYPES, a.type)}>{labelFor(ALERT_TYPES, a.type)}</Badge>
                <div className="min-w-0 flex-1">
                  {a.href ? (
                    <Link
                      href={a.href}
                      className="block text-sm font-medium text-ink-900 hover:text-brand-700"
                    >
                      {a.title}
                    </Link>
                  ) : (
                    <span className="block text-sm font-medium text-ink-900">{a.title}</span>
                  )}
                  {a.body && <p className="mt-0.5 text-xs text-ink-500">{a.body}</p>}
                </div>
                <span className="shrink-0 text-xs text-ink-400">{formatDate(a.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Koppelingen die (nog) niets leveren */}
      {sources.some((s) => s.total === 0) && (
        <Card>
          <CardHeader>
            <CardTitle>Koppelingen zonder instroom</CardTitle>
            <Link href="/connectors" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Koppelingen beheren
            </Link>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {sources
              .filter((s) => s.total === 0)
              .map((s) => (
                <span
                  key={s.key}
                  className="inline-flex items-center gap-2 rounded-sm border border-ink-200 px-3 py-1 text-xs text-ink-600"
                >
                  {s.name}
                  <StatusBadge options={VMS_STATUSES} value={s.status} />
                </span>
              ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
