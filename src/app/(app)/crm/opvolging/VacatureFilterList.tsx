"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Briefcase, Building2, MapPin, Users2, CalendarClock, Sparkles, Search } from "lucide-react";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { DISCIPLINES } from "@/lib/domain";
import { cn } from "@/lib/utils";

/** Diacritics-insensitive fold. */
function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export type VacatureItem = {
  id: string;
  title: string;
  company: string;
  clientName: string | null;
  city: string | null;
  discipline: string | null;
  positions: number;
  expectedCloseDate: string | null; // ISO of null
};

/** Gefilterde lijst van openstaande vacatures met zoek + discipline-filter. */
export function VacatureFilterList({ vacatures }: { vacatures: VacatureItem[] }) {
  const [q, setQ] = useState("");
  const [disc, setDisc] = useState("");

  // Alleen disciplines die daadwerkelijk voorkomen, in de dropdown.
  const usedDisciplines = useMemo(
    () => [...new Set(vacatures.map((v) => v.discipline).filter(Boolean) as string[])],
    [vacatures],
  );

  const filtered = useMemo(() => {
    const term = fold(q.trim());
    return vacatures.filter((v) => {
      if (disc && v.discipline !== disc) return false;
      if (!term) return true;
      return [v.title, v.company, v.clientName, v.city]
        .filter(Boolean)
        .some((x) => fold(String(x)).includes(term));
    });
  }, [vacatures, q, disc]);

  return (
    <div className="space-y-3">
      {/* Filterbalk */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Zoek op vacature, bedrijf of plaats…"
            aria-label="Zoek vacature"
            className="block w-full rounded-lg border border-ink-300 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
        <select
          value={disc}
          onChange={(e) => setDisc(e.target.value)}
          aria-label="Filter op discipline"
          className="rounded-lg border border-ink-300 bg-white px-3 py-2 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30 sm:w-56"
        >
          <option value="">Alle disciplines</option>
          {usedDisciplines.map((d) => (
            <option key={d} value={d}>
              {DISCIPLINES.find((x) => x.value === d)?.label ?? d}
            </option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-ink-200 bg-white px-5 py-8 text-center text-sm text-ink-500">
          Geen vacatures gevonden met deze filters.
        </p>
      ) : (
        <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200 bg-white">
          {filtered.map((v) => {
            const due = v.expectedCloseDate ? new Date(v.expectedCloseDate) : null;
            const overdueDate = due && due.getTime() < Date.now();
            return (
              <li key={v.id} className="flex items-center gap-3 px-5 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <Briefcase className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <Link href={`/crm/deals/${v.id}`} className="block truncate font-medium text-ink-900 hover:text-brand-700">
                    {v.title}
                  </Link>
                  <p className="flex items-center gap-2 truncate text-xs text-ink-500">
                    <span className="inline-flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5 text-ink-400" />
                      {v.clientName ?? v.company}
                    </span>
                    {v.city && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-ink-400" /> {v.city}
                      </span>
                    )}
                    {v.positions > 1 && (
                      <span className="inline-flex items-center gap-1">
                        <Users2 className="h-3 w-3 text-ink-400" /> {v.positions} posities
                      </span>
                    )}
                  </p>
                </div>
                <div className="hidden w-28 shrink-0 justify-end sm:flex">
                  {v.discipline && <StatusBadge options={DISCIPLINES} value={v.discipline} />}
                </div>
                <div className="hidden w-24 shrink-0 justify-end sm:flex">
                  {due && (
                    <span className={cn("inline-flex items-center gap-1 text-xs font-medium tabular-nums", overdueDate ? "text-red-600" : "text-ink-400")} title="Verwachte startdatum">
                      <CalendarClock className="h-3.5 w-3.5" /> {due.toLocaleDateString("nl-NL", { day: "2-digit", month: "short" })}
                    </span>
                  )}
                </div>
                <Link
                  href={`/crm/vacatures/${v.id}/match`}
                  title="Laat AI de best passende kandidaten uit de talentpool zoeken"
                  className={cn(buttonVariants({ variant: "primary", size: "sm" }), "shrink-0")}
                >
                  <Sparkles className="h-4 w-4" /> Zoek match
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
