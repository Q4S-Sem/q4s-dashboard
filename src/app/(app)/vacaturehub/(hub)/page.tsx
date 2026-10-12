import Link from "next/link";
import { Radar, Filter, Users, Loader2, CheckCircle2, AlertTriangle, Inbox, Sunrise, Plug } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/submit-button";
import { webFieldsFor } from "@/lib/sync";
import { cn } from "@/lib/utils";
import { bulkFilterVacancies, startAgents } from "../actions";
import { getHubCounts, INBOX_WHERE, RUN_STALE_MS } from "./data";
import { AutoRefresh } from "./AutoRefresh";
import { HubVacancyList, HUB_VACANCY_SELECT, toHubVacancies } from "./HubVacancyList";

type SP = { filtered?: string; remaining?: string; error?: string; lead?: string };

const tijd = (d: Date) =>
  d.toLocaleString("nl-NL", { timeZone: "Europe/Amsterdam", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Server-tijd per request (los van de render, zodat React-lint niet klaagt). */
function nuMs() {
  return Date.now();
}

/** Eén agent-stap in de ochtendrun. */
function Stap({
  icon,
  naam,
  tekst,
  state,
}: {
  icon: React.ReactNode;
  naam: string;
  tekst: React.ReactNode;
  state: "bezig" | "klaar" | "wacht";
}) {
  return (
    <li className="flex gap-3 py-3">
      <span
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          state === "bezig" ? "bg-violet-100 text-violet-700" : state === "klaar" ? "bg-emerald-50 text-emerald-700" : "bg-ink-100 text-ink-400",
        )}
      >
        {state === "bezig" ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      </span>
      <div className="min-w-0">
        <div className="text-sm font-semibold text-ink-900">{naam}</div>
        <div className="text-xs text-ink-500">{tekst}</div>
      </div>
    </li>
  );
}

export default async function MspInboxPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const [c, runs, rows, mspNieuw] = await Promise.all([
    getHubCounts(),
    db.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 6 }),
    db.vacancy.findMany({ where: INBOX_WHERE, orderBy: { createdAt: "desc" }, take: 100, select: HUB_VACANCY_SELECT }),
    db.vacancy.count({ where: { createdAt: { gte: new Date(nuMs() - 86_400_000) }, vmsConnector: { key: { not: "web-speurder" } } } }),
  ]);

  const nu = nuMs();
  const isStale = (r: (typeof runs)[number]) => r.status === "RUNNING" && nu - r.startedAt.getTime() > RUN_STALE_MS;
  const actief = runs.find((r) => r.status === "RUNNING" && !isStale(r)) ?? null;
  const run = actief ?? runs.find((r) => r.status !== "RUNNING") ?? null;
  const stapNu = actief?.note ?? "";
  const state = (agent: string) => (actief ? (stapNu.startsWith(agent) ? "bezig" : "wacht") : run ? "klaar" : "wacht") as "bezig" | "klaar" | "wacht";
  const vandaag = webFieldsFor(Math.floor(nu / 86_400_000));
  const leads = toHubVacancies(rows);
  const nieuwVandaag = leads.filter((l) => nu - l.createdAt.getTime() < 86_400_000).length;

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)] xl:items-start">
      {actief && <AutoRefresh />}

      {/* Links: wat de agents vannacht/nu gedaan hebben */}
      <div className="space-y-4 xl:sticky xl:top-20">
        <Card className="p-5">
          <div className="flex items-center gap-2">
            <Sunrise className="h-5 w-5 text-amber-500" />
            <div className="font-semibold text-ink-900">{actief ? "Agents zijn bezig" : "Ochtendrun"}</div>
            <span className="relative ml-auto flex h-2.5 w-2.5">
              {actief && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-400 opacity-75" />}
              <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full", actief ? "bg-violet-500" : run?.status === "ERROR" ? "bg-red-500" : "bg-emerald-500")} />
            </span>
          </div>
          <p className="mt-0.5 text-xs text-ink-500">
            {actief ? stapNu : run ? `${tijd(run.startedAt)} · ${run.trigger === "CRON" ? "automatisch 's ochtends" : "handmatig gestart"}` : "Draait elke ochtend vanzelf"}
          </p>

          <ul className="mt-2 divide-y divide-ink-100">
            <Stap
              icon={<Radar className="h-4 w-4" />}
              naam="Web-speurder"
              state={state("Web-speurder")}
              tekst={<>Zoekt vandaag: {vandaag.join(", ")}{run ? <> → <b>{run.sourced} nieuw</b></> : null}</>}
            />
            <Stap
              icon={<Plug className="h-4 w-4" />}
              naam="MSP-portalen"
              state={actief ? "wacht" : "klaar"}
              tekst={<>Laatste 24 uur → <b>{mspNieuw} nieuw</b></>}
            />
            <Stap
              icon={<Filter className="h-4 w-4" />}
              naam="AI-filter"
              state={state("AI-filter")}
              tekst={
                <>
                  {run ? <>{run.filtered} gelezen → <b>{run.relevant} passen</b></> : "Nog niet gedraaid"}
                  {c.unknown > 0 && <span className="text-amber-700"> · {c.unknown} wachten nog</span>}
                </>
              }
            />
            <Stap
              icon={<Users className="h-4 w-4" />}
              naam="Matcher"
              state={state("Matcher")}
              tekst={run ? <>Kandidaten gezocht → <b>{run.matched} matches</b></> : "Nog niet gedraaid"}
            />
          </ul>

          <div className="mt-3 flex flex-col gap-2">
            <form action={startAgents}>
              <SubmitButton size="sm" disabled={Boolean(actief)} pendingLabel="Starten…" className="w-full">
                <Radar className="h-4 w-4" /> {actief ? "Bezig…" : "Nu opnieuw zoeken"}
              </SubmitButton>
            </form>
            {c.unknown > 0 && !actief && (
              <form action={bulkFilterVacancies}>
                <input type="hidden" name="back" value="/vacaturehub" />
                <SubmitButton variant="outline" size="sm" pendingLabel="AI beoordeelt…" className="w-full">
                  <Filter className="h-4 w-4" /> {c.unknown} laten beoordelen
                </SubmitButton>
              </form>
            )}
          </div>
        </Card>

        {runs.length > 1 && (
          <Card className="p-5">
            <div className="text-xs font-semibold uppercase tracking-wide text-ink-400">Vorige rondes</div>
            <ul className="mt-2 space-y-2">
              {runs.filter((r) => r !== actief).slice(0, 5).map((r) => {
                const fout = r.status === "ERROR" || isStale(r);
                return (
                  <li key={r.id} className="flex items-start gap-2 text-xs">
                    {fout ? <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" /> : <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />}
                    <span className="min-w-0">
                      <span className="text-ink-700">{tijd(r.startedAt)}</span>
                      <span className="block truncate text-ink-400">
                        {fout ? r.note || "Afgebroken" : `${r.sourced} gevonden · ${r.relevant} passend · ${r.matched} matches`}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>

      {/* Rechts: de leads om te beoordelen */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <h2 className="text-lg font-semibold text-ink-900">Te beoordelen</h2>
          <span className="text-sm text-ink-500">
            {leads.length} lead{leads.length === 1 ? "" : "s"}
            {nieuwVandaag > 0 && <> · <b className="text-ink-800">{nieuwVandaag} nieuw vandaag</b></>}
          </span>
        </div>
        {sp.lead && (
          <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            Lead staat als taak bij <Link href="/agenda/taken" className="font-medium underline">Takenlijst</Link>: bel het bedrijf met onze kandidaten.
          </p>
        )}
        {sp.error === "ai" && (
          <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">De AI-actie is niet gelukt. Controleer de sleutel bij Instellingen › API-sleutels.</p>
        )}
        {sp.filtered !== undefined && (
          <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {sp.filtered} vacature(s) beoordeeld · {sp.remaining} wachten nog.
          </p>
        )}
        <HubVacancyList
          vacancies={leads}
          mode="inbox"
          back="/vacaturehub"
          emptyTitle="Alles beoordeeld"
          emptyDescription="Morgenochtend komen de agents met nieuwe leads. Kan niet wachten? Klik op 'Nu opnieuw zoeken'."
        />
        <p className="flex items-center gap-1.5 px-1 text-xs text-ink-400">
          <Inbox className="h-3.5 w-3.5" />
          Oppakken = AI schrijft hem uit in Q4S-stijl, jij controleert en zet hem op de site en LinkedIn · Lead = taak om het bedrijf te bellen · ✕ = wegleggen
        </p>
      </div>
    </div>
  );
}
