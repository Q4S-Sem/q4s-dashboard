"use client";

import { useRouter } from "next/navigation";
import { DateInput } from "@/components/ui/date-input";

/**
 * Klikbare week-kiezer voor de week-navigators (uren, inbox, timesheet-status).
 * Toont de huidige week als een box; klikken opent de kalender (weekMode: hele
 * week gemarkeerd) en een datum aanklikken springt naar die week via `?week=`.
 */
export function WeekPicker({
  value,
  basePath,
  className,
}: {
  /** Maandag van de huidige week als "YYYY-MM-DD". */
  value: string;
  /** Pad om naar te navigeren, bv. "/uren" of "/inbox". */
  basePath: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <DateInput
      weekMode
      value={value}
      onValueChange={(v) => {
        if (v) router.push(`${basePath}?week=${v}`);
      }}
      className={className}
    />
  );
}
