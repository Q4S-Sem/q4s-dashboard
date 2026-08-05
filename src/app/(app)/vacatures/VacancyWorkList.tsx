"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Search,
  MapPin,
  Eye,
  Rocket,
  Pause,
  Play,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Sparkles,
  Send,
  FileText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { FolderTabBar, FolderTab } from "@/components/dossier-tabs";
import { StatusBadge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/ui/submit-button";
import { DISCIPLINES, VACANCY_STATUSES } from "@/lib/domain";
import { cn, formatDate } from "@/lib/utils";
import { publishVacancy, pauseVacancy, resumeVacancy } from "./actions";

export type WorkVacancy = {
  id: string;
  title: string;
  slug: string;
  discipline: string | null;
  location: string | null;
  companyName: string | null;
  sourceName: string | null;
  status: string;
  views: number;
  publishedAt: string | null;
  createdAt: string;
  /** Hoeveel van de drie websitesecties zijn ingevuld. */
  filled: number;
  total: number;
};

type TabKey = "todo" | "live" | "paused" | "incomplete" | "all";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "todo", label: "Nog te versturen", icon: <Send className="h-4 w-4" /> },
  { key: "live", label: "Live op de site", icon: <Rocket className="h-4 w-4" /> },
  { key: "paused", label: "Gepauzeerd", icon: <Pause className="h-4 w-4" /> },
  { key: "incomplete", label: "Onvolledig", icon: <AlertTriangle className="h-4 w-4" /> },
  { key: "all", label: "Alles", icon: <FileText className="h-4 w-4" /> },
];

function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function matchesTab(v: WorkVacancy, tab: TabKey): boolean {
  switch (tab) {
    case "todo":
      return v.status !== "PUBLISHED";
    case "live":
      return v.status === "PUBLISHED";
    case "paused":
      return v.status === "PAUSED";
    case "incomplete":
      return v.filled < v.total;
    default:
      return true;
  }
}

/** Eén vacature-regel met alles wat je nodig hebt om 'm af te handelen. */
function Row({ v }: { v: WorkVacancy }) {
  const complete = v.filled === v.total;
  const live = v.status === "PUBLISHED";
  const paused = v.status === "PAUSED";

  return (
    <li className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-slate-50/60 xl:flex-row xl:items-center xl:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/vacatures/${v.id}`}
            className="font-medium text-slate-900 hover:text-brand-700"
          >
            {v.title}
          </Link>
          <StatusBadge options={VACANCY_STATUSES} value={v.status} />
          {v.discipline && <StatusBadge options={DISCIPLINES} value={v.discipline} />}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          {v.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3 text-slate-400" /> {v.location}
            </span>
          )}
          {v.companyName && <span>{v.companyName}</span>}
          {v.sourceName &&
            !(v.companyName ?? "").toLowerCase().includes(v.sourceName.toLowerCase()) && (
              <span className="text-slate-400">via {v.sourceName}</span>
            )}
          {live && (
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3 text-slate-400" /> {v.views} weergaven
            </span>
          )}
          {live && v.publishedAt && <span>live sinds {formatDate(v.publishedAt)}</span>}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        {complete ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Compleet
          </span>
        ) : (
          <Link
            href={`/vacatures/${v.id}/bewerken`}
            title="Samenvatting, werkzaamheden en/of functie-eisen ontbreken nog"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 hover:underline"
          >
            <AlertTriangle className="h-4 w-4" /> Vul aan ({v.filled}/{v.total})
          </Link>
        )}

        <Link
          href={`/vacatures/${v.id}/bewerken`}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          Bewerken
        </Link>

        {live && (
          <a
            href={`/vacature/${v.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Bekijken
          </a>
        )}

        {live ? (
          <ConfirmSubmit
            action={pauseVacancy}
            id={v.id}
            hidden={{ from: "list" }}
            variant="outline"
            size="sm"
            message={`"${v.title}" pauzeren? De vacature verdwijnt direct van de website.`}
          >
            <Pause className="h-3.5 w-3.5" /> Pauzeren
          </ConfirmSubmit>
        ) : paused ? (
          <form action={resumeVacancy}>
            <input type="hidden" name="id" value={v.id} />
            <input type="hidden" name="from" value="list" />
            <SubmitButton variant="success" size="sm" pendingLabel="Bezig…">
              <Play className="h-3.5 w-3.5" /> Hervatten
            </SubmitButton>
          </form>
        ) : (
          <ConfirmSubmit
            action={publishVacancy}
            id={v.id}
            hidden={{ from: "list" }}
            variant="success"
            size="sm"
            message={
              complete
                ? `"${v.title}" nu live op de website zetten?`
                : `Let op: deze vacature mist nog info (${v.filled}/${v.total} secties ingevuld). Toch live zetten?`
            }
          >
            <Rocket className="h-3.5 w-3.5" /> Naar website
          </ConfirmSubmit>
        )}
      </div>
    </li>
  );
}

/**
 * Eén werklijst voor alle vacatures: zoeken, filteren op waar iets staat in het
 * proces, en per regel meteen de juiste actie (aanvullen, live zetten, pauzeren).
 */
export function VacancyWorkList({ vacancies }: { vacancies: WorkVacancy[] }) {
  const [tab, setTab] = useState<TabKey>("todo");
  const [q, setQ] = useState("");

  const counts = useMemo(
    () =>
      TABS.reduce<Record<string, number>>((acc, t) => {
        acc[t.key] = vacancies.filter((v) => matchesTab(v, t.key)).length;
        return acc;
      }, {}),
    [vacancies],
  );

  const term = fold(q.trim());
  const rows = useMemo(
    () =>
      vacancies
        .filter((v) => matchesTab(v, tab))
        .filter((v) =>
          term
            ? [v.title, v.location, v.companyName, v.sourceName]
                .filter(Boolean)
                .some((s) => fold(String(s)).includes(term))
            : true,
        ),
    [vacancies, tab, term],
  );

  return (
    <div className="space-y-4">
      {/* Mapjes zoals in de dossiers: elk mapje is een stap in het proces. */}
      <FolderTabBar label="Vacatures">
        {TABS.map((t) => (
          <FolderTab
            key={t.key}
            icon={t.icon}
            label={t.label}
            count={counts[t.key] ?? 0}
            active={tab === t.key}
            onClick={() => setTab(t.key)}
          />
        ))}
      </FolderTabBar>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-0 flex-1 sm:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Zoek op titel, plaats of opdrachtgever…"
                aria-label="Zoek vacature"
                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
              />
            </div>
            <span className="ml-auto text-xs text-slate-400">
              {rows.length} van {vacancies.length}
            </span>
          </div>
        </CardContent>
      </Card>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Sparkles className="h-6 w-6 text-slate-300" />
            <p className="text-sm text-slate-500">
              {q ? `Geen vacature gevonden voor “${q}”.` : "Niets in dit onderdeel."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {rows.map((v) => (
            <Row key={v.id} v={v} />
          ))}
        </ul>
      )}
    </div>
  );
}
