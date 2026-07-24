"use client";

import { useState } from "react";
import Link from "next/link";
import { FolderOpen, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export type CertPerson = {
  id: string;
  name: string;
  count: number;
  soonestLabel: string | null;
  badge: { color: "green" | "amber" | "red" | "slate"; label: string } | null;
  /** Waar de map naartoe linkt: consultant-map of medewerker-dossier. */
  href: string;
  /** Optioneel label, bv. "Eigen medewerker" voor loondienst-personeel. */
  tag?: string | null;
};

export function CertPeopleList({ people }: { people: CertPerson[] }) {
  const [q, setQ] = useState("");
  const term = q.trim().toLowerCase();
  const filtered = term
    ? people.filter((p) => p.name.toLowerCase().includes(term))
    : people;

  return (
    <div className="space-y-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Zoek op naam…"
          aria-label="Zoek medewerker op naam"
          className="block w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
        />
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
          {people.length === 0
            ? "Nog geen medewerkers — voeg er hierboven een toe."
            : `Geen medewerker gevonden voor “${q}”.`}
        </p>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {filtered.map((p) => (
            <Link
              key={p.href}
              href={p.href}
              className="group flex items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-slate-50"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-brand-100 group-hover:text-brand-600">
                  <FolderOpen className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-semibold text-slate-900">{p.name}</span>
                    {p.tag && (
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        {p.tag}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-500">
                    {p.count} certifica{p.count === 1 ? "at" : "ten"}
                    {p.soonestLabel && ` · eerst ${p.soonestLabel}`}
                  </div>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {p.badge && <Badge color={p.badge.color}>{p.badge.label}</Badge>}
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-brand-500" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
