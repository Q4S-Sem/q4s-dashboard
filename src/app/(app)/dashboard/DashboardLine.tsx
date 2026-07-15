"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// Kleine trend-chart (area) voor volume-over-tijd, bijv. geregistreerde uren per
// week. De eerste lijn/area-chart op het dashboard (de rest is grouped bar).

export function DashboardLine({
  data,
  color = "#2a78d6",
  unit = "",
  height = 220,
  emptyLabel = "Nog geen gegevens in deze periode.",
}: {
  data: { label: string; value: number }[];
  color?: string;
  unit?: string;
  height?: number;
  emptyLabel?: string;
}) {
  if (!data.length) {
    return (
      <div className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>
        {emptyLabel}
      </div>
    );
  }
  const fmt = (v: number) => `${new Intl.NumberFormat("nl-NL").format(v)}${unit ? ` ${unit}` : ""}`;
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="q4s-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} stroke="#898781" minTickGap={16} />
        <YAxis tickLine={false} axisLine={false} fontSize={12} stroke="#898781" width={40} />
        <Tooltip
          cursor={{ stroke: "#cbd5e1" }}
          formatter={(value) => fmt(Number(value))}
          contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13 }}
        />
        <Area
          type="monotone"
          dataKey="value"
          name="Uren"
          stroke={color}
          strokeWidth={2}
          fill="url(#q4s-area)"
          dot={false}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
