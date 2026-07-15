import Link from "next/link";
import {
  PlugZap,
  Zap,
  Filter,
  Globe,
  Send,
  Users,
  BellRing,
  ArrowRight,
  CheckCircle2,
  Circle,
  MinusCircle,
  AlertTriangle,
  KeyRound,
  Inbox,
  Settings,
  RefreshCw,
  FlaskConical,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { cn, formatDate } from "@/lib/utils";
import { isAIConfigured } from "@/lib/ai";
import { PROCESSABLE_VACANCY_WHERE } from "@/lib/msp";
import { ALERT_TYPES, VMS_STATUSES, labelFor, colorFor } from "@/lib/domain";
import {
  simulateDelivery,
  processOne,
  processQueue,
  pullNow,
  markAlertRead,
  markAllAlertsRead,
} from "./actions";

export const metadata = { title: "MSP-intake" };
export const dynamic = "force-dynamic";

const stampFmt = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** Stap-chip: status is nooit alleen kleur — altijd icoon + label. */
function StepChip({
  state,
  label,
  title,
}: {
  state: "done" | "todo" | "off" | "stopped";
  label: string;
  title?: string;
}) {
  const map = {
    done: { cls: "bg-emerald-50 text-emerald-700 ring-emerald-200", Icon: CheckCircle2 },
    todo: { cls: "bg-amber-50 text-amber-700 ring-amber-200", Icon: Circle },
    off: { cls: "bg-slate-50 text-slate-400 ring-slate-200", Icon: MinusCircle },
    stopped: { cls: "bg-slate-100 text-slate-500 ring-slate-200", Icon: MinusCircle },
  }[state];
  const Icon = map.Icon;
  return (
    <span
      title={title}
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        map.cls,
      )}
    >
      <Icon className="h-3 w-3" /> {label}
    </span>
  );
}

/** Matchpercentage als meter: één tint (emerald) op een neutrale track + het getal als tekst. */
function MatchMeter({ pct }: { pct: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
        <span
          className="block h-full rounded-full bg-emerald-500"
          style={{ width: `${Math.max(4, Math.min(100, pct))}%` }}
        />
      </span>
      <span className="text-xs font-semibold tabular-nums text-slate-700">{pct}%</span>
    </span>
  );
}

const FLOW_STEPS = [
  { Icon: Inbox, label: "Levering", sub: "API / webhook" },
  { Icon: Filter, label: "AI-filter", sub: "Q4S-niche" },
  { Icon: Globe, label: "Website", sub: "site-format, live" },
  { Icon: Send, label: "LinkedIn", sub: "concept klaar" },
  { Icon: Users, label: "Matches", sub: "kandidaten + %" },
  { Icon: BellRing, label: "Melding", sub: "recruiter" },
];

