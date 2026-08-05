"use client";

import Link from "next/link";
import { ExternalLink, Eye, Pause, Play, Trash2, Users, Target } from "lucide-react";
import { SmartList, type SmartColumn, type SmartFilter, type SmartGroup } from "@/components/smart-list";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { buttonVariants } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { VACANCY_STATUSES } from "@/lib/domain";
import { pauseVacancy, resumeVacancy, deleteVacancy } from "../../vacatures/actions";
import { startSourcing } from "../actions";

export type VacancyRow = {
  id: string;
  title: string;
  disciplineRaw: string;
  disciplineLabel: string;
  location: string;
  company: string;
  status: string;
  views: number;
  publishedAt: string | null;
  createdAt: string;
  slug: string;
  sourcing: boolean;
};

export function WebsiteVacaturesList({ rows }: { rows: VacancyRow[] }) {
  const columns: SmartColumn<VacancyRow>[] = [
    {
      key: "title",
      header: "Titel",
      sortValue: (r) => r.title.toLowerCase(),
      render: (r) => (
        <div>
          <Link href={`/vacatures/${r.id}`} className="font-medium text-ink-900 hover:text-brand-700">
            {r.title}
          </Link>
          {(r.company || r.location) && (
            <p className="text-xs text-ink-500">{[r.company, r.location].filter(Boolean).join(" · ")}</p>
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
      key: "status",
      header: "Status",
      sortValue: (r) => r.status,
      render: (r) => <StatusBadge options={VACANCY_STATUSES} value={r.status} />,
    },
    {
      key: "views",
      header: "Weergaven",
      align: "right",
      sortValue: (r) => r.views,
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 font-medium tabular-nums text-ink-900">
          <Eye className="h-3.5 w-3.5 text-ink-400" />
          {r.views}
        </span>
      ),
    },
    {
      key: "publishedAt",
      header: "Gepubliceerd",
      sortValue: (r) => r.publishedAt ?? "",
      render: (r) => (r.publishedAt ? <span className="tabular-nums text-ink-600">{formatDate(new Date(r.publishedAt))}</span> : <span className="text-ink-400">—</span>),
    },
    {
      key: "kandidaten",
      header: "Kandidaten",
      render: (r) =>
        r.sourcing ? (
          <Link
            href="/website/cv-inbox/matches"
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
          >
            <Target className="h-3.5 w-3.5" /> Op matchpagina
          </Link>
        ) : (
          <form action={startSourcing}>
            <input type="hidden" name="vacancyId" value={r.id} />
            <button type="submit" className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
              <Users className="h-4 w-4" /> Zoek kandidaten
            </button>
          </form>
        ),
    },
    {
      key: "acties",
      header: "Acties",
      align: "right",
      render: (r) => (
        <div className="flex items-center justify-end gap-1">
          {r.status === "PUBLISHED" ? (
            <>
              <a
                href={`/vacature/${r.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-50"
                title="Bekijk op de website"
              >
                Bekijk <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <ConfirmSubmit
                action={pauseVacancy}
                id={r.id}
                hidden={{ from: "website" }}
                message={`Vacature "${r.title}" pauzeren? Hij gaat direct offline op de website.`}
                variant="outline"
                size="sm"
              >
                <Pause className="h-4 w-4" /> Pauzeren
              </ConfirmSubmit>
            </>
          ) : r.status === "PAUSED" ? (
            <ConfirmSubmit
              action={resumeVacancy}
              id={r.id}
              hidden={{ from: "website" }}
              message={`Vacature "${r.title}" hervatten? Hij gaat direct weer live op de website.`}
              variant="success"
              size="sm"
            >
              <Play className="h-4 w-4" /> Hervatten
            </ConfirmSubmit>
          ) : (
            <Link href={`/vacatures/${r.id}`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-50">
              Bewerken
            </Link>
          )}
          <ConfirmSubmit
            action={deleteVacancy}
            id={r.id}
            message={`Vacature "${r.title}" verwijderen? Dit haalt hem ook direct van de website.`}
            variant="ghost"
            size="sm"
          >
            <Trash2 className="h-4 w-4" />
          </ConfirmSubmit>
        </div>
      ),
    },
  ];

  const uniqDisc = new Map<string, string>();
  for (const r of rows) if (r.disciplineRaw && !uniqDisc.has(r.disciplineRaw)) uniqDisc.set(r.disciplineRaw, r.disciplineLabel || r.disciplineRaw);

  const filters: SmartFilter<VacancyRow>[] = [
    { key: "status", label: "Statussen", value: (r) => r.status, options: VACANCY_STATUSES.map((o) => ({ value: o.value, label: o.label })) },
    { key: "discipline", label: "Disciplines", value: (r) => r.disciplineRaw, options: [...uniqDisc.entries()].map(([v, l]) => ({ value: v, label: l })).sort((a, b) => a.label.localeCompare(b.label, "nl")) },
  ];

  const groups: SmartGroup<VacancyRow>[] = [
    { key: "status", label: "Status", value: (r) => r.status, display: (r) => VACANCY_STATUSES.find((o) => o.value === r.status)?.label ?? r.status },
    { key: "discipline", label: "Discipline", value: (r) => r.disciplineRaw || "—", display: (r) => r.disciplineLabel || "Zonder discipline" },
  ];

  return (
    <SmartList
      rows={rows}
      columns={columns}
      search={(r) => `${r.title} ${r.disciplineLabel} ${r.location} ${r.company}`}
      searchPlaceholder="Zoek op titel, discipline, plaats…"
      filters={filters}
      groups={groups}
      initialSort={{ key: "publishedAt", dir: "desc" }}
      emptyLabel="Nog geen vacatures."
    />
  );
}
