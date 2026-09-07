"use client";

import { useRouter } from "next/navigation";
import { DateInput } from "@/components/ui/date-input";
import { weekHref } from "@/lib/week-nav";

/**
 * Klikbare week-kiezer in de week-balk (src/components/week-balk.tsx). Toont de
 * gekozen week als een box; klikken opent de kalender (weekMode: hele week
 * gemarkeerd) en een datum aanklikken springt naar die week via `?week=`.
 *
 * De filters die al aan stonden (tab, zoekopdracht) geef je mee via `params`,
 * zodat je ze niet kwijtraakt als je van week wisselt.
 */
export function WeekPicker({
  value,
  basePath,
  params,
  className,
}: {
  /** Maandag van de getoonde week als "YYYY-MM-DD". */
  value: string;
  /** Pad om naar te navigeren, bv. "/uren" of "/inbox". */
  basePath: string;
  /** Overige filters die behouden moeten blijven, bv. `{ tab, q }`. */
  params?: Record<string, string | null | undefined>;
  className?: string;
}) {
  const router = useRouter();
  return (
    <DateInput
      weekMode
      value={value}
      onValueChange={(v) => {
        if (v) router.push(weekHref(basePath, v, params), { scroll: false });
      }}
      className={className}
    />
  );
}
