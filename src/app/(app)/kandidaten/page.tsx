import Link from "next/link";
import {
  Users,
  Plus,
  Search,
  Star,
  ThumbsUp,
  UserX,
  UserCheck,
  ChevronRight,
  MapPin,
  Mail,
  ClipboardList,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input, Select } from "@/components/ui/field";
import { person } from "@/lib/people";
import { cn, formatDate } from "@/lib/utils";
import {
  DISCIPLINES,
  CANDIDATE_SOURCES,
  CANDIDATE_RATINGS,
  CANDIDATE_RATING_ORDER,
  CANDIDATE_AVAILABILITY,
  CANDIDATE_AVAILABLE_VALUES,
} from "@/lib/domain";
import { RatingSelect } from "./RatingSelect";
import { AvailabilitySelect } from "./AvailabilitySelect";
import { InterviewSelect } from "./InterviewSelect";
import { PhoneReveal } from "./PhoneReveal";

export const metadata = { title: "Talentpool" };
export const dynamic = "force-dynamic";

type SP = {
  q?: string;
  discipline?: string;
  rating?: string;
  availability?: string;
  error?: string;
};

/**
 * Ring om de profielfoto naar beoordeling — geeft de kaart in één oogopslag een
 * signaal, ook wanneer er een foto in plaats van initialen staat.
 */
const RATING_RING: Record<string, string> = {
  GOED: "ring-emerald-400",
  REDELIJK: "ring-amber-400",
  NIET_MEER: "ring-red-400",
};
function ringByRating(rating: string): string {
  return RATING_RING[rating] ?? "ring-ink-200";
}

