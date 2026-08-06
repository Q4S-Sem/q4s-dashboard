import Link from "next/link";
import {
  Briefcase,
  Users,
  Coins,
  Percent,
  TrendingUp,
  Building2,
  HardHat,
} from "lucide-react";
import { db } from "@/lib/db";
import { CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatCurrency, round2 } from "@/lib/utils";
import { DISCIPLINES, PLACEMENT_STATUSES, labelFor } from "@/lib/domain";
import { SectionCard, ActionLink, Bar, Empty } from "../_ui";

export const metadata = { title: "Plaatsingen & marges" };
export const dynamic = "force-dynamic";

/** Margin % of a placement; guards against chargeRate = 0. */
function marginPct(charge: number, cost: number): number {
  if (charge <= 0) return 0;
  return round2(((charge - cost) / charge) * 100);
}

export default async function PlaatsingenMargesPage() {
  const placements = await db.placement.findMany({
    where: { status: "ACTIVE" },
    include: { consultant: true, client: true },
  });

  // ---- KPI's ----
  const actief = placements.length;
  const mensen = new Set(placements.map((p) => p.consultantId)).size;
  const avgMargePerHour =
    actief > 0
      ? round2(
          placements.reduce((s, p) => s + (p.chargeRate - p.costRate), 0) / actief,
        )
      : 0;
  const avgMargePct =
    actief > 0
      ? round2(
          placements.reduce((s, p) => s + marginPct(p.chargeRate, p.costRate), 0) /
            actief,
        )
      : 0;

  // ---- Marge per plaatsing (aflopend op marge/uur) ----
  const rows = [...placements].sort(
    (a, b) => b.chargeRate - b.costRate - (a.chargeRate - a.costRate),
  );

  // ---- Marge per klant (som marge/uur, actieve plaatsingen) ----
  const perClientMap = new Map<
    string,
    { id: string; name: string; sum: number; count: number }
  >();
  for (const p of placements) {
    // Plaatsingen zonder gekoppeld bedrijf tellen niet mee in de marge-per-klant.
    if (!p.clientId || !p.client) continue;
    const cur = perClientMap.get(p.clientId) ?? {
      id: p.clientId,
      name: p.client.companyName,
      sum: 0,
      count: 0,
    };
    cur.sum = round2(cur.sum + (p.chargeRate - p.costRate));
    cur.count += 1;
    perClientMap.set(p.clientId, cur);
  }
  const perClient = [...perClientMap.values()].sort((a, b) => b.sum - a.sum);
  const maxClientSum = Math.max(1, ...perClient.map((c) => c.sum));

  // ---- Plaatsingen per discipline ----
  const perDisciplineMap = new Map<string, number>();
  for (const p of placements) {
    const key = p.consultant.discipline || "OVERIG";
    perDisciplineMap.set(key, (perDisciplineMap.get(key) ?? 0) + 1);
  }
  const perDiscipline = [...perDisciplineMap.entries()]
    .map(([value, count]) => ({
      value,
      label: labelFor(DISCIPLINES, value),
      count,
    }))
    .sort((a, b) => b.count - a.count);
  const maxDisciplineCount = Math.max(1, ...perDiscipline.map((d) => d.count));

  return (
    <div className="space-y-8">
      <p className="-mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-500">
        De marge per actieve plaatsing, per klant en per discipline — zo zie je in één oogopslag waar het geld verdiend wordt.
      </p>

      {/* Kerncijfers */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Actieve plaatsingen"
          value={actief}
          icon={<Briefcase className="h-5 w-5" />}
          accent="slate"
        />
        <StatCard
          label="Werknemers actief"
          value={mensen}
          sub="unieke personen"
          icon={<HardHat className="h-5 w-5" />}
          accent="slate"
        />
        <StatCard
          label="Gem. marge per uur"
          value={`${formatCurrency(avgMargePerHour)}/u`}
          icon={<Coins className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          label="Gem. marge %"
          value={`${avgMargePct.toLocaleString("nl-NL")}%`}
          icon={<Percent className="h-5 w-5" />}
          accent="green"
        />
      </div>

      {/* Marge per plaatsing */}
      <SectionCard
        icon={<TrendingUp className="h-4 w-4" />}
        title="Marge per plaatsing"
        action={<ActionLink href="/plaatsingen">Alle plaatsingen →</ActionLink>}
      >
        {rows.length === 0 ? (
          <Empty>Nog geen actieve plaatsingen.</Empty>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Persoon</TH>
                <TH>Klant</TH>
                <TH>Functie</TH>
                <TH className="text-right">Inkoop</TH>
                <TH className="text-right">Verkoop</TH>
                <TH className="text-right">Marge/uur</TH>
                <TH className="text-right">Marge %</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {rows.map((p) => {
                const margePerHour = round2(p.chargeRate - p.costRate);
                const pct = marginPct(p.chargeRate, p.costRate);
                return (
                  <TR key={p.id}>
                    <TD>
                      <Link
                        href={`/plaatsingen/${p.id}`}
                        className="font-medium text-ink-900 hover:text-emerald-700"
                      >
                        {p.consultant.firstName} {p.consultant.lastName}
                      </Link>
                    </TD>
                    <TD className="text-ink-600">{p.client?.companyName ?? "— geen bedrijf"}</TD>
                    <TD className="text-ink-600">{p.title}</TD>
                    <TD className="text-right tabular-nums">
                      {formatCurrency(p.costRate)}/u
                    </TD>
                    <TD className="text-right tabular-nums">
                      {formatCurrency(p.chargeRate)}/u
                    </TD>
                    <TD className="text-right font-medium tabular-nums text-emerald-700">
                      {formatCurrency(margePerHour)}/u
                    </TD>
                    <TD className="text-right tabular-nums text-ink-700">
                      {pct.toLocaleString("nl-NL")}%
                    </TD>
                    <TD>
                      <StatusBadge options={PLACEMENT_STATUSES} value={p.status} />
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        )}
      </SectionCard>

      {/* Marge per klant + per discipline */}
      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          icon={<Building2 className="h-4 w-4" />}
          title="Marge per klant"
          action={
            <span className="hidden shrink-0 text-sm text-ink-400 sm:inline">
              som marge/uur · actief
            </span>
          }
        >
          {perClient.length === 0 ? (
            <Empty>Nog geen actieve plaatsingen.</Empty>
          ) : (
            <CardContent>
              <div className="space-y-3">
                {perClient.map((c) => (
                  <Bar
                    key={c.id}
                    label={
                      <Link
                        href={`/klanten/${c.id}`}
                        className="hover:text-ink-900"
                        title={c.name}
                      >
                        {c.name}
                      </Link>
                    }
                    value={c.sum}
                    max={maxClientSum}
                    color="green"
                    display={`${formatCurrency(c.sum)}/u`}
                  />
                ))}
              </div>
            </CardContent>
          )}
        </SectionCard>

        <SectionCard
          icon={<Users className="h-4 w-4" />}
          title="Plaatsingen per discipline"
          action={
            <span className="hidden shrink-0 text-sm text-ink-400 sm:inline">
              aantal · actief
            </span>
          }
        >
          {perDiscipline.length === 0 ? (
            <Empty>Nog geen actieve plaatsingen.</Empty>
          ) : (
            <CardContent>
              <div className="space-y-3">
                {perDiscipline.map((d) => (
                  <Bar
                    key={d.value}
                    label={d.label}
                    value={d.count}
                    max={maxDisciplineCount}
                    color="slate"
                    display={d.count.toLocaleString("nl-NL")}
                  />
                ))}
              </div>
            </CardContent>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
