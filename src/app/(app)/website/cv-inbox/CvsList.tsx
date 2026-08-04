"use client";

import Link from "next/link";
import { FileText, ExternalLink, ArrowRight, CheckCircle2 } from "lucide-react";
import { SmartList, type SmartColumn, type SmartFilter, type SmartGroup } from "@/components/smart-list";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, cn } from "@/lib/utils";
import { CANDIDATE_SOURCES, CANDIDATE_AVAILABILITY } from "@/lib/domain";
import { convertCvToLead } from "../actions";

export type CvRow = {
  id: string;
  name: string;
  email: string;
  location: string;
  headline: string;
  disciplineRaw: string;
  disciplineLabel: string;
  source: string;
  availability: string;
  createdAt: string;
  cvHref: string | null;
  dealId: string | null;
};

/** Bouw filter-opties uit de waarden die echt voorkomen (met nette labels). */
function optionsFrom(
  rows: CvRow[],
  value: (r: CvRow) => string,
  label: (r: CvRow) => string,
): { value: string; label: string }[] {
  const m = new Map<string, string>();
  for (const r of rows) {
    const v = value(r);
    if (v && !m.has(v)) m.set(v, label(r) || v);
  }
  return [...m.entries()]
    .map(([v, l]) => ({ value: v, label: l }))
    .sort((a, b) => a.label.localeCompare(b.label, "nl"));
}

export function CvsList({ rows }: { rows: CvRow[] }) {
  const columns: SmartColumn<CvRow>[] = [
    {
      key: "name",
      header: "Kandidaat",
      sortValue: (r) => r.name.toLowerCase(),
      render: (r) => (
        <div>
          <Link href={`/kandidaten/${r.id}`} className="font-medium text-slate-900 hover:text-brand-700">
            {r.name}
          </Link>
          {(r.headline || r.location || r.email) && (
            <p className="text-xs text-slate-500">
              {[r.headline, r.location, r.email].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      ),
    },
    {
      key: "discipline",
      header: "Discipline",
      sortValue: (r) => r.disciplineLabel.toLowerCase(),
      render: (r) => (r.disciplineLabel ? <span className="text-slate-700">{r.disciplineLabel}</span> : <span className="text-slate-400">—</span>),
    },
    {
      key: "source",
      header: "Bron",
      sortValue: (r) => r.source,
      render: (r) => <StatusBadge options={CANDIDATE_SOURCES} value={r.source} />,
    },
    {
      key: "availability",
      header: "Beschikbaar",
      sortValue: (r) => r.availability,
      render: (r) => <StatusBadge options={CANDIDATE_AVAILABILITY} value={r.availability} />,
    },
    {
      key: "createdAt",
      header: "Binnengekomen",
      sortValue: (r) => r.createdAt,
      render: (r) => <span className="tabular-nums text-slate-600">{formatDate(new Date(r.createdAt))}</span>,
    },
    {
      key: "cv",
      header: "CV",
      render: (r) =>
        r.cvHref ? (
          <a
            href={r.cvHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            <FileText className="h-4 w-4" /> Bekijk <ExternalLink className="h-3 w-3 text-slate-400" />
          </a>
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: "actie",
      header: "Naar CRM",
      align: "right",
      render: (r) =>
        r.dealId ? (
          <Link
            href={`/crm/deals/${r.dealId}`}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <CheckCircle2 className="h-3.5 w-3.5" /> In CRM
          </Link>
        ) : (
          <form action={convertCvToLead}>
            <input type="hidden" name="candidateId" value={r.id} />
            <button type="submit" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              Als lead <ArrowRight className="h-4 w-4" />
            </button>
          </form>
        ),
    },
  ];

  const filters: SmartFilter<CvRow>[] = [
    { key: "discipline", label: "Disciplines", value: (r) => r.disciplineRaw, options: optionsFrom(rows, (r) => r.disciplineRaw, (r) => r.disciplineLabel) },
    { key: "source", label: "Bronnen", value: (r) => r.source, options: CANDIDATE_SOURCES.map((o) => ({ value: o.value, label: o.label })) },
    { key: "availability", label: "Beschikbaarheid", value: (r) => r.availability, options: CANDIDATE_AVAILABILITY.map((o) => ({ value: o.value, label: o.label })) },
    { key: "crm", label: "CRM-status", value: (r) => (r.dealId ? "in" : "out"), options: [
      { value: "out", label: "Nog niet in CRM" },
      { value: "in", label: "Al lead in CRM" },
    ] },
  ];

  const groups: SmartGroup<CvRow>[] = [
    { key: "discipline", label: "Discipline", value: (r) => r.disciplineRaw || "—", display: (r) => r.disciplineLabel || "Zonder discipline" },
    { key: "source", label: "Bron", value: (r) => r.source, display: (r) => CANDIDATE_SOURCES.find((o) => o.value === r.source)?.label ?? r.source },
    { key: "availability", label: "Beschikbaarheid", value: (r) => r.availability, display: (r) => CANDIDATE_AVAILABILITY.find((o) => o.value === r.availability)?.label ?? r.availability },
  ];

  return (
    <SmartList
      rows={rows}
      columns={columns}
      search={(r) => `${r.name} ${r.email} ${r.disciplineLabel} ${r.location} ${r.headline}`}
      searchPlaceholder="Zoek op naam, discipline, plaats…"
      filters={filters}
      groups={groups}
      initialSort={{ key: "createdAt", dir: "desc" }}
      emptyLabel="Nog geen CV's binnengekomen."
    />
  );
}
