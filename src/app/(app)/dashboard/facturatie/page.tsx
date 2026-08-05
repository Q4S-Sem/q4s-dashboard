import Link from "next/link";
import {
  TrendingUp,
  Wallet,
  CheckCircle2,
  FileText,
  Coins,
  Building2,
  AlertTriangle,
  ListChecks,
} from "lucide-react";
import { db } from "@/lib/db";
import { CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatCurrency, formatDate, round2 } from "@/lib/utils";
import { INVOICE_STATUSES } from "@/lib/domain";
import { receivedInvoicesSummary } from "@/lib/received-invoices";
import { DashboardChart } from "../DashboardChart";
import { SectionCard, ActionLink, Bar, Empty, TONE } from "../_ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Facturatie — dashboard" };

const monthFmt = new Intl.DateTimeFormat("nl-NL", { month: "short" });

function effectiveStatus(status: string, dueDate: Date, now: Date) {
  if (status === "SENT" && dueDate < now) return "OVERDUE";
  return status;
}

export default async function FacturatieDashboardPage() {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear() + 1, 0, 1);

  const [invoices, purchases, received] = await Promise.all([
    db.invoice.findMany({ include: { client: { select: { id: true, companyName: true } } } }),
    db.purchaseInvoice.findMany({ select: { issueDate: true, subtotal: true, total: true, status: true } }),
    receivedInvoicesSummary(),
  ]);

  // ---- KPI's (dit kalenderjaar) ----
  const liveThisYear = invoices.filter(
    (i) => i.status !== "CANCELLED" && i.issueDate >= yearStart && i.issueDate < yearEnd,
  );
  const omzetYear = round2(liveThisYear.reduce((s, i) => s + i.subtotal, 0));
  const openstaand = round2(
    invoices
      .filter((i) => i.status === "SENT" || i.status === "OVERDUE")
      .reduce((s, i) => s + i.total, 0),
  );
  const betaaldYear = round2(
    invoices
      .filter((i) => i.status === "PAID" && i.issueDate >= yearStart && i.issueDate < yearEnd)
      .reduce((s, i) => s + i.total, 0),
  );
  const inkoopYear = round2(
    purchases
      .filter((p) => p.status !== "CANCELLED" && p.issueDate >= yearStart && p.issueDate < yearEnd)
      .reduce((s, p) => s + p.subtotal, 0),
  );

  // ---- Omzet & marge per maand (dit jaar) ----
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), i, 1);
    return { label: monthFmt.format(d), omzet: 0, inkoop: 0 };
  });
  for (const i of invoices) {
    if (i.status === "CANCELLED") continue;
    const d = new Date(i.issueDate);
    if (d.getFullYear() !== now.getFullYear()) continue;
    months[d.getMonth()].omzet += i.subtotal;
  }
  for (const p of purchases) {
    if (p.status === "CANCELLED") continue;
    const d = new Date(p.issueDate);
    if (d.getFullYear() !== now.getFullYear()) continue;
    months[d.getMonth()].inkoop += p.subtotal;
  }
  const chartData = months.map((m) => ({
    month: m.label,
    omzet: round2(m.omzet),
    inkoop: round2(m.inkoop),
    marge: round2(m.omzet - m.inkoop),
  }));

  // ---- Status van facturen (overdue-aware) ----
  const statusMap = new Map<string, { count: number; total: number }>();
  for (const i of invoices) {
    const st = effectiveStatus(i.status, i.dueDate, now);
    const e = statusMap.get(st) ?? { count: 0, total: 0 };
    e.count += 1;
    e.total = round2(e.total + i.total);
    statusMap.set(st, e);
  }
  const statusRows = INVOICE_STATUSES.map((opt) => {
    const e = statusMap.get(opt.value) ?? { count: 0, total: 0 };
    return { value: opt.value, label: opt.label, color: opt.color ?? "slate", ...e };
  });
  const maxStatusCount = Math.max(1, ...statusRows.map((r) => r.count));

  // ---- Top klanten (op omzet ex BTW, non-cancelled) ----
  const clientMap = new Map<string, { id: string; name: string; count: number; omzet: number }>();
  for (const i of invoices) {
    if (i.status === "CANCELLED") continue;
    const c =
      clientMap.get(i.clientId) ?? { id: i.clientId, name: i.client.companyName, count: 0, omzet: 0 };
    c.count += 1;
    c.omzet = round2(c.omzet + i.subtotal);
    clientMap.set(i.clientId, c);
  }
  const topClients = [...clientMap.values()].sort((a, b) => b.omzet - a.omzet).slice(0, 8);
  const maxClientOmzet = Math.max(1, ...topClients.map((c) => c.omzet));

  // ---- Openstaande facturen (SENT/OVERDUE), oplopend op vervaldatum ----
  const openInvoices = invoices
    .filter((i) => i.status === "SENT" || i.status === "OVERDUE")
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());

  return (
    <div className="space-y-8">
      <PageHeader
        title="Facturatie — dashboard"
        description="Financiële analyse: omzet, marge, openstaande facturen en je beste klanten. Klik door naar elke factuur of klant."
      />

      {/* KPI's */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label={`Omzet ${now.getFullYear()}`}
          value={formatCurrency(omzetYear)}
          sub="ex BTW · dit jaar"
          icon={<TrendingUp className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          label="Openstaand"
          value={formatCurrency(openstaand)}
          sub="verzonden + te laat"
          icon={<Wallet className="h-5 w-5" />}
          accent="amber"
        />
        <StatCard
          label={`Betaald ${now.getFullYear()}`}
          value={formatCurrency(betaaldYear)}
          sub="incl. BTW · dit jaar"
          icon={<CheckCircle2 className="h-5 w-5" />}
          accent="slate"
        />
        <StatCard
          label="Aantal facturen"
          value={invoices.length.toLocaleString("nl-NL")}
          sub={`Inkoop ${formatCurrency(inkoopYear)}`}
          icon={<FileText className="h-5 w-5" />}
          accent="slate"
        />
      </div>

      {/* Ontvangen facturen (van geplaatste ZZP'ers) */}
      {received.total > 0 && (
        <Link
          href={received.awaitingCount > 0 ? "/ontvangen-facturen#wacht" : "/ontvangen-facturen?toon=tebetalen"}
          className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-ink-200 bg-white p-5 shadow-sm transition-colors hover:border-brand-300"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <div className="font-semibold text-ink-900">Ontvangen facturen (ZZP)</div>
              <div className="text-sm text-ink-500">
                Op tijd betalen wat klopt — afwijkingen wachten op een correctie.
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6">
            <div className="text-right">
              <div className="text-lg font-bold tabular-nums text-ink-900">
                {formatCurrency(received.toPayAmount)}
              </div>
              <div className="text-xs text-ink-400">{received.toPayCount} op tijd te betalen</div>
            </div>
            <div className="text-right">
              <div
                className={
                  received.awaitingCount > 0
                    ? "text-lg font-bold tabular-nums text-red-600"
                    : "text-lg font-bold tabular-nums text-emerald-600"
                }
              >
                {received.awaitingCount}
              </div>
              <div className="text-xs text-ink-400">wacht op correctie</div>
            </div>
          </div>
        </Link>
      )}

      {/* Omzet & marge per maand + status */}
      <div className="grid gap-6 lg:grid-cols-3">
        <SectionCard
          icon={<TrendingUp className="h-4 w-4" />}
          title={`Omzet & marge per maand (${now.getFullYear()})`}
          className="lg:col-span-2"
        >
          <CardContent>
            <DashboardChart data={chartData} />
          </CardContent>
        </SectionCard>

        <SectionCard icon={<ListChecks className="h-4 w-4" />} title="Status van facturen">
          {invoices.length === 0 ? (
            <Empty>Nog geen facturen.</Empty>
          ) : (
            <CardContent className="space-y-3">
              {statusRows.map((r) => (
                <Bar
                  key={r.value}
                  label={r.label}
                  value={r.count}
                  max={maxStatusCount}
                  color={r.color}
                />
              ))}
              <div className="space-y-1 border-t border-ink-100 pt-3 text-xs text-ink-500">
                {statusRows
                  .filter((r) => r.count > 0)
                  .map((r) => (
                    <div key={r.value} className="flex items-center justify-between">
                      <StatusBadge options={INVOICE_STATUSES} value={r.value} />
                      <span className="tabular-nums">{formatCurrency(r.total)}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          )}
        </SectionCard>
      </div>

      {/* Top klanten + Openstaande facturen */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          icon={<Building2 className="h-4 w-4" />}
          title="Top klanten"
          action={<ActionLink href="/totaaloverzicht">Volledig overzicht →</ActionLink>}
        >
          {topClients.length === 0 ? (
            <Empty>Nog geen facturen.</Empty>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Klant</TH>
                  <TH className="text-right">Facturen</TH>
                  <TH>Omzet</TH>
                  <TH className="text-right">Bedrag</TH>
                </TR>
              </THead>
              <TBody>
                {topClients.map((c) => {
                  const pct = (c.omzet / maxClientOmzet) * 100;
                  return (
                    <TR key={c.id}>
                      <TD>
                        <Link
                          href={`/klanten/${c.id}`}
                          className="font-medium text-ink-900 hover:text-emerald-700"
                        >
                          {c.name}
                        </Link>
                      </TD>
                      <TD className="text-right tabular-nums text-ink-600">{c.count}</TD>
                      <TD className="w-32">
                        <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
                          <div
                            className={`h-full rounded-full ${TONE.green}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </TD>
                      <TD className="text-right tabular-nums font-medium text-ink-900">
                        {formatCurrency(c.omzet)}
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </SectionCard>

        <SectionCard
          icon={<Coins className="h-4 w-4" />}
          title="Openstaande facturen"
          action={<ActionLink href="/facturen">Alle facturen →</ActionLink>}
        >
          {openInvoices.length === 0 ? (
            <Empty>Niets openstaand — alles betaald.</Empty>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Nummer</TH>
                  <TH>Klant</TH>
                  <TH>Vervaldatum</TH>
                  <TH className="text-right">Bedrag</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {openInvoices.map((inv) => {
                  const overdue = inv.dueDate < now;
                  return (
                    <TR key={inv.id}>
                      <TD>
                        <Link
                          href={`/facturen/${inv.id}`}
                          className="font-medium text-ink-900 hover:text-emerald-700"
                        >
                          {inv.number}
                        </Link>
                      </TD>
                      <TD className="truncate text-ink-600">{inv.client.companyName}</TD>
                      <TD>
                        <span
                          className={
                            overdue
                              ? "inline-flex items-center gap-1 font-medium text-red-700"
                              : "text-ink-600"
                          }
                        >
                          {overdue && <AlertTriangle className="h-3.5 w-3.5" />}
                          {formatDate(inv.dueDate)}
                        </span>
                      </TD>
                      <TD className="text-right tabular-nums font-medium text-ink-900">
                        {formatCurrency(inv.total)}
                      </TD>
                      <TD>
                        <StatusBadge
                          options={INVOICE_STATUSES}
                          value={effectiveStatus(inv.status, inv.dueDate, now)}
                        />
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          )}
        </SectionCard>
      </div>
    </div>
  );
}