import Link from "next/link";
import {
  Scale,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Info,
  FileWarning,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { cn, formatCurrency } from "@/lib/utils";
import { btwOverview } from "@/lib/boekhouding";
import { QUARTERS } from "@/lib/domain";

export const metadata = { title: "Boekhouding & BTW" };
export const dynamic = "force-dynamic";

const START_YEAR = 2024;
const quarterOf = (d: Date) => Math.floor(d.getMonth() / 3) + 1;

type SP = { q?: string; year?: string };

export default async function BoekhoudingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const now = new Date();
  const maxYear = now.getFullYear();

  let year = sp.year && /^\d{4}$/.test(sp.year) ? Number(sp.year) : now.getFullYear();
  year = Math.min(Math.max(year, START_YEAR), maxYear);
  const isYear = sp.q === "jaar";
  const qNum = isYear ? null : sp.q && /^[1-4]$/.test(sp.q) ? Number(sp.q) : quarterOf(now);

  const o = await btwOverview({ year, quarter: qNum });

  const teBetalen = o.saldo >= 0;
  const qParam = isYear ? "jaar" : String(qNum);

  const periodBtn = (label: string, active: boolean, q: string) => (
    <Link
      href={`/boekhouding?q=${q}&year=${year}`}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Boekhouding & BTW"
        description="Wat er in- en uitgaat, en hoeveel BTW je kunt terugvorderen — per kwartaal of jaar."
      />

      {/* Periode-filter */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {QUARTERS.map((q) => periodBtn(q.label.replace(/ .*/, ""), !isYear && qNum === Number(q.value), q.value))}
          {periodBtn("Heel jaar", isYear, "jaar")}
        </div>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          {year > START_YEAR ? (
            <Link href={`/boekhouding?q=${qParam}&year=${year - 1}`} aria-label="Vorig jaar" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900">
              <ChevronLeft className="h-4 w-4" />
            </Link>
          ) : (
            <span className="p-1.5 text-slate-200"><ChevronLeft className="h-4 w-4" /></span>
          )}
          <span className="min-w-[3rem] text-center text-sm font-semibold text-slate-900">{year}</span>
          {year < maxYear ? (
            <Link href={`/boekhouding?q=${qParam}&year=${year + 1}`} aria-label="Volgend jaar" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-900">
              <ChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span className="p-1.5 text-slate-200"><ChevronRight className="h-4 w-4" /></span>
          )}
        </div>
      </div>

      {/* BTW-aangifte-indicatie */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Scale className="h-5 w-5 text-slate-400" /> BTW — {o.period.label}
          </CardTitle>
          <span className="text-sm text-slate-400">
            Verschuldigd over je omzet, min de voorbelasting die je terugvordert.
          </span>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Verschuldigde BTW"
            value={formatCurrency(o.verschuldigd)}
            sub={`over ${formatCurrency(o.verkoop.net)} omzet · ${o.verkoop.count} facturen`}
            accent="amber"
            icon={<ArrowUpFromLine className="h-5 w-5" />}
          />
          <StatCard
            label="Voorbelasting (terug)"
            value={formatCurrency(o.voorbelasting)}
            sub={`uit ${o.voorbelastingBronnen.length} ${o.voorbelastingBronnen.length === 1 ? "bron" : "bronnen"}`}
            accent="green"
            icon={<ArrowDownToLine className="h-5 w-5" />}
          />
          <StatCard
            label={teBetalen ? "Te betalen aan Belastingdienst" : "Terug te vorderen"}
            value={formatCurrency(Math.abs(o.saldo))}
            sub={teBetalen ? "verschuldigd − voorbelasting" : "voorbelasting − verschuldigd"}
            accent={teBetalen ? "red" : "green"}
            icon={<Scale className="h-5 w-5" />}
          />
        </CardContent>
      </Card>

      {/* Signalen — dingen die de gebruiker moet zien voor het klopt */}
      {(o.concepten.salesCount > 0 ||
        o.onbekendeBtw.count > 0 ||
        o.mogelijkeDubbeltelling.length > 0 ||
        o.nietAftrekbaar.count > 0) && (
        <div className="space-y-2">
          {o.concepten.salesCount > 0 && (
            <Notice tone="info" icon={<Info className="h-4 w-4" />}>
              <strong>{o.concepten.salesCount} concept-{o.concepten.salesCount === 1 ? "verkoopfactuur" : "verkoopfacturen"}</strong>{" "}
              ({formatCurrency(o.concepten.salesVat)} BTW) tellen nog niet mee — pas als je ze verstuurt.
              {o.concepten.purchaseCount > 0 && (
                <> Ook {o.concepten.purchaseCount} concept-inkoop ({formatCurrency(o.concepten.purchaseVat)} BTW) staat nog open.</>
              )}
            </Notice>
          )}
          {o.onbekendeBtw.count > 0 && (
            <Notice tone="amber" icon={<FileWarning className="h-4 w-4" />}>
              <strong>{o.onbekendeBtw.count} {o.onbekendeBtw.count === 1 ? "post" : "posten"} zonder BTW-bedrag</strong>{" "}
              ({formatCurrency(o.onbekendeBtw.grossTotal)} incl.) — vul de BTW in bij die bonnen/facturen, anders mis je die voorbelasting.
            </Notice>
          )}
          {o.mogelijkeDubbeltelling.length > 0 && (
            <Notice tone="red" icon={<AlertTriangle className="h-4 w-4" />}>
              <strong>Mogelijke dubbeltelling:</strong> {o.mogelijkeDubbeltelling.map((d) => d.name).join(", ")}{" "}
              {o.mogelijkeDubbeltelling.length === 1 ? "heeft" : "hebben"} zowel een inkoopfactuur als een meetellende ontvangen factuur in deze periode. Controleer of de voorbelasting niet dubbel telt.
            </Notice>
          )}
          {o.nietAftrekbaar.count > 0 && (
            <Notice tone="info" icon={<Info className="h-4 w-4" />}>
              {o.nietAftrekbaar.count} niet-aftrekbare {o.nietAftrekbaar.count === 1 ? "bon" : "bonnen"} — hun BTW ({formatCurrency(o.nietAftrekbaar.vatExcluded)}) is bewust <em>niet</em> meegeteld.
            </Notice>
          )}
        </div>
      )}

      {/* Voorbelasting-uitsplitsing */}
      {o.voorbelastingBronnen.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Voorbelasting per bron</CardTitle>
            <span className="text-sm text-slate-400">Waar je terugvorderbare BTW vandaan komt.</span>
          </CardHeader>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Bron</TH>
                <TH className="text-right">Aantal</TH>
                <TH className="text-right">Grondslag (excl.)</TH>
                <TH className="text-right">BTW</TH>
              </TR>
            </THead>
            <TBody>
              {o.voorbelastingBronnen.map((b) => (
                <TR key={b.key}>
                  <TD className="font-medium text-slate-900">
                    {b.label}
                    {b.unknownVatCount > 0 && (
                      <span className="ml-2 text-xs text-amber-600">
                        {b.unknownVatCount} zonder BTW
                      </span>
                    )}
                  </TD>
                  <TD className="text-right text-slate-600">{b.count}</TD>
                  <TD className="text-right text-slate-600">{formatCurrency(b.net)}</TD>
                  <TD className="text-right font-semibold text-slate-900">{formatCurrency(b.vat)}</TD>
                </TR>
              ))}
              <TR className="hover:bg-transparent">
                <TD className="font-semibold text-slate-900">Totaal voorbelasting</TD>
                <TD />
                <TD />
                <TD className="text-right font-bold text-emerald-700">{formatCurrency(o.voorbelasting)}</TD>
              </TR>
            </TBody>
          </Table>
        </Card>
      )}

      {/* Geldstroom in/uit */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-slate-400" /> Geldstroom {o.period.label}
          </CardTitle>
          <span className="text-sm text-slate-400">
            Incl. BTW, op factuurdatum. Uit = inkoop + meetellende ontvangen facturen + bonnetjes.
          </span>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Erin (verkoop)" value={formatCurrency(o.geldIn)} accent="green" icon={<ArrowDownToLine className="h-5 w-5" />} />
          <StatCard label="Eruit (inkoop + kosten)" value={formatCurrency(o.geldUit)} accent="amber" icon={<ArrowUpFromLine className="h-5 w-5" />} />
          <StatCard
            label="Netto"
            value={formatCurrency(o.geldNetto)}
            accent={o.geldNetto >= 0 ? "green" : "red"}
            icon={<TrendingUp className="h-5 w-5" />}
          />
        </CardContent>
      </Card>

      {/* Disclaimer */}
      <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-500">
        <strong className="text-slate-600">Let op:</strong> dit is een management-overzicht ter voorbereiding en controle, geen
        officiële BTW-aangifte. De echte aangifte doe je via je boekhouder of de Belastingdienst. Verlegde BTW, buitenlandse
        leveranciers, intracommunautaire leveringen en privégebruik vallen buiten deze berekening.
      </p>
    </div>
  );
}

function Notice({
  tone,
  icon,
  children,
}: {
  tone: "info" | "amber" | "red";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const styles = {
    info: "border-slate-200 bg-slate-50 text-slate-600",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
    red: "border-red-200 bg-red-50 text-red-700",
  }[tone];
  return (
    <div className={cn("flex items-start gap-2.5 rounded-lg border px-4 py-2.5 text-sm", styles)}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <p className="min-w-0">{children}</p>
    </div>
  );
}
