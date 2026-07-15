"use client";

import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { formatCurrency } from "@/lib/utils";

// Herbruikbaar cirkeldiagram (donut) voor samenstelling/verdeling op het
// dashboard. Pie-charts hebben ALTIJD een legenda met labels + waarden + %
// (nooit kleur alleen), zodat ze ook zonder kleur leesbaar zijn.

export type PieDatum = { name: string; value: number; color: string };

export function DashboardPie({
  data,
  kind = "count",
  size = 190,
  centerLabel,
  emptyLabel = "Nog geen gegevens in deze periode.",
}: {
  data: PieDatum[];
  /** Getalnotatie in tooltip/legenda/center. */
  kind?: "currency" | "count";
  /** Diameter van de donut in px. */
  size?: number;
  /** Klein label onder het totaal in het midden. */
  centerLabel?: string;
  emptyLabel?: string;
}) {
  const fmt = (v: number) => (kind === "currency" ? formatCurrency(v) : new Intl.NumberFormat("nl-NL").format(v));
  const shown = data.filter((d) => d.value > 0).sort((a, b) => b.value - a.value);
  const total = shown.reduce((s, d) => s + d.value, 0);

  if (total <= 0 || shown.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-sm text-slate-400"
        style={{ minHeight: size }}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={shown}
              dataKey="value"
              nameKey="name"
              innerRadius="70%"
              outerRadius="100%"
              paddingAngle={1.5}
              stroke="#ffffff"
              strokeWidth={2}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {shown.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        {/* Totaal in het (ruime, witte) gat van de donut — fors en vet, zonder
            kader, zodat het bedrag netjes past en toch duidelijk leesbaar is. */}
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center px-2 text-center">
          <span className="text-lg font-extrabold leading-tight tracking-tight text-slate-900">
            {fmt(total)}
          </span>
          {centerLabel && (
            <span className="mt-0.5 text-[11px] font-semibold text-slate-500">{centerLabel}</span>
          )}
        </div>
      </div>

      {/* Legenda: label + waarde + percentage */}
      <ul className="w-full flex-1 space-y-1.5">
        {shown.map((d) => {
          const pct = Math.round((d.value / total) * 100);
          return (
            <li key={d.name} className="flex items-center gap-2 text-sm">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: d.color }} />
              <span className="min-w-0 flex-1 truncate text-slate-600">{d.name}</span>
              <span className="shrink-0 font-semibold tabular-nums text-slate-900">{fmt(d.value)}</span>
              <span className="w-9 shrink-0 text-right text-xs tabular-nums text-slate-400">{pct}%</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
