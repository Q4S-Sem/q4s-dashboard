import { TrendingUp, ArrowDownCircle, ArrowUpCircle, Scale, Wallet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatPercent } from "@/lib/utils";
import { invoicingOverview, companyCostsThisYear } from "@/lib/facturatie";
import { btwOverview, periodToRange } from "@/lib/boekhouding";
import { PrintButton } from "../facturen/PrintButton";

export const metadata = { title: "Totaaloverzicht" };

function Tile({
  label,
  value,
  sub,
  tone = "slate",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "slate" | "green" | "red" | "amber" | "blue";
}) {
  const toneCls = {
    slate: "text-slate-900",
    green: "text-emerald-700",
    red: "text-red-700",
    amber: "text-amber-700",
    blue: "text-blue-700",
  }[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${toneCls}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function SectionTitle({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <h2 className="text-base font-semibold text-slate-900">{children}</h2>
    </div>
  );
}

export default async function TotaaloverzichtPage({
  searchParams,
}: {
  searchParams: Promise<{ jaar?: string; kwartaal?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.jaar) || now.getFullYear();
  const quarter = sp.kwartaal ? Number(sp.kwartaal) : null;
  const period = { year, quarter };
  const range = periodToRange(period);

  const [inv, costs, btw] = await Promise.all([
    invoicingOverview(range),
    companyCostsThisYear(range),
    btwOverview(period),
  ]);

  const nettowinst = Math.round((inv.marge - costs.totaal) * 100) / 100;
  const years = Array.from({ length: 4 }, (_, i) => now.getFullYear() - 2 + i);

  return (
    <div className="space-y-6">
      <div className="no-print">
        <PageHeader
          title="Totaaloverzicht"
          description={`Compleet financieel overzicht — ${range.label}.`}
          actions={<PrintButton />}
        />
        <Card className="mt-4">
          <CardContent>
            <form method="get" className="flex flex-wrap items-end gap-3">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Jaar</span>
                <select
                  name="jaar"
                  defaultValue={String(year)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">Periode</span>
                <select
                  name="kwartaal"
                  defaultValue={quarter ? String(quarter) : ""}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-brand-400 focus:outline-none focus:ring-1 focus:ring-brand-400"
                >
                  <option value="">Heel jaar</option>
                  <option value="1">Q1 (jan–mrt)</option>
                  <option value="2">Q2 (apr–jun)</option>
                  <option value="3">Q3 (jul–sep)</option>
                  <option value="4">Q4 (okt–dec)</option>
                </select>
              </label>
              <button
                type="submit"
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
              >
                Toon
              </button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Printbare kop */}
      <div className="hidden print:block">
        <h1 className="text-xl font-bold text-slate-900">Q4S — Totaaloverzicht</h1>
        <p className="text-sm text-slate-500">{range.label}</p>
      </div>

      {/* Van omzet naar nettowinst */}
      <SectionTitle icon={<TrendingUp className="h-5 w-5 text-emerald-600" />}>Resultaat</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Tile label="Omzet (ex BTW)" value={formatCurrency(inv.omzet)} tone="green" />
        <Tile label="Inkoop (ex BTW)" value={formatCurrency(inv.inkoop)} tone="amber" />
        <Tile label="Brutomarge" value={formatCurrency(inv.marge)} sub={`${formatPercent(inv.margePct)} van omzet`} tone="blue" />
        <Tile
          label="Eigen kosten"
          value={formatCurrency(costs.totaal)}
          sub={costs.loonkostenGeschat ? "loon geschat" : undefined}
          tone="amber"
        />
        <Tile label="Nettowinst" value={formatCurrency(nettowinst)} tone={nettowinst >= 0 ? "green" : "red"} />
      </div>

      {/* Geldstroom + openstaand + BTW */}
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardContent className="space-y-3">
            <SectionTitle icon={<Wallet className="h-5 w-5 text-slate-500" />}>Geldstroom (incl. BTW)</SectionTitle>
            <dl className="space-y-1.5 text-sm">
              <Row label="Geld in" value={formatCurrency(btw.geldIn)} />
              <Row label="Geld uit" value={formatCurrency(btw.geldUit)} />
              <Row label="Netto" value={formatCurrency(btw.geldNetto)} strong />
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3">
            <SectionTitle icon={<ArrowDownCircle className="h-5 w-5 text-emerald-600" />}>Openstaand</SectionTitle>
            <dl className="space-y-1.5 text-sm">
              <Row label={`Te ontvangen (${inv.openstaandCount})`} value={formatCurrency(inv.openstaand)} />
              <Row label="Waarvan te laat" value={formatCurrency(inv.overdue)} tone={inv.overdue > 0 ? "red" : undefined} />
              <Row label={`Te betalen (${inv.teBetalenCount})`} value={formatCurrency(inv.teBetalen)} />
            </dl>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-3">
            <SectionTitle icon={<Scale className="h-5 w-5 text-slate-500" />}>BTW-indicatie</SectionTitle>
            <dl className="space-y-1.5 text-sm">
              <Row label="Verschuldigd" value={formatCurrency(btw.verschuldigd)} />
              <Row label="Voorbelasting" value={formatCurrency(btw.voorbelasting)} />
              <Row
                label={btw.saldo >= 0 ? "Te betalen aan Belastingdienst" : "Terug te vorderen"}
                value={formatCurrency(Math.abs(btw.saldo))}
                strong
              />
            </dl>
            <p className="text-xs text-slate-400">Indicatie — geen officiële aangifte.</p>
          </CardContent>
        </Card>
      </div>

      {/* Per klant + per medewerker */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent>
            <SectionTitle icon={<ArrowDownCircle className="h-5 w-5 text-emerald-600" />}>Per klant</SectionTitle>
            <MiniTable
              head={["Klant", "Omzet", "Openstaand"]}
              rows={inv.perClient.slice(0, 10).map((c) => [c.name, formatCurrency(c.omzet), formatCurrency(c.openstaand)])}
              empty="Geen omzet in deze periode."
            />
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <SectionTitle icon={<ArrowUpCircle className="h-5 w-5 text-amber-600" />}>Per medewerker</SectionTitle>
            <MiniTable
              head={["Medewerker", "Omzet", "Marge"]}
              rows={inv.perConsultant.slice(0, 10).map((c) => [
                c.loondienst ? `${c.name} · loondienst` : c.name,
                formatCurrency(c.omzet),
                formatCurrency(c.marge),
              ])}
              empty="Geen gegevens in deze periode."
            />
            {inv.perConsultant.some((c) => c.loondienst) && (
              <p className="mt-2 text-xs text-slate-400">
                Loondienst: marge = brutomarge — de loonkost loopt via de eigen loonkosten (nettowinst),
                niet per persoon.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Per maand */}
      <Card>
        <CardContent>
          <SectionTitle icon={<TrendingUp className="h-5 w-5 text-slate-500" />}>Per maand (laatste 12)</SectionTitle>
          <MiniTable
            head={["Maand", "Omzet", "Inkoop", "Marge"]}
            rows={inv.perMonth.map((m) => [
              m.label,
              formatCurrency(m.omzet),
              formatCurrency(m.inkoop),
              formatCurrency(m.marge),
            ])}
            empty="Geen data."
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  tone,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: "red";
}) {
  return (
    <div className={`flex justify-between gap-4 ${strong ? "border-t border-slate-200 pt-1.5" : ""}`}>
      <dt className={strong ? "font-semibold text-slate-900" : "text-slate-500"}>{label}</dt>
      <dd
        className={`tabular-nums ${strong ? "font-bold text-slate-900" : tone === "red" ? "font-medium text-red-600" : "text-slate-900"}`}
      >
        {value}
      </dd>
    </div>
  );
}

function MiniTable({ head, rows, empty }: { head: string[]; rows: string[][]; empty: string }) {
  if (rows.length === 0) return <p className="py-4 text-sm text-slate-500">{empty}</p>;
  return (
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            {head.map((h, i) => (
              <th key={i} className={i === 0 ? "py-2 pr-2" : "py-2 px-2 text-right"}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r, ri) => (
            <tr key={ri}>
              {r.map((cell, ci) => (
                <td
                  key={ci}
                  className={ci === 0 ? "py-2 pr-2 text-slate-700" : "py-2 px-2 text-right tabular-nums text-slate-900"}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
