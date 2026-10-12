import Link from "next/link";
import {
  Inbox,
  Filter,
  Sparkles,
  Rocket,
  ArrowRight,
  BellRing,
  Radar,
  Users,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Clock,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { Badge } from "@/components/ui/badge";
import { ALERT_TYPES, labelFor, colorFor } from "@/lib/domain";
import { webFieldsFor } from "@/lib/sync";
import { cn } from "@/lib/utils";
import { bulkFilterVacancies, startAgents } from "../actions";
import { markAllAlertsRead } from "../intake-actions";
import { getHubCounts, RUN_STALE_MS } from "./data";
import { AutoRefresh } from "./AutoRefresh";

/** Server-tijd per request (los van de render, zodat React-lint niet klaagt). */
function nuMs() {
  return Date.now();
}

type SP = { filtered?: string; remaining?: string; error?: string };

const tijd = (d: Date) =>
  d.toLocaleString("nl-NL", {
    timeZone: "Europe/Amsterdam",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

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
      className="group flex flex-1 items-center gap-3 rounded-xl border border-ink-200 bg-white px-4 py-3 transition-colors hover:border-ink-300 hover:bg-ink-50/60"
    >
      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", tones[tone])}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="flex items-baseline gap-2">
          <span className="text-xl font-bold tabular-nums text-ink-900">{value}</span>
          <span className="truncate text-sm font-medium text-ink-700">{label}</span>
        </span>
        <span className="block truncate text-xs text-ink-400">{sub}</span>
      </span>
    </Link>
  );
}

type AgentState = "bezig" | "klaar" | "wacht";

/** Eén agent: wat hij doet, of hij nu bezig is, en het laatste resultaat. */
function Agent({
  naam,
  wat,
  icon,
  state,
  cijfer,
  cijferLabel,
  detail,
  actie,
}: {
  naam: string;
  wat: string;
  icon: React.ReactNode;
  state: AgentState;
  cijfer: number;
  cijferLabel: string;
  detail: string;
  actie?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-4 transition-colors",
        state === "bezig" ? "border-violet-300 bg-violet-50/50" : "border-ink-200 bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-600">
            {icon}
          </span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-ink-900">{naam}</div>
            <div className="truncate text-xs text-ink-500">{wat}</div>
          </div>
        </div>
        {state === "bezig" ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
            <Loader2 className="h-3 w-3 animate-spin" /> Bezig
          </span>
        ) : state === "klaar" ? (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Klaar
          </span>
        ) : (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-sm bg-ink-100 px-2 py-0.5 text-[11px] font-semibold text-ink-500">
            <Clock className="h-3 w-3" /> Wacht
          </span>
        )}
      </div>
      <div>
        <span className="text-2xl font-bold tabular-nums text-ink-900">{cijfer}</span>{" "}
        <span className="text-sm text-ink-600">{cijferLabel}</span>
        <p className="mt-0.5 line-clamp-2 text-xs text-ink-400">{detail}</p>
      </div>
      {actie && <div className="mt-auto">{actie}</div>}
    </div>
  );
}

