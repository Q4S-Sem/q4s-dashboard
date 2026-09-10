import Link from "next/link";
import {
  Users,
  Plus,
  Star,
  ThumbsUp,
  UserX,
  UserCheck,
  ChevronRight,
  MapPin,
  Mail,
  Phone,
  ClipboardList,
} from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { person } from "@/lib/people";
import { cn } from "@/lib/utils";
import {
  DISCIPLINES,
  CANDIDATE_RATINGS,
  CANDIDATE_RATING_ORDER,
  CANDIDATE_AVAILABILITY,
  CANDIDATE_AVAILABLE_VALUES,
} from "@/lib/domain";
import { RatingSelect } from "./RatingSelect";
import { AvailabilitySelect } from "./AvailabilitySelect";
import { InterviewSelect } from "./InterviewSelect";
import { KandidatenFilters } from "./KandidatenFilters";
import { PipelineButton } from "./PipelineButton";
import { createDealFromCandidate } from "../crm/deals/actions";

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

  const [candidates, ratingGroups, availableCount, clients, openVacancies] = await Promise.all([
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
    db.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
    db.vacancy.findMany({
      where: { status: { not: "CONCEPT" } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, title: true, companyName: true },
    }),
  ]);

  const pipelineClients = clients.map((c) => ({ id: c.id, name: c.companyName }));
  const pipelineVacancies = openVacancies.map((v) => ({ id: v.id, title: v.title, company: v.companyName }));

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
        className="group flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-2.5 transition-colors hover:bg-emerald-100"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white text-emerald-600 ring-1 ring-emerald-200">
            <UserCheck className="h-4 w-4" />
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

      {/* Filters — zoekt automatisch tijdens typen en bij elke keuze */}
      <KandidatenFilters
        q={q}
        discipline={discipline}
        rating={rating}
        availability={availability}
        disciplines={DISCIPLINES}
        ratings={CANDIDATE_RATINGS}
        availabilities={CANDIDATE_AVAILABILITY}
      />

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
          <div className="divide-y divide-ink-100 overflow-hidden rounded-md border border-ink-100 bg-white">
            {candidates.map((c) => {
              const companies = [...new Set(c.candidatePlacements.map((p) => p.company))];
              return (
                <div
                  key={c.id}
                  className="group relative flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2.5 transition-colors hover:bg-ink-50/60"
                >
                  {/* Hele rij klikbaar → dossier. Ligt achter de knoppen (z-0);
                      de interactieve controls staan met z-10 erboven. */}
                  <Link
                    href={`/kandidaten/${c.id}`}
                    aria-label={`${c.firstName} ${c.lastName} openen`}
                    className="absolute inset-0 z-0"
                  />
                  {/* Persoon: avatar + naam + discipline */}
                  <div className="pointer-events-none relative z-10 flex min-w-0 flex-1 items-center gap-3">
                    <Avatar {...person(c)} size="sm" className={cn("ring-2", ringByRating(c.rating))} />
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink-900 group-hover:text-brand-600">
                        {c.firstName} {c.lastName}
                      </span>
                      <div className="flex items-center gap-1.5 truncate text-xs text-ink-500">
                        {c.headline && <span className="truncate">{c.headline}</span>}
                        {c.discipline && (
                          <span className="shrink-0">
                            <StatusBadge options={DISCIPLINES} value={c.discipline} />
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Contact — verschijnt vanaf lg, vaste breedte zodat de
                      statuskolommen rechts netjes uitgelijnd blijven */}
                  <div className="relative z-10 hidden w-[300px] shrink-0 items-center justify-end gap-x-3 text-xs text-ink-500 lg:flex">
                    {c.location && (
                      <span className="pointer-events-none inline-flex min-w-0 items-center gap-1" title={c.location}>
                        <MapPin className="h-3.5 w-3.5 shrink-0 text-ink-400" />
                        <span className="max-w-[110px] truncate">{c.location}</span>
                      </span>
                    )}
                    {companies.length > 0 && (
                      <span className="pointer-events-none inline-flex items-center gap-1" title={`Geplaatst bij ${companies.join(", ")}`}>
                        <Badge color="violet">{companies[0]}</Badge>
                        {companies.length > 1 && (
                          <span className="text-ink-400">+{companies.length - 1}</span>
                        )}
                      </span>
                    )}
                    <span className="pointer-events-none inline-flex items-center gap-1 text-ink-400" title={`${c._count.applications} sollicitatie(s)`}>
                      <ClipboardList className="h-3.5 w-3.5" /> {c._count.applications}
                    </span>
                    <span className="flex items-center gap-1.5">
                      {c.phone ? (
                        <a
                          href={`tel:${c.phone}`}
                          title={`Bel ${c.firstName} (${c.phone})`}
                          aria-label={`Bel ${c.firstName} ${c.lastName}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition-colors hover:bg-emerald-200"
                        >
                          <Phone className="h-4 w-4" />
                        </a>
                      ) : (
                        <span
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-ink-300"
                          title="Geen telefoonnummer bekend"
                          aria-hidden
                        >
                          <Phone className="h-4 w-4" />
                        </span>
                      )}
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          title={`Mail ${c.firstName} (${c.email})`}
                          aria-label={`Stuur een e-mail naar ${c.firstName} ${c.lastName}`}
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 transition-colors hover:bg-blue-200"
                        >
                          <Mail className="h-4 w-4" />
                        </a>
                      ) : (
                        <span
                          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-ink-300"
                          title="Geen e-mailadres bekend"
                          aria-hidden
                        >
                          <Mail className="h-4 w-4" />
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Statussen — compact naast elkaar */}
                  <div className="relative z-10 flex items-center gap-2">
                    <RatingSelect id={c.id} value={c.rating} className="w-36" />
                    <AvailabilitySelect id={c.id} value={c.availability} className="w-36" />
                    <InterviewSelect id={c.id} value={c.interviewStatus} className="w-32" />
                    <PipelineButton
                      action={createDealFromCandidate}
                      candidateId={c.id}
                      candidateName={`${c.firstName} ${c.lastName}`}
                      clients={pipelineClients}
                      vacancies={pipelineVacancies}
                    />
                    <Link
                      href={`/kandidaten/${c.id}`}
                      aria-label={`${c.firstName} ${c.lastName} openen`}
                      className="inline-flex shrink-0 rounded-md p-1 text-ink-300 transition-colors hover:bg-ink-100 hover:text-brand-600"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
