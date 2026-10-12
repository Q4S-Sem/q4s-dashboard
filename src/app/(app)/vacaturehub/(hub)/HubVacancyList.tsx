import Link from "next/link";
import {
  MapPin,
  Sparkles,
  Check,
  X,
  RotateCcw,
  ExternalLink,
  PencilLine,
  Phone,
  Users,
} from "lucide-react";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { DISCIPLINES, VACANCY_STATUSES, VACANCY_RELEVANCE } from "@/lib/domain";
import { formatDate } from "@/lib/utils";
import { aiFilterOne, setRelevance, oppakken, leadMaken } from "../actions";
import { cn } from "@/lib/utils";
import { publicVacancyUrl } from "@/lib/public-site";

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
  sourceUrl: string | null;
  matchCount: number;
  /** Beste kandidaat-match 0..1, of null. */
  bestScore: number | null;
};

/** Welke knoppen er bij deze lijst horen. */
export type HubListMode = "inbox" | "judge" | "publish" | "rejected";

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
        {v.sourceUrl && (
          <a href={v.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-ink-800">
            <ExternalLink className="h-3 w-3" /> bron
          </a>
        )}
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
          {mode !== "inbox" && <StatusBadge options={VACANCY_STATUSES} value={v.status} />}
          {mode !== "judge" && mode !== "inbox" && <StatusBadge options={VACANCY_RELEVANCE} value={v.relevance} />}
          {mode === "inbox" && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-sm px-2 py-0.5 text-xs font-medium",
                v.matchCount > 0 ? "bg-violet-50 text-violet-700" : "bg-ink-100 text-ink-500",
              )}
            >
              <Users className="h-3 w-3" />
              {v.matchCount > 0
                ? `${v.matchCount} kandida${v.matchCount === 1 ? "at" : "ten"} · beste ${Math.round((v.bestScore ?? 0) * 100)}%`
                : "nog geen kandidaten"}
            </span>
          )}
        </div>
        {v.relevanceReason && (
          <p className="mt-2 flex items-start gap-1.5 text-xs text-ink-500">
            <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" />
            <span className="line-clamp-2">{v.relevanceReason}</span>
          </p>
        )}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {mode === "inbox" && (
          <>
            <form action={oppakken}>
              {hidden}
              <SubmitButton size="sm" pendingLabel="AI schrijft uit…" title="AI schrijft de vacature uit in Q4S-stijl + LinkedIn-tekst; daarna controleer je hem">
                <Check className="h-3.5 w-3.5" /> Oppakken
              </SubmitButton>
            </form>
            <form action={leadMaken}>
              {hidden}
              <SubmitButton variant="outline" size="sm" pendingLabel="…" title="Taak: bel dit bedrijf met onze kandidaten">
                <Phone className="h-3.5 w-3.5" /> Lead
              </SubmitButton>
            </form>
            <form action={setRelevance}>
              {hidden}
              <input type="hidden" name="relevance" value="IRRELEVANT" />
              <SubmitButton variant="outline" size="sm" pendingLabel="…" title="Wegleggen (terug te halen onder Weggelegd)" aria-label="Wegleggen">
                <X className="h-3.5 w-3.5" />
              </SubmitButton>
            </form>
          </>
        )}

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
                href={publicVacancyUrl(v.slug)}
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
            <input type="hidden" name="relevance" value="RELEVANT" />
            <SubmitButton variant="outline" size="sm" pendingLabel="Bezig…">
              <RotateCcw className="h-3.5 w-3.5" /> Terughalen
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
  sourceUrl: true,
  vmsConnector: { select: { name: true } },
  matches: { select: { score: true }, orderBy: { score: "desc" } },
} as const;

/** Rijen uit de database omzetten naar wat de lijst verwacht. */
export function toHubVacancies(
  rows: (Omit<HubVacancy, "sourceName" | "matchCount" | "bestScore"> & {
    vmsConnector: { name: string } | null;
    matches: { score: number }[];
  })[],
): HubVacancy[] {
  return rows.map(({ vmsConnector, matches, ...v }) => ({
    ...v,
    sourceName: vmsConnector?.name ?? null,
    matchCount: matches.length,
    bestScore: matches[0]?.score ?? null,
  }));
}
