import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import {
  Building2, Briefcase, Kanban, Users2, Search, Sparkles, MapPin,
  Phone, Mail, Star, Receipt, ArrowRight, GitBranchPlus,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { person } from "@/lib/people";
import { cn } from "@/lib/utils";
import { DISCIPLINES, CANDIDATE_RATINGS } from "@/lib/domain";
import { NewVacancyButton } from "../NewVacancyButton";
import { runVacancyMatch } from "../workspace-actions";
import { quickAddToPipeline } from "../../crm/deals/actions";

export const metadata = { title: "Bedrijf" };
export const dynamic = "force-dynamic";

const RATING_RING: Record<string, string> = {
  GOED: "ring-emerald-400",
  REDELIJK: "ring-amber-400",
  NIET_MEER: "ring-red-400",
};

export default async function BedrijfWerkruimtePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ match?: string }>;
}) {
  const { id } = await params;
  const { match: matchVacancyId } = await searchParams;

  const client = await db.client.findUnique({
    where: { id },
    include: {
      vacancies: {
        where: { status: { not: "CONCEPT" } },
        orderBy: { createdAt: "desc" },
        include: {
          matches: {
            orderBy: { score: "desc" },
            take: 8,
            include: {
              candidate: {
                select: {
                  id: true, firstName: true, lastName: true, discipline: true,
                  headline: true, location: true, rating: true, phone: true,
                  email: true, photoFileName: true,
                },
              },
            },
          },
          _count: { select: { deals: { where: { status: "OPEN" } } } },
        },
      },
      _count: { select: { deals: { where: { status: "OPEN" } }, placements: true } },
    },
  });
  if (!client) notFound();

  const openDeals = client._count.deals;
  const totalMatches = client.vacancies.reduce((s, v) => s + v.matches.length, 0);

  return (
    <div className="space-y-6">
      <BackLink href="/opdrachtgevers">Terug naar bedrijven</BackLink>

      <PageHeader
        title={client.companyName}
        description={[client.city, client.website].filter(Boolean).join(" · ") || undefined}
        leading={
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-ink-900 text-white">
            <Building2 className="h-6 w-6" />
          </span>
        }
        actions={
          <>
            <Link href={`/crm/deals/nieuw?company=${encodeURIComponent(client.companyName)}`} className={buttonVariants({ variant: "outline" })}>
              <Briefcase className="h-4 w-4" /> Nieuwe vacature
            </Link>
            <Link href={`/klanten/${client.id}`} className={buttonVariants({ variant: "outline" })}>
              <Receipt className="h-4 w-4" /> Facturatie & gegevens
            </Link>
            <NewVacancyButton clientId={client.id} />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Openstaande vacatures" value={client.vacancies.length} icon={<Briefcase className="h-5 w-5" />} accent="green" />
        <StatCard label="Lopende deals" value={openDeals} icon={<Kanban className="h-5 w-5" />} accent="violet" />
        <StatCard label="Plaatsingen" value={client._count.placements} icon={<Users2 className="h-5 w-5" />} accent="brand" />
        <StatCard label="Matches klaar" value={totalMatches} icon={<Sparkles className="h-5 w-5" />} accent="amber" />
      </div>

      {/* Vacatures + inline matching — de kern van de werkruimte */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
            Vacatures & matches
          </h2>
          <NewVacancyButton clientId={client.id} />
        </div>

        {client.vacancies.length === 0 ? (
          <EmptyState
            icon={<Briefcase className="h-6 w-6" />}
            title="Nog geen vacatures"
            description="Plaats een vacature bij dit bedrijf; daarna zoek je met één klik de best passende kandidaten uit de talentpool."
            action={<NewVacancyButton clientId={client.id} />}
          />
        ) : (
          client.vacancies.map((v) => {
            const justMatched = matchVacancyId === v.id;
            return (
              <Card key={v.id} id={`vac-${v.id}`} className={cn(justMatched && "ring-2 ring-brand-200")}>
                <CardHeader>
                  <div className="min-w-0">
                    <CardTitle className="flex items-center gap-2">
                      <Link href={`/vacatures/${v.id}`} className="truncate hover:text-brand-700">
                        {v.title}
                      </Link>
                      {v.discipline && <StatusBadge options={DISCIPLINES} value={v.discipline} />}
                    </CardTitle>
                    <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-500">
                      {v.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" /> {v.location}
                        </span>
                      )}
                      {v._count.deals > 0 && (
                        <span className="inline-flex items-center gap-1">
                          <Kanban className="h-3.5 w-3.5" /> {v._count.deals} in pipeline
                        </span>
                      )}
                      {v.lastMatchedAt && (
                        <span className="text-ink-400">
                          {v.matches.length} match{v.matches.length === 1 ? "" : "es"}
                        </span>
                      )}
                    </p>
                  </div>
                  <form action={runVacancyMatch}>
                    <input type="hidden" name="vacancyId" value={v.id} />
                    <input type="hidden" name="clientId" value={client.id} />
                    <button type="submit" className={buttonVariants({ variant: "primary", size: "sm" })}>
                      <Search className="h-4 w-4" /> {v.lastMatchedAt ? "Opnieuw matchen" : "Zoek match"}
                    </button>
                  </form>
                </CardHeader>

                {v.matches.length === 0 ? (
                  <CardContent className="text-sm text-ink-500">
                    {v.lastMatchedAt
                      ? "Geen passende kandidaten gevonden. Voeg kandidaten toe aan de talentpool of pas de functie-eisen aan."
                      : "Nog niet gezocht — klik op “Zoek match” om de talentpool te doorzoeken."}
                  </CardContent>
                ) : (
                  <CardContent className="space-y-2">
                    {v.matches.map((m) => {
                      const c = m.candidate;
                      const pct = Math.round(m.score * 100);
                      return (
                        <div
                          key={m.id}
                          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-ink-100 bg-white p-2.5"
                        >
                          {/* Kandidaat */}
                          <Link
                            href={`/kandidaten/${c.id}`}
                            className="flex min-w-0 flex-1 items-center gap-3"
                          >
                            <Avatar {...person(c)} size="sm" className={cn("ring-2", RATING_RING[c.rating] ?? "ring-ink-200")} />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-ink-900">
                                {c.firstName} {c.lastName}
                              </p>
                              <p className="truncate text-xs text-ink-500">
                                {c.headline || (c.discipline ? DISCIPLINES.find((d) => d.value === c.discipline)?.label : "")}
                              </p>
                            </div>
                          </Link>

                          {/* Score + reden */}
                          <div className="w-40 shrink-0">
                            <div className="flex items-center justify-between text-[11px] text-ink-500">
                              <span className="font-semibold text-ink-700">{pct}% match</span>
                              <StatusBadge options={CANDIDATE_RATINGS} value={c.rating} />
                            </div>
                            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                              <div
                                className={cn(
                                  "h-full rounded-full",
                                  pct >= 70 ? "bg-emerald-500" : pct >= 45 ? "bg-amber-500" : "bg-ink-300",
                                )}
                                style={{ width: `${Math.max(6, pct)}%` }}
                              />
                            </div>
                            {m.reason && (
                              <p className="mt-1 truncate text-[11px] text-ink-400" title={m.reason}>
                                {m.reason}
                              </p>
                            )}
                          </div>

                          {/* Acties */}
                          <div className="flex shrink-0 items-center gap-1.5">
                            {c.phone ? (
                              <a
                                href={`tel:${c.phone}`}
                                title={`Bel ${c.firstName}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition-colors hover:bg-emerald-200"
                              >
                                <Phone className="h-4 w-4" />
                              </a>
                            ) : (
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-ink-300" title="Geen telefoonnummer">
                                <Phone className="h-4 w-4" />
                              </span>
                            )}
                            {c.email ? (
                              <a
                                href={`mailto:${c.email}`}
                                title={`Mail ${c.firstName}`}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 transition-colors hover:bg-blue-200"
                              >
                                <Mail className="h-4 w-4" />
                              </a>
                            ) : (
                              <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-ink-300" title="Geen e-mailadres">
                                <Mail className="h-4 w-4" />
                              </span>
                            )}
                            <form action={quickAddToPipeline}>
                              <input type="hidden" name="candidateId" value={c.id} />
                              <input type="hidden" name="clientId" value={client.id} />
                              <input type="hidden" name="vacancyId" value={v.id} />
                              <input type="hidden" name="returnTo" value={`/opdrachtgevers/${client.id}`} />
                              <button
                                type="submit"
                                title={`${c.firstName} in de pipeline zetten`}
                                className={buttonVariants({ variant: "outline", size: "sm" })}
                              >
                                <GitBranchPlus className="h-4 w-4" /> In pipeline
                              </button>
                            </form>
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                )}
              </Card>
            );
          })
        )}
      </div>

      <p className="flex items-center gap-2 text-xs text-ink-400">
        <Star className="h-3.5 w-3.5" />
        Tip: matchen is intern en verstuurt niets. Een kandidaat in de pipeline zetten blijft jouw keuze —
        daarna beheer je de deal op het{" "}
        <Link href="/crm" className="inline-flex items-center gap-0.5 text-brand-700 hover:underline">
          pipeline-bord <ArrowRight className="h-3 w-3" />
        </Link>
        .
      </p>
    </div>
  );
}
