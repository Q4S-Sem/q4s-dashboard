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
  PencilLine,
  AlertTriangle,
  CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { FolderTabBar, FolderTab } from "@/components/dossier-tabs";
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

type TabKey = "maken" | "klaar" | "live";

const TABS: { key: TabKey; label: string; icon: React.ReactNode }[] = [
  { key: "maken", label: "In de maak", icon: <PencilLine className="h-4 w-4" /> },
  { key: "klaar", label: "Klaar om te versturen", icon: <Rocket className="h-4 w-4" /> },
  { key: "live", label: "Live op de site", icon: <Eye className="h-4 w-4" /> },
];

function fold(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

/** Waar staat deze vacature in het proces? */
function stageOf(v: WorkVacancy): TabKey {
  if (v.status === "PUBLISHED") return "live";
  return v.filled === v.total ? "klaar" : "maken";
}

/** Eén regel: waar het over gaat, wat er nog mist en de eerstvolgende stap. */
function Row({ v }: { v: WorkVacancy }) {
  const stage = stageOf(v);
  const paused = v.status === "PAUSED";
  const showSource =
    v.sourceName && !(v.companyName ?? "").toLowerCase().includes(v.sourceName.toLowerCase());

  return (
    <li className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-ink-50/60 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0 flex-1">
        <Link
          href={`/vacatures/${v.id}`}
          className="font-medium text-ink-900 hover:text-brand-700"
        >
          {v.title}
        </Link>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
          {v.location && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3 text-ink-400" /> {v.location}
            </span>
          )}
          {v.companyName && <span className="truncate">{v.companyName}</span>}
          {showSource && <span className="text-ink-400">via {v.sourceName}</span>}
          {paused && <span className="font-medium text-amber-700">gepauzeerd</span>}
          {stage === "live" && (
            <>
              <span className="inline-flex items-center gap-1">
                <Eye className="h-3 w-3 text-ink-400" /> {v.views}
              </span>
              {v.publishedAt && <span>sinds {formatDate(v.publishedAt)}</span>}
            </>
          )}
          {stage === "maken" && (
            <span className="inline-flex items-center gap-1 font-medium text-amber-700">
              <AlertTriangle className="h-3 w-3" /> {v.filled}/{v.total} onderdelen
            </span>
          )}
          {stage === "klaar" && (
            <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
              <CheckCircle2 className="h-3 w-3" /> compleet
            </span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {stage === "maken" && (
          <Link
            href={`/vacatures/${v.id}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <PencilLine className="h-3.5 w-3.5" /> Uitschrijven
          </Link>
        )}

        {stage === "klaar" &&
          (paused ? (
            <form action={resumeVacancy}>
              <input type="hidden" name="id" value={v.id} />
              <input type="hidden" name="from" value="list" />
              <SubmitButton variant="success" size="sm" pendingLabel="Bezig…">
                <Play className="h-3.5 w-3.5" /> Hervatten
              </SubmitButton>
            </form>
          ) : (
            <>
              <Link
                href={`/vacatures/${v.id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Nalezen
              </Link>
              <ConfirmSubmit
                action={publishVacancy}
                id={v.id}
                hidden={{ from: "list" }}
                variant="success"
                size="sm"
                trigger="button"
                confirmLabel="Op de website zetten"
                message={`"${v.title}" nu live zetten op q4s.nl?`}
                description="De vacature is direct zichtbaar voor kandidaten. Je kunt hem later pauzeren."
              >
                <Rocket className="h-3.5 w-3.5" /> Naar website
              </ConfirmSubmit>
            </>
          ))}

        {stage === "live" && (
          <>
            <a
              href={`/vacature/${v.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <ExternalLink className="h-3.5 w-3.5" /> Bekijken
            </a>
            <ConfirmSubmit
              action={pauseVacancy}
              id={v.id}
              hidden={{ from: "list" }}
              variant="outline"
              size="sm"
              trigger="button"
              confirmLabel="Pauzeren"
              message={`"${v.title}" pauzeren?`}
              description="De vacature verdwijnt direct van de website. Je kunt hem later hervatten."
            >
              <Pause className="h-3.5 w-3.5" /> Pauzeren
            </ConfirmSubmit>
          </>
        )}
      </div>
    </li>
  );
}

/**
 * De werklijst van de maken-pagina: drie stappen (in de maak → klaar → live),
 * zoeken, en per regel precies één volgende stap. Alles wat je niet nodig hebt
 * om die stap te zetten, staat er bewust niet.
 */
export function VacancyWorkList({ vacancies }: { vacancies: WorkVacancy[] }) {
  const [tab, setTab] = useState<TabKey>("maken");
  const [q, setQ] = useState("");

  const counts = useMemo(() => {
    const c: Record<TabKey, number> = { maken: 0, klaar: 0, live: 0 };
    for (const v of vacancies) c[stageOf(v)]++;
    return c;
  }, [vacancies]);

  const term = fold(q.trim());
  const rows = useMemo(
    () =>
      vacancies
        .filter((v) => stageOf(v) === tab)
        .filter((v) =>
          term
            ? [v.title, v.location, v.companyName, v.sourceName]
                .filter(Boolean)
                .some((s) => fold(String(s)).includes(term))
            : true,
        ),
    [vacancies, tab, term],
  );

  const empty: Record<TabKey, string> = {
    maken: "Niets in de maak. Plak hierboven een vacature of stuur er één door vanuit de vacaturehub.",
    klaar: "Nog niets compleet. Vul de ontbrekende onderdelen aan bij ‘In de maak’.",
    live: "Nog niets live. Zet een afgeronde vacature op de website.",
  };

  return (
    <div className="space-y-4">
      <FolderTabBar label="Vacatures">
        {TABS.map((t) => (
          <FolderTab
            key={t.key}
            icon={t.icon}
            label={t.label}
            count={counts[t.key]}
            active={tab === t.key}
            onClick={() => setTab(t.key)}
          />
        ))}
      </FolderTabBar>

      {vacancies.length > 6 && (
        <div className="relative max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Zoek op titel, plaats of opdrachtgever…"
            aria-label="Zoek vacature"
            className="w-full rounded-lg border border-ink-300 bg-white py-2 pl-9 pr-3 text-sm text-ink-900 placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/30"
          />
        </div>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-ink-500">
            {term ? `Geen vacature gevonden voor “${q}”.` : empty[tab]}
          </CardContent>
        </Card>
      ) : (
        <ul
          className={cn(
            "divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200 bg-white",
          )}
        >
          {rows.map((v) => (
            <Row key={v.id} v={v} />
          ))}
        </ul>
      )}
    </div>
  );
}
