"use client";

import Link from "next/link";
import { CvPreviewButton } from "@/components/cv-preview-button";
import { SmartList, type SmartColumn } from "@/components/smart-list";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { CANDIDATE_SOURCES, CANDIDATE_AVAILABILITY } from "@/lib/domain";
import type { Herkomst } from "@/lib/eu-herkomst";

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
  cvName: string;
  cvMime: string;
  dealId: string | null;
  herkomst: Herkomst;
};

const HERKOMST: Record<Herkomst, { label: string; color: "green" | "red" | "slate" }> = {
  EU: { label: "EU", color: "green" },
  BUITEN_EU: { label: "Buiten EU", color: "red" },
  ONBEKEND: { label: "Onbekend", color: "slate" },
};

export function CvsList({ rows }: { rows: CvRow[] }) {
  const columns: SmartColumn<CvRow>[] = [
    {
      key: "name",
      header: "Kandidaat",
      sortValue: (r) => r.name.toLowerCase(),
      render: (r) => (
        <div>
          <Link href={`/kandidaten/${r.id}`} className="font-medium text-ink-900 hover:text-brand-700">
            {r.name}
          </Link>
          {(r.headline || r.location || r.email) && (
            <p className="text-xs text-ink-500">
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
      render: (r) => (r.disciplineLabel ? <span className="text-ink-700">{r.disciplineLabel}</span> : <span className="text-ink-400">—</span>),
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
      render: (r) => <span className="tabular-nums text-ink-600">{formatDate(new Date(r.createdAt))}</span>,
    },
    {
      key: "herkomst",
      header: "Herkomst",
      sortValue: (r) => r.herkomst,
      render: (r) => <Badge color={HERKOMST[r.herkomst].color}>{HERKOMST[r.herkomst].label}</Badge>,
    },
    {
      key: "cv",
      header: "CV",
      align: "right",
      render: (r) =>
        r.cvHref ? (
          <CvPreviewButton
            src={r.cvHref}
            name={r.cvName}
            mime={r.cvMime}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-ink-200 bg-white text-ink-600 transition-colors hover:border-ink-400 hover:text-ink-900 hover:no-underline"
          />
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
  ];

  return (
    <SmartList
      rows={rows}
      columns={columns}
      initialSort={{ key: "createdAt", dir: "desc" }}
      emptyLabel="Nog geen CV's binnengekomen."
    />
  );
}
