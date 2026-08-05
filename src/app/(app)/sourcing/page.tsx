import Link from "next/link";
import { Bot, Sparkles, Filter, Users, Clock } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { isAIConfigured } from "@/lib/ai";
import { runSyncNow } from "./actions";

export const metadata = { title: "Sourcing-agent" };

const dt = new Intl.DateTimeFormat("nl-NL", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function RunStatus({ status }: { status: string }) {
  if (status === "DONE") return <Badge color="green">Klaar</Badge>;
  if (status === "ERROR") return <Badge color="red">Fout</Badge>;
  return <Badge color="amber">Bezig</Badge>;
}

export default async function SourcingPage({
  searchParams,
}: {
  searchParams: Promise<{ ran?: string }>;
}) {
  const { ran } = await searchParams;

  const [lastRun, runs, matches, openMatches] = await Promise.all([
    db.syncRun.findFirst({ orderBy: { startedAt: "desc" } }),
    db.syncRun.findMany({ orderBy: { startedAt: "desc" }, take: 10 }),
    db.vacancyMatch.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      include: {
        vacancy: { select: { id: true, title: true } },
        candidate: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
    db.vacancyMatch.count(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sourcing-agent"
        description="Zoekt dagelijks het web af naar relevante vacatures, filtert ze op de Q4S-niche en koppelt jullie kandidaten aan matchende opdrachten."
        actions={
          <form action={runSyncNow}>
            <SubmitButton pendingLabel="Agent draait…">
              <Bot className="h-4 w-4" /> Run nu
            </SubmitButton>
          </form>
        }
      />

      {ran && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          Sourcing-run uitgevoerd. Resultaat staat hieronder.
        </p>
      )}
      {!isAIConfigured() && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <strong>Tip:</strong> stel <code>ANTHROPIC_API_KEY</code> in voor het web-zoeken
          en de AI-relevantiefilter. Zonder key draait alleen de (gratis) CV-matching.
        </p>
      )}

      {/* Last run summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Gevonden (web)" value={lastRun?.sourced ?? 0} icon={<Sparkles className="h-5 w-5" />} accent="brand" />
        <StatCard label="Beoordeeld" value={lastRun?.filtered ?? 0} icon={<Filter className="h-5 w-5" />} accent="violet" />
        <StatCard label="Relevant" value={lastRun?.relevant ?? 0} icon={<Sparkles className="h-5 w-5" />} accent="green" />
        <StatCard label="Matches totaal" value={openMatches} sub="kandidaat ↔ vacature" icon={<Users className="h-5 w-5" />} accent="amber" />
      </div>

      {/* New matches */}
      <Card>
        <CardHeader>
          <CardTitle>Recente matches</CardTitle>
          <span className="text-sm text-ink-500">CV&apos;s gekoppeld aan vacatures</span>
        </CardHeader>
        {matches.length === 0 ? (
          <CardContent>
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="Nog geen matches"
              description="Zodra er relevante vacatures zijn, koppelt de agent automatisch passende kandidaten."
            />
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Kandidaat</TH>
                <TH>Vacature</TH>
                <TH>Reden</TH>
                <TH className="text-right">Score</TH>
              </TR>
            </THead>
            <TBody>
              {matches.map((m) => (
                <TR key={m.id}>
                  <TD>
                    <Link href={`/kandidaten/${m.candidate.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                      {m.candidate.firstName} {m.candidate.lastName}
                    </Link>
                  </TD>
                  <TD>
                    <Link href={`/vacatures/${m.vacancy.id}`} className="text-ink-700 hover:text-brand-700">
                      {m.vacancy.title}
                    </Link>
                  </TD>
                  <TD className="text-ink-500">{m.reason ?? "—"}</TD>
                  <TD className="text-right tabular-nums">{Math.round(m.score * 100)}%</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {/* Run history */}
      <Card>
        <CardHeader>
          <CardTitle>Run-historie</CardTitle>
        </CardHeader>
        {runs.length === 0 ? (
          <CardContent className="text-sm text-ink-500">Nog geen runs.</CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Tijd</TH>
                <TH>Trigger</TH>
                <TH>Status</TH>
                <TH className="text-right">Gevonden</TH>
                <TH className="text-right">Beoordeeld</TH>
                <TH className="text-right">Relevant</TH>
                <TH className="text-right">Matches</TH>
              </TR>
            </THead>
            <TBody>
              {runs.map((r) => (
                <TR key={r.id}>
                  <TD className="whitespace-nowrap">{dt.format(r.startedAt)}</TD>
                  <TD>
                    <Badge color={r.trigger === "CRON" ? "blue" : "slate"}>
                      {r.trigger === "CRON" ? "Automatisch" : "Handmatig"}
                    </Badge>
                  </TD>
                  <TD><RunStatus status={r.status} /></TD>
                  <TD className="text-right tabular-nums">{r.sourced}</TD>
                  <TD className="text-right tabular-nums">{r.filtered}</TD>
                  <TD className="text-right tabular-nums">{r.relevant}</TD>
                  <TD className="text-right tabular-nums">{r.matched}</TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {/* How the daily schedule works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-ink-400" /> Dagelijks automatisch draaien
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-ink-600">
          <p>
            De app draait niet zelf continu; laat een planner het endpoint één keer per dag
            aanroepen. Zet eerst <code>JOB_SECRET</code> in je <code>.env</code> en richt
            dan bijv. een cron (of cron-job.org / Vercel Cron) in op:
          </p>
          <pre className="overflow-x-auto rounded-lg bg-ink-900 px-4 py-3 text-xs text-ink-100">
{`# elke dag om 07:00
0 7 * * *  curl -fsS "https://<jouw-domein>/api/jobs/daily-sync?token=$JOB_SECRET"`}
          </pre>
          <p className="text-ink-500">
            <strong>Let op:</strong> de agent doorzoekt het <em>openbare</em> web naar
            geplaatste vacatures. Afgeschermde VMS-portalen (Magnit, SAP Fieldglass, Beeline,
            FlexOord) vereisen een echte API-koppeling met credentials per platform — die plug
            je later op de betreffende connector.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