export default async function KandidatenPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const discipline = sp.discipline || "";
  const rating = sp.rating || "";
  const availability = sp.availability || "";

  const where = {
    ...(discipline ? { discipline } : {}),
    ...(rating ? { rating } : {}),
    ...(availability ? { availability } : {}),
    ...(q
      ? {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
            { headline: { contains: q } },
            { location: { contains: q } },
          ],
        }
      : {}),
  };

  const [candidates, ratingGroups, availableCount] = await Promise.all([
    db.candidate.findMany({
      where,
      include: {
        _count: { select: { applications: true } },
        candidatePlacements: { select: { company: true }, orderBy: { startDate: "desc" } },
      },
    }),
    db.candidate.groupBy({ by: ["rating"], _count: { _all: true } }),
    db.candidate.count({
      where: { availability: { in: [...CANDIDATE_AVAILABLE_VALUES] } },
    }),
  ]);

  // Rank best first, then alphabetically.
  candidates.sort((a, b) => {
    const ra = CANDIDATE_RATING_ORDER[a.rating] ?? 9;
    const rb = CANDIDATE_RATING_ORDER[b.rating] ?? 9;
    if (ra !== rb) return ra - rb;
    return a.lastName.localeCompare(b.lastName);
  });

  const countBy = (r: string) =>
    ratingGroups.find((g) => g.rating === r)?._count._all ?? 0;
  const total = ratingGroups.reduce((s, g) => s + g._count._all, 0);
  const hasFilter = Boolean(q || discipline || rating || availability);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Talentpool"
        description="Alle kandidaten met beoordeling, contactgegevens en filters — zo weet je direct wie je bij een klant kunt neerzetten."
        actions={
          <Link href="/kandidaten/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuwe kandidaat
          </Link>
        }
      />

      {sp.error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze kandidaat kan niet verwijderd worden zolang er sollicitaties aan
          gekoppeld zijn.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Kandidaten" value={total} icon={<Users className="h-5 w-5" />} accent="brand" />
        <StatCard label="Goed" value={countBy("GOED")} icon={<Star className="h-5 w-5" />} accent="green" />
        <StatCard label="Redelijk" value={countBy("REDELIJK")} icon={<ThumbsUp className="h-5 w-5" />} accent="amber" />
        <StatCard label="Niet meer inzetbaar" value={countBy("NIET_MEER")} icon={<UserX className="h-5 w-5" />} accent="red" />
      </div>

      {/* Snelkoppeling naar de map met beschikbare kandidaten */}
      <Link
        href="/kandidaten/beschikbaar"
        className="group flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-4 transition-colors hover:bg-emerald-100"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600 ring-1 ring-emerald-200">
            <UserCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="font-semibold text-emerald-900">Beschikbare kandidaten</p>
            <p className="text-sm text-emerald-700">
              {availableCount === 0
                ? "Nog niemand als beschikbaar gemarkeerd"
                : `${availableCount} kandidaat${availableCount === 1 ? "" : "en"} nu of binnenkort inzetbaar`}
            </p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
          Bekijken
          <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <form
            method="get"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_180px_180px_180px_auto]"
          >
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <Input
                name="q"
                defaultValue={q}
                placeholder="Zoek op naam, e-mail, telefoon, locatie…"
                className="pl-9"
                aria-label="Zoeken"
              />
            </div>
            <Select name="discipline" defaultValue={discipline} aria-label="Industrie">
              <option value="">Alle industrieën</option>
              {DISCIPLINES.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </Select>
            <Select name="rating" defaultValue={rating} aria-label="Beoordeling">
              <option value="">Alle beoordelingen</option>
              {CANDIDATE_RATINGS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </Select>
            <Select name="availability" defaultValue={availability} aria-label="Beschikbaarheid">
              <option value="">Alle beschikbaarheid</option>
              {CANDIDATE_AVAILABILITY.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </Select>
            <div className="flex gap-2">
              <button type="submit" className={buttonVariants()}>
                <Search className="h-4 w-4" /> Filter
              </button>
              {hasFilter && (
                <Link href="/kandidaten" className={buttonVariants({ variant: "outline" })}>
                  Wissen
                </Link>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {candidates.length === 0 ? (
        <EmptyState
          icon={<Users className="h-6 w-6" />}
          title={hasFilter ? "Geen kandidaten gevonden" : "Nog geen kandidaten"}
          description={
            hasFilter
              ? "Pas je zoekopdracht of filters aan."
              : "Voeg je eerste kandidaat toe om de talentpool op te bouwen."
          }
          action={
            hasFilter ? (
              <Link href="/kandidaten" className={buttonVariants({ variant: "outline" })}>
                Filters wissen
              </Link>
            ) : (
              <Link href="/kandidaten/nieuw" className={buttonVariants()}>
                <Plus className="h-4 w-4" /> Nieuwe kandidaat
              </Link>
            )
          }
        />
      ) : (
        <>
          <p className="text-xs text-ink-400">
            {candidates.length} kandida{candidates.length === 1 ? "at" : "ten"} · beste beoordeling eerst
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {candidates.map((c) => {
              const companies = [...new Set(c.candidatePlacements.map((p) => p.company))];
              return (
                <div
                  key={c.id}
                  className="q4s-hoverable flex flex-col rounded-md border border-ink-100 bg-white p-4"
                >
                  {/* Kop: profielfoto + naam + disciplines */}
                  <div className="flex items-start gap-3">
                    <Avatar
                      {...person(c)}
                      size="lg"
                      className={cn("ring-2", ringByRating(c.rating))}
                    />
                    <div className="min-w-0 flex-1">
                      <Link
                        href={`/kandidaten/${c.id}`}
                        className="font-semibold text-ink-900 hover:text-brand-600"
                      >
                        {c.firstName} {c.lastName}
                      </Link>
                      {c.headline && <p className="truncate text-xs text-ink-500">{c.headline}</p>}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {c.discipline && <StatusBadge options={DISCIPLINES} value={c.discipline} />}
                        <StatusBadge options={CANDIDATE_SOURCES} value={c.source} />
                      </div>
                    </div>
                    <Link
                      href={`/kandidaten/${c.id}`}
                      aria-label="Open kandidaat"
                      className="shrink-0 rounded-lg p-1 text-ink-300 transition-colors hover:bg-ink-100 hover:text-emerald-600"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Link>
                  </div>

                  {/* Contact */}
                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-ink-100 pt-3 text-xs text-ink-500">
                    {c.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5 text-ink-400" /> {c.location}
                      </span>
                    )}
                    {c.email && (
                      <a
                        href={`mailto:${c.email}`}
                        className="inline-flex items-center gap-1 transition-colors hover:text-emerald-700"
                      >
                        <Mail className="h-3.5 w-3.5 text-ink-400" />
                        <span className="max-w-[150px] truncate">{c.email}</span>
                      </a>
                    )}
                    <PhoneReveal phone={c.phone} />
                    <span className="ml-auto inline-flex items-center gap-1 text-ink-400">
                      <ClipboardList className="h-3.5 w-3.5" /> {c._count.applications}
                    </span>
                  </div>

                  {/* Beoordeling · beschikbaarheid · interview */}
                  <div className="mt-3 space-y-2 border-t border-ink-100 pt-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-ink-400">Beoordeling</span>
                      <RatingSelect id={c.id} value={c.rating} />
                    </div>
                    <div className="flex items-start justify-between gap-2">
                      <span className="pt-1.5 text-xs font-medium text-ink-400">Beschikbaar</span>
                      <div className="text-right">
                        <AvailabilitySelect id={c.id} value={c.availability} />
                        {c.availability === "BINNENKORT" && c.availableFrom && (
                          <div className="mt-0.5 text-[11px] text-ink-400">
                            Vanaf {formatDate(c.availableFrom)}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-ink-400">Interview</span>
                      <InterviewSelect id={c.id} value={c.interviewStatus} />
                    </div>
                  </div>

                  {/* Geplaatst bij */}
                  {companies.length > 0 && (
                    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-ink-100 pt-3">
                      <span className="text-xs text-ink-400">Geplaatst:</span>
                      {companies.slice(0, 2).map((co) => (
                        <Badge key={co} color="violet">
                          {co}
                        </Badge>
                      ))}
                      {companies.length > 2 && (
                        <span className="text-xs text-ink-400">+{companies.length - 2}</span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
