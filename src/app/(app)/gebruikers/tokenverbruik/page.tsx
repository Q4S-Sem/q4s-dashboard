import Link from "next/link";
import { BarChart3, Coins, Activity, KeyRound, Info, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import { aiUsageOverview } from "@/lib/ai-keys";
import { USD_TO_EUR } from "@/lib/ai-pricing";

export const metadata = { title: "Tokenverbruik" };
export const dynamic = "force-dynamic";

const eur = (usd: number) => formatCurrency(usd * USD_TO_EUR);
const fmtTokens = (n: number) => new Intl.NumberFormat("nl-NL").format(n);

const PROVIDER_LABEL: Record<string, string> = {
  deepseek: "DeepSeek",
  gemini: "Google Gemini",
  anthropic: "Anthropic Claude",
  ollama: "Ollama (lokaal)",
};
const KIND_LABEL: Record<string, string> = { text: "Tekst", vision: "Document/beeld", web: "Web-sourcing" };

export default async function TokenverbruikPage() {
  const o = await aiUsageOverview();
  const maxDay = Math.max(1, ...o.perDay.map((d) => d.tokens));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Tokenverbruik"
        description="Live overzicht van wat de AI's verbruiken en (indicatief) kosten. Elke AI-aanroep wordt automatisch bijgeschreven."
        actions={
          <Link href="/gebruikers/api-sleutels" className={buttonVariants({ variant: "outline" })}>
            <KeyRound className="h-4 w-4" /> API-sleutels
          </Link>
        }
      />

      {o.totalCalls === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-6 w-6" />}
          title="Nog geen AI-verbruik"
          description="Zodra een AI-feature draait (CV's uitlezen, vacatures verbeteren, matching, inzichten) verschijnt het verbruik hier — automatisch bijgehouden per provider."
          action={
            <Link href="/gebruikers/api-sleutels" className={buttonVariants()}>
              <KeyRound className="h-4 w-4" /> Sleutels instellen
            </Link>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Totaal tokens"
              value={fmtTokens(o.totalTokens)}
              accent="brand"
              icon={<BarChart3 className="h-5 w-5" />}
            />
            <StatCard
              label="Geschatte kosten"
              value={eur(o.totalCostUsd)}
              sub="indicatief, incl. omrekening"
              accent="violet"
              icon={<Coins className="h-5 w-5" />}
            />
            <StatCard
              label="AI-aanroepen"
              value={fmtTokens(o.totalCalls)}
              accent="green"
              icon={<Activity className="h-5 w-5" />}
            />
          </div>

          <p className="flex items-start gap-2 rounded-lg border border-ink-200 bg-white px-4 py-3 text-sm text-ink-600">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
            De kosten zijn een <strong>schatting</strong> op basis van publieke tarieven per model
            (zie <code className="rounded bg-ink-100 px-1">lib/ai-pricing</code>) — Ollama is lokaal en
            telt als gratis. Gebruik dit om trends en verhoudingen te zien, niet als exacte factuur.
          </p>

          {/* Per provider */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Provider</TH>
                    <TH className="text-right">Aanroepen</TH>
                    <TH className="text-right">Tokens</TH>
                    <TH className="text-right">Kosten (schatting)</TH>
                  </TR>
                </THead>
                <TBody>
                  {o.byProvider.map((p) => (
                    <TR key={p.provider}>
                      <TD className="font-medium text-ink-900">
                        {PROVIDER_LABEL[p.provider] ?? p.provider}
                      </TD>
                      <TD className="text-right tabular-nums text-ink-600">{fmtTokens(p.calls)}</TD>
                      <TD className="text-right tabular-nums text-ink-700">{fmtTokens(p.tokens)}</TD>
                      <TD className="text-right tabular-nums text-ink-900">{eur(p.costUsd)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>

          {/* Per dag (laatste 30) */}
          {o.perDay.length > 0 && (
            <Card>
              <CardContent className="space-y-2">
                <div className="text-sm font-semibold text-ink-800">Verbruik per dag</div>
                <div className="space-y-1.5">
                  {o.perDay.map((d) => (
                    <div key={d.date} className="flex items-center gap-3 text-xs">
                      <span className="w-20 shrink-0 tabular-nums text-ink-500">{d.date}</span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-ink-100">
                        <div
                          className="h-full rounded-full bg-brand-500"
                          style={{ width: `${Math.max(2, (d.tokens / maxDay) * 100)}%` }}
                        />
                      </div>
                      <span className="w-24 shrink-0 text-right tabular-nums text-ink-600">
                        {fmtTokens(d.tokens)}
                      </span>
                      <span className="w-16 shrink-0 text-right tabular-nums text-ink-400">
                        {eur(d.costUsd)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recente aanroepen */}
          <Card>
            <CardContent className="p-0">
              <div className="border-b border-ink-100 px-4 py-3 text-sm font-semibold text-ink-800">
                Recente aanroepen
              </div>
              <Table>
                <THead>
                  <TR className="hover:bg-transparent">
                    <TH>Wanneer</TH>
                    <TH>Provider</TH>
                    <TH>Model</TH>
                    <TH>Soort</TH>
                    <TH className="text-right">Tokens</TH>
                    <TH className="text-right">Kosten</TH>
                  </TR>
                </THead>
                <TBody>
                  {o.recent.map((r) => (
                    <TR key={r.id}>
                      <TD className="whitespace-nowrap text-sm text-ink-500">{formatDate(r.createdAt)}</TD>
                      <TD className="text-ink-700">{PROVIDER_LABEL[r.provider] ?? r.provider}</TD>
                      <TD className="font-mono text-xs text-ink-500">{r.model}</TD>
                      <TD className="text-sm text-ink-500">{KIND_LABEL[r.kind] ?? r.kind}</TD>
                      <TD className="text-right tabular-nums text-ink-700">{fmtTokens(r.totalTokens)}</TD>
                      <TD className="text-right tabular-nums text-ink-600">{eur(r.estCostUsd)}</TD>
                    </TR>
                  ))}
                </TBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
