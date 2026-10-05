import Link from "next/link";
import { periodeUit } from "@/lib/analytics-periode";
import { PeriodeFilter, TabKop } from "../_ui";
import { SEGMENT_GROEP, segmentVariants } from "@/components/ui/button";
import { BarChart3, Building2, CalendarDays, HardHat } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatCurrency, round2 } from "@/lib/utils";
import { DISCIPLINES, labelFor } from "@/lib/domain";
import { MiniBar, SectionHeading } from "../_kpi";

export const metadata = { title: "Rapportage" };
export const dynamic = "force-dynamic";

const monthFmt = new Intl.DateTimeFormat("nl-NL", { month: "short" });

type Dim = "klant" | "maand" | "discipline";
const DIMS: { value: Dim; label: string; icon: typeof Building2; head: string }[] = [
  { value: "klant", label: "Per klant", icon: Building2, head: "Klant" },
  { value: "maand", label: "Per maand", icon: CalendarDays, head: "Maand" },
  { value: "discipline", label: "Per discipline", icon: HardHat, head: "Discipline" },
];

type SP = { dim?: string; q?: string; year?: string };

export default async function RapportagePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const p = periodeUit(sp, new Date());
  const { start: periodStart, end: periodEnd, label: periodLabel, param: qParam, year } = p;

  const dim: Dim = sp.dim === "maand" ? "maand" : sp.dim === "discipline" ? "discipline" : "klant";
  const dimMeta = DIMS.find((d) => d.value === dim)!;

  const live = { not: "CANCELLED" as const };
  const [invoices, receivedCosts, invoiceLines] = await Promise.all([
    db.invoice.findMany({
      where: { status: live, issueDate: { gte: periodStart, lt: periodEnd } },
      select: { clientId: true, subtotal: true, total: true, status: true, issueDate: true, client: { select: { companyName: true } } },
    }),
    db.receivedInvoice.findMany({
      where: { status: { in: ["APPROVED", "PAID"] }, issueDate: { gte: periodStart, lt: periodEnd } },
      select: { amount: true, vatAmount: true, issueDate: true },
    }),
    db.invoiceLine.findMany({
      where: { invoice: { status: live, issueDate: { gte: periodStart, lt: periodEnd } } },
      select: { amount: true, placement: { select: { consultant: { select: { discipline: true } } } } },
    }),
  ]);

  // Rijen per dimensie.
  type Row = { key: string; label: string; omzet: number; extra: string[] };
  let rows: Row[] = [];
  let extraHeaders: string[] = [];

  if (dim === "klant") {
    extraHeaders = ["Facturen", "Openstaand"];
    const m = new Map<string, { name: string; omzet: number; facturen: number; openstaand: number }>();
    for (const i of invoices) {
      let r = m.get(i.clientId);
      if (!r) {
        r = { name: i.client.companyName, omzet: 0, facturen: 0, openstaand: 0 };
        m.set(i.clientId, r);
      }
      r.omzet += i.subtotal;
      r.facturen += 1;
      if (i.status === "SENT") r.openstaand += i.total;
    }
    rows = [...m.entries()]
      .map(([key, r]) => ({ key, label: r.name, omzet: round2(r.omzet), extra: [String(r.facturen), formatCurrency(round2(r.openstaand))] }))
      .sort((a, b) => b.omzet - a.omzet);
  } else if (dim === "maand") {
    extraHeaders = ["Inkoop", "Marge"];
    const months: { key: string; label: string; omzet: number; inkoop: number }[] = [];
    for (let d = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1); d < periodEnd; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
      months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: monthFmt.format(d), omzet: 0, inkoop: 0 });
    }
    const mk = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
    for (const i of invoices) {
      const mo = months.find((x) => x.key === mk(new Date(i.issueDate)));
      if (mo) mo.omzet += i.subtotal;
    }
    for (const p of receivedCosts) {
      const issueDate = p.issueDate;
      if (!issueDate) continue;
      const mo = months.find((x) => x.key === mk(new Date(issueDate)));
      if (mo) mo.inkoop += p.amount - (p.vatAmount ?? 0);
    }
    rows = months.map((mo) => ({
      key: mo.key,
      label: mo.label,
      omzet: round2(mo.omzet),
      extra: [formatCurrency(round2(mo.inkoop)), formatCurrency(round2(mo.omzet - mo.inkoop))],
    }));
  } else {
    extraHeaders = ["Aandeel"];
    const m = new Map<string, number>();
    for (const l of invoiceLines) {
      const disc = l.placement?.consultant?.discipline ?? "";
      const key = disc || "onbekend";
      m.set(key, (m.get(key) ?? 0) + l.amount);
    }
    const totalDisc = [...m.values()].reduce((s, v) => s + v, 0) || 1;
    rows = [...m.entries()]
      .map(([key, omzet]) => ({
        key,
        label: key === "onbekend" ? "Onbekend" : labelFor(DISCIPLINES, key),
        omzet: round2(omzet),
        extra: [`${Math.round((omzet / totalDisc) * 100)}%`],
      }))
      .sort((a, b) => b.omzet - a.omzet);
  }

  const totalOmzet = round2(rows.reduce((s, r) => s + r.omzet, 0));
  const maxOmzet = Math.max(1, ...rows.map((r) => r.omzet));


  return (
    <div className="space-y-6">
      <TabKop uitleg="Draai omzet en marge uit per klant, maand of discipline. Bedragen uit de verkoopfacturen, ex btw — dezelfde bron als Facturatie → Rapportage.">
        <PeriodeFilter basePath="/dashboard/rapportage" periode={p} extra={{ dim }} />
      </TabKop>

      {/* Dimensie-tabs */}
      <div className={SEGMENT_GROEP}>
        {DIMS.map((d) => (
          <Link
            key={d.value}
            href={`/dashboard/rapportage?dim=${d.value}&q=${qParam}&year=${year}`}
            className={segmentVariants(dim === d.value)}
          >
            <d.icon className="h-4 w-4" /> {d.label}
          </Link>
        ))}
      </div>

      <SectionHeading title={`${dimMeta.label} · ${periodLabel}`} color="violet" />

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Draaitabel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-violet-600" /> {dimMeta.head} × omzet
            </CardTitle>
            <span className="text-sm font-semibold tabular-nums text-ink-900">{formatCurrency(totalOmzet)}</span>
          </CardHeader>
          {rows.length === 0 ? (
            <CardContent className="text-sm text-ink-500">Geen omzet in {periodLabel}.</CardContent>
          ) : (
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>{dimMeta.head}</TH>
                  <TH className="text-right">Omzet</TH>
                  {extraHeaders.map((h) => (
                    <TH key={h} className="text-right">{h}</TH>
                  ))}
                </TR>
              </THead>
              <TBody>
                {rows.map((r) => (
                  <TR key={r.key}>
                    <TD className="font-medium text-ink-900">{r.label}</TD>
                    <TD className="text-right tabular-nums">{formatCurrency(r.omzet)}</TD>
                    {r.extra.map((e, i) => (
                      <TD key={i} className="text-right tabular-nums text-ink-600">{e}</TD>
                    ))}
                  </TR>
                ))}
                <TR className="hover:bg-transparent">
                  <TD className="font-bold text-ink-900">Totaal</TD>
                  <TD className="text-right font-bold tabular-nums text-ink-900">{formatCurrency(totalOmzet)}</TD>
                  {extraHeaders.map((h) => (
                    <TD key={h} />
                  ))}
                </TR>
              </TBody>
            </Table>
          )}
        </Card>

        {/* Staafgrafiek */}
        <Card>
          <CardHeader>
            <CardTitle>Verdeling omzet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {rows.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-400">Nog geen data.</p>
            ) : (
              rows.map((r) => (
                <MiniBar
                  key={r.key}
                  label={r.label}
                  value={r.omzet}
                  max={maxOmzet}
                  color="violet"
                  display={<span className="text-xs">{formatCurrency(r.omzet)}</span>}
                />
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
