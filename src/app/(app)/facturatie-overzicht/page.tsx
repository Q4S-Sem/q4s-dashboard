import Link from "next/link";
import {
  TrendingUp,
  Coins,
  Percent,
  Wallet,
  Banknote,
  Building2,
  Users,
  ListChecks,
  Send,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatCurrency } from "@/lib/utils";
import { INVOICE_STATUSES, PURCHASE_INVOICE_STATUSES } from "@/lib/domain";
import { invoicingOverview, getNavBadges } from "@/lib/facturatie";
import { DashboardChart } from "../dashboard/DashboardChart";

export const metadata = { title: "Facturatie-overzicht" };

const TONE: Record<string, string> = {
  brand: "bg-brand-50 text-brand-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  red: "bg-red-50 text-red-600",
  slate: "bg-slate-100 text-slate-500",
};

function ActieCard({
  href,
  icon,
  label,
  value,
  sub,
  tone,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  sub: string;
  tone: keyof typeof TONE;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-brand-200 hover:bg-brand-50/40"
    >
      <div className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg", TONE[tone])}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
        <p className="text-xl font-bold tracking-tight text-slate-900">{value}</p>
        <p className="truncate text-xs text-slate-500">{sub}</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-slate-300 transition-colors group-hover:text-brand-600" />
    </Link>
  );
}

function plural(n: number, one: string, many: string) {
  return n === 1 ? one : many;
}

