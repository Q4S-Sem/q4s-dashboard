import * as React from "react";
import { sparklinePath, sparklineAreaPath } from "@/lib/sparkline";

// Kleuren volgen de DashColor-tinten (Tailwind -600) die de kaarten al dragen.
const STROKE: Record<string, string> = {
  blue: "#2563eb",
  emerald: "#059669",
  violet: "#7c3aed",
  amber: "#d97706",
  slate: "#a8a8a3",
};

/**
 * Mini-trendlijn onderin een KPI-kaart. Server component — puur SVG, geen JS.
 * De lijn tekent zichzelf in via de bestaande spark-draw keyframe (globals.css);
 * reduced motion toont hem direct.
 */
export function Sparkline({
  values,
  color = "blue",
  className,
}: {
  values: number[];
  color?: string;
  className?: string;
}) {
  const W = 120;
  const H = 28;
  const line = sparklinePath(values, W, H);
  if (!line) return null;
  const area = sparklineAreaPath(values, W, H);
  const stroke = STROKE[color] ?? STROKE.blue;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={className ?? "mt-3 h-7 w-full"}
      aria-hidden="true"
    >
      <path d={area} fill={stroke} opacity={0.08} />
      <path
        d={line}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        pathLength={100}
        className="animate-spark-draw"
      />
    </svg>
  );
}
