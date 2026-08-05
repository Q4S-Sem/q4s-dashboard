import Link from "next/link";
import {
  MapPin,
  Sparkles,
  Check,
  X,
  RotateCcw,
  ExternalLink,
  PencilLine,
} from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DISCIPLINES, VACANCY_STATUSES, VACANCY_RELEVANCE } from "@/lib/domain";
import { formatDate } from "@/lib/utils";
import { aiFilterOne, setRelevance } from "../actions";

export type HubVacancy = {
  id: string;
  title: string;
  discipline: string | null;
  location: string | null;
  companyName: string | null;
  status: string;
  relevance: string;
  relevanceReason: string | null;
  createdAt: Date;
  slug: string;
  sourceName: string | null;
};

/** Welke knoppen er bij deze lijst horen. */
export type HubListMode = "judge" | "publish" | "rejected";

/** De bron alleen tonen als het bedrijfsveld 'm niet al noemt (geen dubbeling). */
function showSource(v: { sourceName: string | null; companyName: string | null }): boolean {
  if (!v.sourceName) return false;
  return !(v.companyName ?? "").toLowerCase().includes(v.sourceName.toLowerCase());
}

function Snippet({ v }: { v: HubVacancy }) {
  return (
    <div className="min-w-0">
      <Link
        href={`/vacatures/${v.id}`}
        className="font-medium text-ink-900 hover:text-brand-700"
      >
        {v.title}
      </Link>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
        {showSource(v) && <span className="font-medium text-ink-600">{v.sourceName}</span>}
        {v.companyName && <span>{v.companyName}</span>}
        {v.location && (
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-3 w-3 text-ink-400" /> {v.location}
          </span>
        )}
        <span>binnengekomen {formatDate(v.createdAt)}</span>
      </div>
    </div>
  );
}

/**
 * Eén vacature-regel in de hub. Per mapje andere knoppen: beoordelen (AI of
 * zelf), publiceren, of een afwijzing terugdraaien.
 */
function Row({ v, mode, back }: { v: HubVacancy; mode: HubListMode; back: string }) {
  const hidden = (
    <>
      <input type="hidden" name="id" value={v.id} />
      <input type="hidden" name="back" value={back} />
    </>
  );

  return (
    <li className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-ink-50/60 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0 flex-1">
        <Snippet v={v} />
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {v.discipline && <StatusBadge options={DISCIPLINES} value={v.discipline} />}
          <StatusBadge options={VACANCY_STATUSES} value={v.status} />
          {mode !== "judge" && <StatusBadge options={VACANCY_RELEVANCE} value={v.relevance} />}
        </div>
        {v.relevanceReason && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-500">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" />
            <span className="line-clamp-2">{v.relevanceReason}</span>
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {mode === "judge" && (
          <>
            <form action={aiFilterOne}>
              {hidden}
              <SubmitButton variant="outline" size="sm" pendingLabel="AI kijkt…">
                <Sparkles className="h-3.5 w-3.5" /> Laat AI beoordelen
              </SubmitButton>
            </form>
            <form action={setRelevance}>
              {hidden}
              <input type="hidden" name="relevance" value="RELEVANT" />
              <SubmitButton variant="success" size="sm" pendingLabel="Bezig…">
                <Check className="h-3.5 w-3.5" /> Past bij ons
              </SubmitButton>
            </form>
            <form action={setRelevance}>
              {hidden}
              <input type="hidden" name="relevance" value="IRRELEVANT" />
              <SubmitButton variant="outline" size="sm" pendingLabel="Bezig…">
                <X className="h-3.5 w-3.5" /> Niet passend
              </SubmitButton>
            </form>
          </>
        )}

        {mode === "publish" && (
          <>
            {v.status === "PUBLISHED" ? (
              <a
                href={`/vacature/${v.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 hover:text-emerald-800"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Live bekijken
              </a>
            ) : (
              // Publiceren doe je bewust op de maken-pagina, niet vanuit de hub.
              <Link
                href={`/vacatures/${v.id}`}
                className={buttonVariants({ variant: "success", size: "sm" })}
              >
                <PencilLine className="h-3.5 w-3.5" /> Naar maken
              </Link>
            )}
          </>
        )}

        {mode === "rejected" && (
          <form action={setRelevance}>
            {hidden}
            <input type="hidden" name="relevance" value="UNKNOWN" />
            <SubmitButton variant="outline" size="sm" pendingLabel="Bezig…">
              <RotateCcw className="h-3.5 w-3.5" /> Terug naar beoordelen
            </SubmitButton>
          </form>
        )}
      </div>
    </li>
  );
}

export function HubVacancyList({
  vacancies,
  mode,
  back,
  emptyTitle,
  emptyDescription,
}: {
  vacancies: HubVacancy[];
  mode: HubListMode;
  /** Pad waar de acties naartoe terugkeren. */
  back: string;
  emptyTitle: string;
  emptyDescription: string;
}) {
  if (vacancies.length === 0) {
    return (
      <EmptyState
        icon={<Badge color="slate">0</Badge>}
        title={emptyTitle}
        description={emptyDescription}
      />
    );
  }

  return (
    <ul className="divide-y divide-ink-100 overflow-hidden rounded-xl border border-ink-200 bg-white">
      {vacancies.map((v) => (
        <Row key={v.id} v={v} mode={mode} back={back} />
      ))}
    </ul>
  );
}

/** De velden die elke hub-lijst nodig heeft (voor db.vacancy.findMany). */
export const HUB_VACANCY_SELECT = {
  id: true,
  title: true,
  discipline: true,
  location: true,
  companyName: true,
  status: true,
  relevance: true,
  relevanceReason: true,
  createdAt: true,
  slug: true,
  vmsConnector: { select: { name: true } },
} as const;

/** Rijen uit de database omzetten naar wat de lijst verwacht. */
export function toHubVacancies(
  rows: (Omit<HubVacancy, "sourceName"> & { vmsConnector: { name: string } | null })[],
): HubVacancy[] {
  return rows.map(({ vmsConnector, ...v }) => ({ ...v, sourceName: vmsConnector?.name ?? null }));
}