export default async function FacturatieOverzichtPage() {
  const [o, badges] = await Promise.all([invoicingOverview(), getNavBadges()]);
  const chartData = o.perMonth.map((m) => ({ month: m.label, omzet: m.omzet, inkoop: m.inkoop, marge: m.marge }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Facturatie-overzicht"
        description="Alle bedragen uit de administratie — omzet, marge en wat er nog openstaat, uitgesplitst per klant, medewerker en maand."
        actions={
          <Link href="/verwerken" className={buttonVariants()}>
            <ListChecks className="h-4 w-4" /> Facturatie verwerken
          </Link>
        }
      />

      {/* Financiële KPI's (dit jaar) */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Omzet dit jaar" value={formatCurrency(o.omzet)} icon={<TrendingUp className="h-5 w-5" />} accent="violet" />
        <StatCard label="Inkoop dit jaar" value={formatCurrency(o.inkoop)} icon={<Coins className="h-5 w-5" />} accent="slate" />
        <StatCard label="Marge dit jaar" value={formatCurrency(o.marge)} sub={`${o.margePct}% marge`} icon={<Percent className="h-5 w-5" />} accent="green" />
      </div>

      {/* Openstaande zaken — nog af te handelen */}
      <div>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Openstaande zaken
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <ActieCard
            href="/verwerken"
            icon={<ListChecks className="h-5 w-5" />}
            label="Te verwerken"
            value={String(badges.verwerken)}
            sub={`${plural(badges.verwerken, "medewerker", "medewerkers")} met openstaand werk`}
            tone={badges.verwerken > 0 ? "amber" : "slate"}
          />
          <ActieCard
            href="/verzenden"
            icon={<Send className="h-5 w-5" />}
            label="Klaar om te versturen"
            value={String(badges.verzenden)}
            sub={`${plural(badges.verzenden, "factuur", "facturen")} in de verzendmap`}
            tone={badges.verzenden > 0 ? "brand" : "slate"}
          />
          <ActieCard
            href="/facturen"
            icon={<Wallet className="h-5 w-5" />}
            label="Te ontvangen"
            value={formatCurrency(o.openstaand)}
            sub={
              o.overdue > 0
                ? `${o.openstaandCount} ${plural(o.openstaandCount, "factuur", "facturen")} · ${formatCurrency(o.overdue)} te laat`
                : `${o.openstaandCount} openstaande ${plural(o.openstaandCount, "factuur", "facturen")}`
            }
            tone={o.overdue > 0 ? "red" : o.openstaand > 0 ? "amber" : "slate"}
          />
          <ActieCard
            href="/inkoopfacturen"
            icon={<Banknote className="h-5 w-5" />}
            label="Te betalen"
            value={formatCurrency(o.teBetalen)}
            sub={`${o.teBetalenCount} ${plural(o.teBetalenCount, "inkoopfactuur", "inkoopfacturen")}`}
            tone={o.teBetalen > 0 ? "violet" : "slate"}
          />
        </div>
      </div>

      {/* Grafiek + statusverdeling */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Omzet &amp; marge (12 maanden)</CardTitle>
          </CardHeader>
          <CardContent>
            <DashboardChart data={chartData} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Statusverdeling</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Verkoopfacturen
              </div>
              {o.salesStatus.length === 0 ? (
                <p className="text-sm text-slate-400">—</p>
              ) : (
                <ul className="space-y-1.5">
                  {o.salesStatus.map((s) => (
                    <li key={s.status} className="flex items-center justify-between text-sm">
                      <StatusBadge options={INVOICE_STATUSES} value={s.status} />
                      <span className="tabular-nums text-slate-600">
                        {s.count} · {formatCurrency(s.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="border-t border-slate-100 pt-3">
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Inkoopfacturen
              </div>
              {o.purchaseStatus.length === 0 ? (
                <p className="text-sm text-slate-400">—</p>
              ) : (
                <ul className="space-y-1.5">
                  {o.purchaseStatus.map((s) => (
                    <li key={s.status} className="flex items-center justify-between text-sm">
                      <StatusBadge options={PURCHASE_INVOICE_STATUSES} value={s.status} />
                      <span className="tabular-nums text-slate-600">
                        {s.count} · {formatCurrency(s.total)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Uitsplitsingen */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Per klant */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-brand-600" /> Per klant
            </CardTitle>
          </CardHeader>
          {o.perClient.length === 0 ? (
            <CardContent className="text-sm text-slate-500">Nog geen facturen.</CardContent>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Klant</TH>
                  <TH className="text-right">Omzet</TH>
                  <TH className="text-right">Openstaand</TH>
                  <TH className="text-right">Facturen</TH>
                </TR>
              </THead>
              <TBody>
                {o.perClient.map((c) => (
                  <TR key={c.clientId}>
                    <TD>
                      <Link href={`/klanten/${c.clientId}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {c.name}
                      </Link>
                    </TD>
                    <TD className="text-right tabular-nums">{formatCurrency(c.omzet)}</TD>
                    <TD className="text-right tabular-nums">
                      {c.openstaand > 0 ? (
                        <span className="font-medium text-amber-700">{formatCurrency(c.openstaand)}</span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TD>
                    <TD className="text-right tabular-nums">{c.facturen}</TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>

        {/* Per medewerker */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4 text-brand-600" /> Per medewerker
            </CardTitle>
          </CardHeader>
          {o.perConsultant.length === 0 ? (
            <CardContent className="text-sm text-slate-500">Nog geen facturatie.</CardContent>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Medewerker</TH>
                  <TH className="text-right">Omzet</TH>
                  <TH className="text-right">Kosten</TH>
                  <TH className="text-right">Marge</TH>
                  <TH className="text-right">Te betalen</TH>
                </TR>
              </THead>
              <TBody>
                {o.perConsultant.map((c) => (
                  <TR key={c.consultantId}>
                    <TD>
                      <Link href={`/werknemers/${c.consultantId}`} className="font-medium text-slate-900 hover:text-brand-700">
                        {c.name}
                      </Link>
                    </TD>
                    <TD className="text-right tabular-nums">{formatCurrency(c.omzet)}</TD>
                    <TD className="text-right tabular-nums">{formatCurrency(c.kosten)}</TD>
                    <TD className="text-right tabular-nums font-medium text-emerald-700">{formatCurrency(c.marge)}</TD>
                    <TD className="text-right tabular-nums">
                      {c.teBetalen > 0 ? formatCurrency(c.teBetalen) : <span className="text-slate-400">—</span>}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