export default async function MspOverzichtPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [c, runs, alerts, unreadAlerts] = await Promise.all([
    getHubCounts(),
    db.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 8 }),
    db.recruiterAlert.findMany({ orderBy: [{ read: "asc" }, { createdAt: "desc" }], take: 15 }),
    db.recruiterAlert.count({ where: { read: false } }),
  ]);

  const nu = nuMs();
  const isStale = (r: (typeof runs)[number]) =>
    r.status === "RUNNING" && nu - r.startedAt.getTime() > RUN_STALE_MS;
  const actief = runs.find((r) => r.status === "RUNNING" && !isStale(r)) ?? null;
  const vorige = runs.find((r) => r.status !== "RUNNING") ?? null;
  const stapNu = actief?.note ?? "";
  const bezigMet = (agent: string): AgentState =>
    actief ? (stapNu.startsWith(agent) ? "bezig" : "wacht") : vorige ? "klaar" : "wacht";
  const vandaag = webFieldsFor(Math.floor(nu / 86_400_000));

  return (
    <div className="space-y-6">
      {actief && <AutoRefresh />}
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
        <Step href="/vacaturehub/instroom" label="binnen" value={c.total} sub="uit alle bronnen" icon={<Inbox className="h-[18px] w-[18px]" />} tone="slate" />
        <ArrowRight className="hidden h-4 w-4 shrink-0 self-center text-ink-300 lg:block" />
        <Step href="/vacaturehub/beoordelen" label="te beoordelen" value={c.unknown} sub="wacht op de AI-filter" icon={<Filter className="h-[18px] w-[18px]" />} tone="amber" />
        <ArrowRight className="hidden h-4 w-4 shrink-0 self-center text-ink-300 lg:block" />
        <Step href="/vacaturehub/relevant" label="past bij Q4S" value={c.relevant} sub={`${c.toPublish} nog uit te schrijven`} icon={<Sparkles className="h-[18px] w-[18px]" />} tone="violet" />
        <ArrowRight className="hidden h-4 w-4 shrink-0 self-center text-ink-300 lg:block" />
        <Step href="/vacaturehub/relevant?tab=live" label="live" value={c.published} sub="zichtbaar op q4s.nl" icon={<Rocket className="h-[18px] w-[18px]" />} tone="green" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] xl:items-start">
        {/* Agents + wat ze gedaan hebben */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {actief && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />}
                <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", actief ? "bg-violet-500" : "bg-emerald-500")} />
              </span>
              Agents
              <span className="text-sm font-normal text-ink-400">
                {actief ? stapNu : "draaien elke ochtend vanzelf"}
              </span>
            </CardTitle>
            <form action={startAgents}>
              <SubmitButton size="sm" disabled={Boolean(actief)} pendingLabel="Starten…" title="Web-speurder, AI-filter en Matcher nu één ronde laten draaien">
                <Radar className="h-4 w-4" /> {actief ? "Bezig…" : "Nu laten zoeken"}
              </SubmitButton>
            </form>
          </CardHeader>

          <div className="grid gap-3 px-5 pb-5 md:grid-cols-3">
            <Agent
              naam="Web-speurder"
              wat="Zoekt openbare vacatures op het web"
              icon={<Radar className="h-[18px] w-[18px]" />}
              state={bezigMet("Web-speurder")}
              cijfer={actief?.sourced ?? vorige?.sourced ?? 0}
              cijferLabel="nieuw gevonden"
              detail={`Vandaag: ${vandaag.join(", ")}`}
            />
            <Agent
              naam="AI-filter"
              wat="Beoordeelt of een vacature bij Q4S past"
              icon={<Filter className="h-[18px] w-[18px]" />}
              state={bezigMet("AI-filter")}
              cijfer={c.unknown}
              cijferLabel="in de wachtrij"
              detail={
                vorige
                  ? `Laatste ronde: ${vorige.filtered} beoordeeld, ${vorige.relevant} passend`
                  : "Nog niet gedraaid"
              }
              actie={
                c.unknown > 0 && !actief ? (
                  <form action={bulkFilterVacancies}>
                    <input type="hidden" name="back" value="/vacaturehub" />
                    <SubmitButton variant="outline" size="sm" pendingLabel="Beoordelen…" className="w-full">
                      <Filter className="h-4 w-4" /> Nu beoordelen
                    </SubmitButton>
                  </form>
                ) : undefined
              }
            />
            <Agent
              naam="Matcher"
              wat="Koppelt kandidaten aan passende vacatures"
              icon={<Users className="h-[18px] w-[18px]" />}
              state={bezigMet("Matcher")}
              cijfer={actief?.matched ?? vorige?.matched ?? 0}
              cijferLabel="matches"
              detail={`${c.toPublish} passende vacature(s) nog uit te schrijven`}
              actie={
                c.toPublish > 0 ? (
                  <Link href="/vacaturehub/relevant" className={buttonVariants({ variant: "outline", size: "sm", className: "w-full" })}>
                    <Sparkles className="h-4 w-4" /> Uitschrijven
                  </Link>
                ) : undefined
              }
            />
          </div>

          {/* Activiteitenlog: elke ronde in één regel */}
          <div className="border-t border-ink-100">
            <div className="px-5 pt-4 pb-2 text-xs font-semibold uppercase tracking-wide text-ink-400">
              Laatste rondes
            </div>
            {runs.length === 0 ? (
              <p className="px-5 pb-5 text-sm text-ink-400">Nog geen rondes. Klik op &ldquo;Nu laten zoeken&rdquo;.</p>
            ) : (
              <ul className="max-h-[300px] divide-y divide-ink-100 overflow-y-auto">
                {runs.map((r) => {
                  const loopt = r === actief;
                  const fout = r.status === "ERROR" || isStale(r);
                  return (
                    <li key={r.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
                      {loopt ? (
                        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-violet-600" />
                      ) : fout ? (
                        <AlertTriangle className="h-4 w-4 shrink-0 text-red-500" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                      )}
                      <span className="w-28 shrink-0 tabular-nums text-ink-500">{tijd(r.startedAt)}</span>
                      <span className="min-w-0 flex-1 truncate text-ink-700">
                        {loopt
                          ? r.note
                          : fout
                            ? r.note || "Afgebroken (duurde te lang)"
                            : `${r.sourced} gevonden · ${r.filtered} beoordeeld · ${r.relevant} passend · ${r.matched} matches`}
                      </span>
                      <span className="shrink-0 text-xs text-ink-400">
                        {r.trigger === "CRON" ? "Automatisch" : "Handmatig"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Card>

        {/* Meldingen & leads */}
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
            <p className="px-5 pb-5 text-sm text-ink-400">
              Nog niets. Leads en gevonden matches verschijnen hier.
            </p>
          ) : (
            <ul className="max-h-[520px] divide-y divide-ink-100 overflow-y-auto">
              {alerts.map((a) => (
                <li key={a.id} className={cn("px-5 py-3", !a.read && "bg-amber-50/40")}>
                  <div className="flex items-center justify-between gap-2">
                    <Badge color={colorFor(ALERT_TYPES, a.type)}>{labelFor(ALERT_TYPES, a.type)}</Badge>
                    <span className="shrink-0 text-xs text-ink-400">{tijd(a.createdAt)}</span>
                  </div>
                  {a.href ? (
                    <Link href={a.href} className="mt-1 block text-sm font-medium text-ink-900 hover:text-brand-700">
                      {a.title}
                    </Link>
                  ) : (
                    <span className="mt-1 block text-sm font-medium text-ink-900">{a.title}</span>
                  )}
                  {a.body && <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{a.body}</p>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
