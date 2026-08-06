import Link from "next/link";
import { BarChart3, ChevronLeft, ChevronRight, Building2, CalendarDays, HardHat } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { cn, formatCurrency, round2 } from "@/lib/utils";
import { QUARTERS, DISCIPLINES, labelFor } from "@/lib/domain";
import { MiniBar, SectionHeading } from "../_kpi";

export const metadata = { title: "Rapportage" };
export const dynamic = "force-dynamic";

const monthFmt = new Intl.DateTimeFormat("nl-NL", { month: "short" });
const quarterOf = (d: Date) => Math.floor(d.getMonth() / 3) + 1;

type Dim = "klant" | "maand" | "discipline";
const DIMS: { value: Dim; label: string; icon: typeof Building2; head: string }[] = [
  { value: "klant", label: "Per klant", icon: Building2, head: "Klant" },
  { value: "maand", label: "Per maand", icon: CalendarDays, head: "Maand" },
  { value: "discipline", label: "Per discipline", icon: HardHat, head: "Discipline" },
];

type SP = { dim?: string; q?: string; year?: string };

export default async function RapportagePage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const now = new Date();
  const START_YEAR = 2026;
  const maxYear = Math.max(START_YEAR, now.getFullYear());
  let year = sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : now.getFullYear();
  year = Math.min(Math.max(year, START_YEAR), maxYear);

  const isYear = sp.q === "all";
  const qNum = isYear ? null : sp.q && /^[1-4]$/.test(sp.q) ? Number(sp.q) : quarterOf(now);
  const qParam = isYear ? "all" : String(qNum);
  const periodStart = isYear ? new Date(year, 0, 1) : new Date(year, (qNum! - 1) * 3, 1);
  const periodEnd = isYear ? new Date(year + 1, 0, 1) : new Date(year, qNum! * 3, 1);
  const periodLabel = isYear ? `${year}` : `Q${qNum} ${year}`;

  const dim: Dim = sp.dim === "maand" ? "maand" : sp.dim === "discipline" ? "discipline" : "klant";
  const dimMeta = DIMS.find((d) => d.value === dim)!;

  const live = { not: "CANCELLED" as const };
  const [invoices, purchases, invoiceLines] = await Promise.all([
    db.invoice.findMany({
      where: { status: live, issueDate: { gte: periodStart, lt: periodEnd } },
      select: { clientId: true, subtotal: true, total: true, status: true, issueDate: true, client: { select: { companyName: true } } },
    }),
    db.purchaseInvoice.findMany({
      where: { status: live, issueDate: { gte: periodStart, lt: periodEnd } },
      select: { subtotal: true, issueDate: true },
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
    for (const p of purchases) {
      const mo = months.find((x) => x.key === mk(new Date(p.issueDate)));
      if (mo) mo.inkoop += p.subtotal;
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

  const periodBtn = (label: string, active: boolean, param: string) => (
    <Link
      href={`/dashboard/rapportage?dim=${dim}&q=${param}&year=${year}`}
      className={cn(
        "rounded-md px-3.5 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-brand-600 text-white" : "text-ink-600 hover:bg-ink-50",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-6">
      <p className="-mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-500">
        Draai je omzet en marge uit per klant, maand of discipline — gescopet op de gekozen periode. Exporteren en meer dimensies volgen.
      </p>

      {/* Periode */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">Periode</span>
        <div className="inline-flex rounded-lg border border-ink-200 bg-white p-0.5">
          {periodBtn("Heel jaar", isYear, "all")}
          {QUARTERS.map((qq) => periodBtn(`Q${qq.value}`, !isYear && qNum === Number(qq.value), qq.value))}
        </div>
        <div className="inline-flex items-center gap-1 rounded-lg border border-ink-200 bg-white p-0.5">
          {year > START_YEAR ? (
            <Link href={`/dashboard/rapportage?dim=${dim}&q=${qParam}&year=${year - 1}`} aria-label="Vorig jaar" className="rounded-md p-1.5 text-ink-500 hover:bg-ink-50 hover:text-ink-900">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          ) : (
            <span className="cursor-not-allowed p-1.5 text-ink-200"><ChevronLeft className="h-4 w-4" /></span>
          )}
          <span className="min-w-[3rem] text-center text-sm font-semibold text-ink-900">{year}</span>
          {year < maxYear ? (
            <Link href={`/dashboard/rapportage?dim=${dim}&q=${qParam}&year=${year + 1}`} aria-label="Volgend jaar" className="rounded-md p-1.5 text-ink-500 hover:bg-ink-50 hover:text-ink-900">
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="cursor-not-allowed p-1.5 text-ink-200"><ChevronRight className="h-4 w-4" /></span>
          )}
        </div>
      </div>

      {/* Dimensie-tabs */}
      <div className="inline-flex flex-wrap gap-1 rounded-lg border border-ink-200 bg-white p-0.5">
        {DIMS.map((d) => (
          <Link
            key={d.value}
            href={`/dashboard/rapportage?dim=${d.value}&q=${qParam}&year=${year}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              dim === d.value ? "bg-violet-600 text-white shadow-sm" : "text-ink-600 hover:bg-ink-50",
            )}
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
