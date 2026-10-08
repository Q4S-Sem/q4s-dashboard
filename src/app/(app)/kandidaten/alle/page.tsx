import Link from "next/link";
import { Users, Plus, Star, UserCheck, ChevronRight, Mail, Inbox, Globe, ClipboardCheck } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { FilterTegels, type FilterTegel } from "@/components/ui/filter-tegels";
import { herkomst } from "@/lib/eu-herkomst";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { PhoneButton } from "@/components/ui/phone-button";
import { person } from "@/lib/people";
import { cn } from "@/lib/utils";
import {
  DISCIPLINES,
  CANDIDATE_RATINGS,
  CANDIDATE_RATING_ORDER,
  CANDIDATE_AVAILABILITY,
  CANDIDATE_AVAILABLE_VALUES,
} from "@/lib/domain";
import { startVandaagNL } from "@/lib/vandaag";
import { RatingSelect } from "../RatingSelect";
import { AvailabilitySelect } from "../AvailabilitySelect";
import { InterviewSelect } from "../InterviewSelect";
import { KandidatenFilters } from "../KandidatenFilters";
import { PipelineButton } from "../PipelineButton";
import { createDealFromCandidate } from "../../crm/deals/actions";

export const metadata = { title: "Alle kandidaten" };
export const dynamic = "force-dynamic";

type SP = {
  q?: string;
  discipline?: string;
  rating?: string;
  availability?: string;
  map?: string;
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
  const map = ["beoordelen", "beschikbaar", "goed", "buiten"].includes(sp.map ?? "") ? sp.map! : "pool";
  const vandaag = startVandaagNL();

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

  const [alle, clients, openVacancies] = await Promise.all([
    db.candidate.findMany({
      where,
      include: {
        _count: { select: { applications: true } },
        candidatePlacements: { select: { company: true }, orderBy: { startDate: "desc" } },
      },
    }),
    db.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
    db.vacancy.findMany({
      where: { status: { not: "CONCEPT" } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, title: true, companyName: true },
    }),
  ]);

  // EU / buiten de EU: buiten de EU valt automatisch af (eigen map, niets gewist).
  const metHerkomst = alle.map((c) => ({ ...c, herkomst: herkomst(c) }));
  const pool = metHerkomst.filter((c) => c.herkomst !== "BUITEN_EU");
  const isNieuw = (c: { createdAt: Date }) => c.createdAt >= vandaag;
  const mappen: Record<string, typeof metHerkomst> = {
    pool,
    beoordelen: pool.filter((c) => c.rating === "ONBEKEND"),
    goed: pool.filter((c) => c.rating === "GOED"),
    beschikbaar: pool.filter((c) => (CANDIDATE_AVAILABLE_VALUES as readonly string[]).includes(c.availability)),
    buiten: metHerkomst.filter((c) => c.herkomst === "BUITEN_EU"),
  };
  const candidates = mappen[map];
  const mapHref = (m: string) => {
    const p = new URLSearchParams();
    if (m !== "pool") p.set("map", m);
    for (const [k, v] of Object.entries({ q, discipline, rating, availability })) if (v) p.set(k, v);
    const qs = p.toString();
    return qs ? `/kandidaten/alle?${qs}` : "/kandidaten/alle";
  };
  const tegels: FilterTegel[] = [
    { key: "pool", label: "Talentpool (EU)", waarde: mappen.pool.length, icon: <Users className="h-4 w-4" />, toon: "slate", href: mapHref("pool"), actief: map === "pool" },
    { key: "beoordelen", label: "Ter beoordeling", waarde: mappen.beoordelen.length, icon: <ClipboardCheck className="h-4 w-4" />, toon: "amber", href: mapHref("beoordelen"), actief: map === "beoordelen" },
    { key: "nieuw", label: "Vandaag binnen", waarde: pool.filter(isNieuw).length, icon: <Inbox className="h-4 w-4" />, toon: "blue", href: "/kandidaten", actief: false },
    { key: "goed", label: "Goed beoordeeld", waarde: mappen.goed.length, icon: <Star className="h-4 w-4" />, toon: "green", href: mapHref("goed"), actief: map === "goed" },
    { key: "beschikbaar", label: "Beschikbaar", waarde: mappen.beschikbaar.length, icon: <UserCheck className="h-4 w-4" />, toon: "violet", href: mapHref("beschikbaar"), actief: map === "beschikbaar" },
    { key: "buiten", label: "Buiten de EU — vallen af", waarde: mappen.buiten.length, icon: <Globe className="h-4 w-4" />, toon: "red", href: mapHref("buiten"), actief: map === "buiten" },
  ];

  const pipelineClients = clients.map((c) => ({ id: c.id, name: c.companyName }));
  const pipelineVacancies = openVacancies.map((v) => ({ id: v.id, title: v.title, company: v.companyName }));

  // Rank best first, then alphabetically.
  candidates.sort((a, b) => {
    const ra = CANDIDATE_RATING_ORDER[a.rating] ?? 9;
    const rb = CANDIDATE_RATING_ORDER[b.rating] ?? 9;
    if (ra !== rb) return ra - rb;
    return a.lastName.localeCompare(b.lastName);
  });

  const hasFilter = Boolean(q || discipline || rating || availability);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Alle kandidaten"
        description="De hele talentpool met beoordeling, contactgegevens en filters — zo weet je direct wie je bij een klant kunt neerzetten."
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

      <FilterTegels items={tegels} label="Mappen talentpool" />

      {map === "buiten" && (
        <p className="rounded-md border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800">
          Kandidaten van buiten de EU/EER (herkend aan land of telefoonnummer) vallen automatisch af. Ze staan hier apart, er is niets gewist.
        </p>
      )}

      {/* Filters — zoekt automatisch tijdens typen en bij elke keuze */}
      <KandidatenFilters
        q={q}
        discipline={discipline}
        rating={rating}
        availability={availability}
        map={map === "pool" ? "" : map}
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
              <Link href="/kandidaten/alle" className={buttonVariants({ variant: "outline" })}>
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
            {map === "pool" && mappen.buiten.length > 0 && ` · ${mappen.buiten.length} buiten de EU niet getoond`}
          </p>
          <div className="divide-y divide-ink-100 overflow-hidden rounded-md border border-ink-100 bg-white">
            {candidates.map((c) => {
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
                    {isNieuw(c) && (
                      <span className="absolute -left-1 -top-1 rounded-full bg-blue-600 px-1.5 text-[9px] font-bold uppercase text-white">nieuw</span>
                    )}
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
                  <div className="relative z-10 hidden w-[110px] shrink-0 items-center justify-end gap-x-3 text-xs text-ink-500 lg:flex">
                    <span className="flex items-center gap-1.5">
                      <PhoneButton phone={c.phone} name={`${c.firstName} ${c.lastName}`} />
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
                  <div className="relative z-10 flex flex-wrap items-center gap-2">
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
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-300 transition-colors hover:bg-ink-100 hover:text-brand-600"
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
