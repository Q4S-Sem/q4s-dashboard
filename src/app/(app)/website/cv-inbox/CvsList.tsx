"use client";

import Link from "next/link";
import { FileText, ExternalLink, ArrowRight, CheckCircle2 } from "lucide-react";
import { SmartList, type SmartColumn } from "@/components/smart-list";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { formatDate, cn } from "@/lib/utils";
import { CANDIDATE_SOURCES, CANDIDATE_AVAILABILITY } from "@/lib/domain";
import { convertCvToLead, shortlistCv } from "../actions";

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
      key: "cv",
      header: "CV",
      render: (r) =>
        r.cvHref ? (
          <a
            href={r.cvHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 hover:underline underline-offset-2"
          >
            <FileText className="h-4 w-4" /> Bekijk <ExternalLink className="h-3 w-3 text-ink-400" />
          </a>
        ) : (
          <span className="text-ink-400">—</span>
        ),
    },
    {
      key: "actie",
      header: "Acties",
      align: "right",
      render: (r) => (
        <div className="flex justify-end gap-2">
          <form action={shortlistCv}>
            <input type="hidden" name="candidateId" value={r.id} />
            <button type="submit" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <FileText className="h-4 w-4" /> Shortlist
            </button>
          </form>
          {r.dealId ? (
            <Link
              href={`/crm/deals/${r.dealId}`}
              className="inline-flex items-center gap-1.5 rounded-sm bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
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
          )}
        </div>
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
