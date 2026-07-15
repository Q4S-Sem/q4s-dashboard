"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

// Gevalideerd categorisch palet (dataviz-skill, licht, wit oppervlak):
// Omzet = blauw, Inkoop = violet, Marge = groen. Worst adjacent CVD ΔE 103.7,
// alle contrast >= 3:1. Legenda geeft de identiteit (nooit kleur alleen).
const OMZET = "#2a78d6";
const INKOOP = "#4a3aa7";
const MARGE = "#008300";

export function DashboardChart({
  data,
}: {
  data: { month: string; omzet: number; inkoop: number; marge: number }[];
}) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        barGap={2}
        barCategoryGap="22%"
      >
        {/* Hairline grid, solide (nooit gestreept), recessief. */}
        <CartesianGrid vertical={false} stroke="#e2e8f0" />
        <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} stroke="#898781" />
        <YAxis
          tickFormatter={(v) => `€${Math.round(Number(v) / 1000)}k`}
          tickLine={false}
          axisLine={false}
          fontSize={12}
          stroke="#898781"
          width={52}
        />
        <Tooltip
          cursor={{ fill: "rgba(15,23,42,0.04)" }}
          formatter={(value) => formatCurrency(Number(value))}
          contentStyle={{ borderRadius: 10, border: "1px solid #e2e8f0", fontSize: 13 }}
        />
        <Legend wrapperStyle={{ fontSize: 13, paddingTop: 8 }} iconType="circle" />
        <Bar dataKey="omzet" name="Omzet" fill={OMZET} radius={[4, 4, 0, 0]} maxBarSize={16} />
        <Bar dataKey="inkoop" name="Inkoop" fill={INKOOP} radius={[4, 4, 0, 0]} maxBarSize={16} />
        <Bar dataKey="marge" name="Marge" fill={MARGE} radius={[4, 4, 0, 0]} maxBarSize={16} />
      </BarChart>
    </ResponsiveContainer>
  );
}