export default async function MspPage({
  searchParams,
}: {
  searchParams: Promise<{
    sim?: string;
    skipped?: string;
    rel?: string;
    done?: string;
    matches?: string;
    best?: string;
    failed?: string;
    batch?: string;
    remaining?: string;
    pull?: string;
    msg?: string;
    received?: string;
    created?: string;
  }>;
}) {
  const sp = await searchParams;

  const [
    connectors,
    vacancies,
    totalVms,
    relevantVms,
    liveVms,
    postsReady,
    matchTotal,
    unreadAlerts,
    alerts,
    topMatches,
    pendingUnknown,
  ] = await Promise.all([
    db.vmsConnector.findMany({
      orderBy: [{ priority: "desc" }, { name: "asc" }],
      include: { _count: { select: { vacancies: true } } },
    }),
    db.vacancy.findMany({
      where: { source: "VMS" },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: {
        vmsConnector: { select: { name: true, autoPublishSite: true, autoDraftPost: true } },
        _count: { select: { socialPosts: true, matches: true } },
        matches: { orderBy: { score: "desc" }, take: 1, select: { score: true } },
      },
    }),
    db.vacancy.count({ where: { source: "VMS" } }),
    db.vacancy.count({ where: { source: "VMS", relevance: "RELEVANT" } }),
    db.vacancy.count({ where: { source: "VMS", status: "PUBLISHED" } }),
    db.socialPost.count({
      where: { status: "DRAFT", vacancyId: { not: null }, vacancy: { source: "VMS" } },
    }),
    db.vacancyMatch.count({ where: { vacancy: { source: "VMS" } } }),
    db.recruiterAlert.count({ where: { read: false } }),
    db.recruiterAlert.findMany({ orderBy: { createdAt: "desc" }, take: 12 }),
    db.vacancyMatch.findMany({
      where: { vacancy: { source: "VMS", relevance: "RELEVANT" } },
      orderBy: { score: "desc" },
      take: 8,
      include: {
        candidate: { select: { id: true, firstName: true, lastName: true, discipline: true } },
        vacancy: { select: { id: true, title: true } },
      },
    }),
    db.vacancy.count({ where: PROCESSABLE_VACANCY_WHERE }),
  ]);

  const ai = isAIConfigured();

  return (
    <div className="space-y-6">
      <PageHeader
        title="MSP-intake"
        description="Vacatures die opdrachtgevers in het MSP (Magnit e.a.) zetten, stromen hier binnen en gaan automatisch door de pijplijn: filteren, op de website, LinkedIn-post klaar, kandidaten gematcht en een melding voor jou."
        actions={
          <>
            <form action={simulateDelivery}>
              <SubmitButton variant="outline" pendingLabel="Levering draait…">
                <FlaskConical className="h-4 w-4" /> Testlevering
              </SubmitButton>
            </form>
            <Link href="/connectors" className={buttonVariants({ variant: "outline" })}>
              <Settings className="h-4 w-4" /> Connectors
            </Link>
          </>
        }
      />

      {/* Result banners */}
      {sp.sim !== undefined &&
        (Number(sp.sim) > 0 ? (
          <p
            className={cn(
              "rounded-lg px-4 py-3 text-sm",
              Number(sp.failed) > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800",
            )}
          >
            Testlevering verwerkt: {sp.sim} vacature(s) ontvangen, {sp.rel} relevant
            {Number(sp.failed) > 0 ? `, ${sp.failed} stap(pen) mislukt (zie de statussen hieronder)` : ""}. Zo werkt het
            straks met de echte Magnit-key.
          </p>
        ) : (
          <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Testlevering: geen nieuwe vacatures{Number(sp.skipped) > 0 ? ` (${sp.skipped} al aanwezig)` : ""}. Een
            herlevering van dezelfde items wordt als duplicaat overgeslagen.
          </p>
        ))}
      {sp.done !== undefined && (
        <p
          className={cn(
            "rounded-lg px-4 py-3 text-sm",
            Number(sp.failed) > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800",
          )}
        >
          Vacature verwerkt{sp.rel === "1" ? " — relevant" : sp.rel === "0" ? " — niet relevant" : ""}.
          {sp.matches && Number(sp.matches) > 0
            ? ` ${sp.matches} kandidaat-match(es)${sp.best ? `, beste ${sp.best}%` : ""}.`
            : ""}
          {Number(sp.failed) > 0 ? ` ${sp.failed} stap(pen) mislukt — controleer de AI-configuratie.` : ""}
        </p>
      )}
      {sp.batch !== undefined && (
        <p
          className={cn(
            "rounded-lg px-4 py-3 text-sm",
            Number(sp.failed) > 0 ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800",
          )}
        >
          {sp.batch} vacature(s) door de pijplijn, {sp.rel} relevant · {sp.remaining} nog te beoordelen.
          {Number(sp.failed) > 0 ? ` ${sp.failed} stap(pen) mislukt.` : ""}
        </p>
      )}
      {sp.pull === "no-config" && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Deze connector heeft nog geen API-key + basis-URL. Stel ze in via Bewerken zodra je ze
          van het platform hebt.
        </p>
      )}
      {sp.pull === "error" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          API-pull mislukt{sp.msg ? `: ${sp.msg}` : ""}. De koppeling is niet bijgewerkt; er staat
          een foutmelding in het overzicht.
        </p>
      )}
      {sp.pull === "ok" && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          API-pull klaar: {sp.received} ontvangen, {sp.created} nieuw opgenomen.
        </p>
      )}
      {!ai && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>AI staat uit</strong> — filteren en uitschrijven worden overgeslagen; matchen
          (regels) en meldingen werken wel. Zet <code>ANTHROPIC_API_KEY</code> in je{" "}
          <code>.env</code> voor de volledige pijplijn.
        </p>
      )}

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Binnengekomen" value={totalVms} sub="via MSP/VMS" icon={<Inbox className="h-5 w-5" />} accent="brand" />
        <StatCard label="Relevant" value={relevantVms} icon={<Sparkles className="h-5 w-5" />} accent="violet" />
        <StatCard label="Live op site" value={liveVms} icon={<Globe className="h-5 w-5" />} accent="green" />
        <StatCard label="Posts klaar" value={postsReady} sub="concepten in Socials" icon={<Send className="h-5 w-5" />} accent="slate" />
        <StatCard label="Matches" value={matchTotal} icon={<Users className="h-5 w-5" />} accent="amber" />
        <StatCard
          label="Meldingen"
          value={unreadAlerts}
          sub="ongelezen"
          icon={<BellRing className="h-5 w-5" />}
          accent={unreadAlerts > 0 ? "red" : "slate"}
        />
      </div>

      {/* Pipeline flow strip */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-center gap-2 py-4 sm:gap-3">
          {FLOW_STEPS.map((s, i) => {
            const Icon = s.Icon;
            return (
              <div key={s.label} className="flex items-center gap-2 sm:gap-3">
                <div className="flex w-24 flex-col items-center gap-1 text-center">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="text-xs font-semibold text-slate-800">{s.label}</span>
                  <span className="text-[10px] leading-tight text-slate-400">{s.sub}</span>
                </div>
                {i < FLOW_STEPS.length - 1 && (
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" />
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Connectors */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PlugZap className="h-4 w-4 text-slate-400" /> Koppelingen
          </CardTitle>
          <Link href="/connectors/nieuw" className={buttonVariants({ variant: "outline", size: "sm" })}>
            Nieuwe connector
          </Link>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {connectors.map((c) => {
            const apiReady = Boolean(c.apiKey && c.apiBaseUrl);
            const isMagnit = c.key === "magnit";
            return (
              <div
                key={c.id}
                className={cn(
                  "rounded-xl border p-4",
                  isMagnit ? "border-brand-300 bg-brand-50/30 ring-1 ring-brand-200" : "border-slate-200",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{c.name}</p>
                    <p className="text-xs text-slate-500">{c._count.vacancies} vacature(s)</p>
                  </div>
                  <StatusBadge options={VMS_STATUSES} value={c.status} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                      apiReady
                        ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                        : "bg-slate-50 text-slate-500 ring-slate-200",
                    )}
                  >
                    <KeyRound className="h-3 w-3" /> {apiReady ? "API-key ingesteld" : "API-key volgt"}
                  </span>
                  {c.autoPublishSite && <Badge color="blue">→ website</Badge>}
                  {c.autoDraftPost && <Badge color="cyan">→ LinkedIn</Badge>}
                  {c.autoMatch && <Badge color="violet">→ matches</Badge>}
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
                  <span className="text-[11px] text-slate-400">
                    Laatste levering: {c.lastSyncAt ? stampFmt.format(c.lastSyncAt) : "—"}
                  </span>
                  <span className="flex items-center gap-1">
                    {apiReady && (
                      <form action={pullNow}>
                        <input type="hidden" name="id" value={c.id} />
                        <SubmitButton variant="ghost" size="sm" pendingLabel="Ophalen…">
                          <RefreshCw className="h-3.5 w-3.5" /> Haal op
                        </SubmitButton>
                      </form>
                    )}
                    <Link
                      href={`/connectors/${c.id}/bewerken`}
                      className={buttonVariants({ variant: "ghost", size: "sm" })}
                    >
                      Instellen
                    </Link>
                  </span>
                </div>
                {isMagnit && !apiReady && (
                  <p className="mt-2 rounded-lg bg-white/70 px-2.5 py-1.5 text-[11px] leading-snug text-slate-600">
                    Eerste echte koppeling. Zodra de Magnit-key binnen is: plak hem bij
                    Instellen en zet de status op &ldquo;Gekoppeld&rdquo; — de dagelijkse sync haalt dan
                    automatisch op. Tot die tijd: webhook of testlevering.
                  </p>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Intake werkbank */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-slate-400" /> Intake-werkbank
          </CardTitle>
          {pendingUnknown > 0 &&
            (ai ? (
              <form action={processQueue}>
                <SubmitButton size="sm" pendingLabel="Pijplijn draait…">
                  <Sparkles className="h-4 w-4" /> Verwerk onbeoordeelde ({pendingUnknown})
                </SubmitButton>
              </form>
            ) : (
              <span className="text-xs text-amber-700">
                {pendingUnknown} onbeoordeeld — AI vereist om te beoordelen
              </span>
            ))}
        </CardHeader>
        {vacancies.length === 0 ? (
          <CardContent className="text-sm text-slate-500">
            Nog geen MSP-vacatures. Klik op <strong>Testlevering</strong> om de hele pijplijn in
            actie te zien, of plak een vacature via een connector.
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Vacature</TH>
                <TH>Pijplijn</TH>
                <TH>Matches</TH>
                <TH className="text-right">Actie</TH>
              </TR>
            </THead>
            <TBody>
              {vacancies.map((v) => {
                const irrelevant = v.relevance === "IRRELEVANT";
                const bestPct = v.matches[0] ? Math.round(v.matches[0].score * 100) : null;
                // Een stap telt als "af" wanneer hij daadwerkelijk gebeurde, of
                // wanneer de connector die stap heeft uitgezet (dan is er niets
                // meer te doen). PAUSED = bewust offline = ook af.
                const autoPublish = v.vmsConnector?.autoPublishSite ?? true;
                const autoPost = v.vmsConnector?.autoDraftPost ?? true;
                const siteDone =
                  v.status === "PUBLISHED" || v.status === "PAUSED" || !autoPublish;
                const postDone = v._count.socialPosts > 0 || !autoPost;
                const fullyDone =
                  v.relevance !== "UNKNOWN" && (irrelevant || (siteDone && postDone));
                return (
                  <TR key={v.id}>
                    <TD>
                      <Link
                        href={`/vacatures/${v.id}`}
                        className="font-medium text-slate-900 hover:text-brand-700"
                      >
                        {v.title}
                      </Link>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {[v.vmsConnector?.name, v.companyName, formatDate(v.createdAt)]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </TD>
                    <TD>
                      <div className="flex flex-wrap gap-1">
                        <StepChip
                          state={
                            v.relevance === "RELEVANT"
                              ? "done"
                              : irrelevant
                                ? "stopped"
                                : "todo"
                          }
                          label={
                            v.relevance === "RELEVANT"
                              ? "Relevant"
                              : irrelevant
                                ? "Niet relevant"
                                : "Te beoordelen"
                          }
                          title="AI-relevantiefilter"
                        />
                        <StepChip
                          state={
                            v.status === "PUBLISHED"
                              ? "done"
                              : v.status === "PAUSED" || irrelevant || !autoPublish
                                ? "off"
                                : "todo"
                          }
                          label={
                            v.status === "PUBLISHED"
                              ? "Live"
                              : v.status === "PAUSED"
                                ? "Gepauzeerd"
                                : !autoPublish
                                  ? "Site uit"
                                  : "Site"
                          }
                          title={
                            !autoPublish
                              ? "Automatisch publiceren staat uit voor deze connector"
                              : "Gepubliceerd op de website"
                          }
                        />
                        <StepChip
                          state={
                            v._count.socialPosts > 0
                              ? "done"
                              : irrelevant || !autoPost
                                ? "off"
                                : "todo"
                          }
                          label={
                            v._count.socialPosts > 0 ? "Post klaar" : !autoPost ? "Post uit" : "Post"
                          }
                          title={
                            !autoPost
                              ? "Automatische LinkedIn-post staat uit voor deze connector"
                              : "LinkedIn-concept in de Socials-hub"
                          }
                        />
                      </div>
                    </TD>
                    <TD>
                      {bestPct !== null ? (
                        <span className="inline-flex items-center gap-2">
                          <MatchMeter pct={bestPct} />
                          <span className="text-xs text-slate-400">({v._count.matches})</span>
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TD>
                    <TD className="text-right">
                      {!fullyDone && (
                        <form action={processOne} className="inline">
                          <input type="hidden" name="id" value={v.id} />
                          <SubmitButton variant="outline" size="sm" pendingLabel="Bezig…">
                            Verwerk
                          </SubmitButton>
                        </form>
                      )}
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Top matches */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-400" /> Beste kandidaat-matches
            </CardTitle>
            <Link href="/kandidaten" className="text-sm text-brand-700 hover:underline">
              Talentpool
            </Link>
          </CardHeader>
          {topMatches.length === 0 ? (
            <CardContent className="text-sm text-slate-500">
              Nog geen matches. Zodra een relevante vacature binnenkomt, zoekt de pijplijn
              automatisch in de talentpool en scoort de AI elke kandidaat tegen de eisen.
            </CardContent>
          ) : (
            <CardContent className="space-y-3">
              {topMatches.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/kandidaten/${m.candidate.id}`}
                      className="block truncate text-sm font-medium text-slate-900 hover:text-brand-700"
                    >
                      {m.candidate.firstName} {m.candidate.lastName}
                    </Link>
                    <Link
                      href={`/vacatures/${m.vacancy.id}`}
                      className="block truncate text-xs text-slate-500 hover:text-brand-700"
                    >
                      {m.vacancy.title}
                    </Link>
                  </div>
                  <MatchMeter pct={Math.round(m.score * 100)} />
                </div>
              ))}
            </CardContent>
          )}
        </Card>

        {/* Alerts */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="h-4 w-4 text-slate-400" /> Meldingen
              {unreadAlerts > 0 && (
                <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-semibold text-white">
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
            <CardContent className="text-sm text-slate-500">
              Nog geen meldingen. Elke verwerkte levering zet hier (en in het belletje bovenin)
              een melding neer.
            </CardContent>
          ) : (
            <ul className="divide-y divide-slate-100">
              {alerts.map((a) => (
                <li
                  key={a.id}
                  className={cn(
                    "flex items-start gap-3 px-5 py-3",
                    !a.read && "bg-amber-50/40",
                  )}
                >
                  <Badge color={colorFor(ALERT_TYPES, a.type)}>
                    {labelFor(ALERT_TYPES, a.type)}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    {a.href ? (
                      <Link
                        href={a.href}
                        className="block text-sm font-medium text-slate-900 hover:text-brand-700"
                      >
                        {a.title}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium text-slate-900">{a.title}</p>
                    )}
                    {a.body && <p className="mt-0.5 text-xs text-slate-500">{a.body}</p>}
                    <p className="mt-0.5 text-[11px] text-slate-400">
                      {stampFmt.format(a.createdAt)}
                    </p>
                  </div>
                  {!a.read && (
                    <form action={markAlertRead}>
                      <input type="hidden" name="id" value={a.id} />
                      <button
                        type="submit"
                        title="Markeer als gelezen"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-300 hover:bg-emerald-50 hover:text-emerald-600"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    </form>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* Webhook / API uitleg */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-4 w-4 text-slate-400" /> Voor de echte koppeling (straks)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-600">
          <p>
            <strong>Optie 1 — API-pull:</strong> plak de Magnit-key en basis-URL bij de connector
            (Instellen) en zet de status op &ldquo;Gekoppeld&rdquo;. De dagelijkse sync haalt dan elke dag
            automatisch de nieuwe vacatures op.
          </p>
          <p>
            <strong>Optie 2 — webhook-push:</strong> laat het platform (of een tussenlaag) POSTen
            naar{" "}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
              /api/msp/webhook?token=&lt;JOB_SECRET&gt;&amp;connector=magnit
            </code>{" "}
            met een JSON-lijst vacatures. Beide routes doorlopen exact dezelfde pijplijn als de
            testlevering.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
