import Link from "next/link";
import type { Candidate } from "@prisma/client";
import {
  ArrowLeft,
  UserCheck,
  Search,
  CalendarClock,
  Mail,
  ArrowRight,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input, Select } from "@/components/ui/field";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { cn, formatDate } from "@/lib/utils";
import { person } from "@/lib/people";
import {
  DISCIPLINES,
  CANDIDATE_AVAILABLE_VALUES,
  CANDIDATE_AVAILABILITY_ORDER,
  CANDIDATE_RATING_ORDER,
} from "@/lib/domain";
import { RatingSelect } from "../RatingSelect";
import { AvailabilitySelect } from "../AvailabilitySelect";
import { PhoneReveal } from "../PhoneReveal";

export const metadata = { title: "Beschikbare kandidaten" };
export const dynamic = "force-dynamic";

type SP = { q?: string; discipline?: string };

/** Compacte, scanbare tabel met beschikbare kandidaten (één rij per persoon). */
function CandidateTable({ candidates }: { candidates: Candidate[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
      <Table>
        <THead>
          <TR className="hover:bg-transparent">
            <TH>Kandidaat</TH>
            <TH>Beschikbaarheid</TH>
            <TH>Contact</TH>
            <TH>Beoordeling</TH>
            <TH className="text-right">&nbsp;</TH>
          </TR>
        </THead>
        <TBody>
          {candidates.map((c) => {
            const soon = c.availability === "BINNENKORT";
            // Ring om de foto verklapt de beschikbaarheid: groen = nu, amber = binnenkort.
            const avatarTone = soon ? "ring-amber-400" : "ring-emerald-400";
            const sub = [c.location, c.headline].filter(Boolean).join(" · ");
            return (
              <TR key={c.id}>
                <TD>
                  <div className="flex items-center gap-2.5">
                    <Avatar {...person(c)} size="sm" className={cn("ring-2", avatarTone)} />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/kandidaten/${c.id}`}
                          className="truncate font-medium text-ink-900 hover:text-emerald-700"
                        >
                          {c.firstName} {c.lastName}
                        </Link>
                        {c.discipline && <StatusBadge options={DISCIPLINES} value={c.discipline} />}
                      </div>
                      {sub && <p className="max-w-[17rem] truncate text-xs text-ink-400">{sub}</p>}
                    </div>
                  </div>
                </TD>
                <TD>
                  <AvailabilitySelect id={c.id} value={c.availability} className="w-40" />
                  {soon && c.availableFrom && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-600">
                      <CalendarClock className="h-3 w-3" /> vanaf {formatDate(c.availableFrom)}
                    </p>
                  )}
                </TD>
                <TD>
                  <div className="flex items-center gap-2 text-sm">
                    {c.email ? (
                      <a
                        href={`mailto:${c.email}`}
                        title={c.email}
                        className="inline-flex min-w-0 max-w-[10rem] items-center gap-1.5 text-ink-600 transition-colors hover:text-emerald-700"
                      >
                        <Mail className="h-4 w-4 shrink-0 text-ink-400" />
                        <span className="truncate">{c.email}</span>
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-ink-400">
                        <Mail className="h-4 w-4" />
                      </span>
                    )}
                    <PhoneReveal phone={c.phone} />
                  </div>
                </TD>
                <TD>
                  <RatingSelect id={c.id} value={c.rating} className="w-36" />
                </TD>
                <TD className="text-right">
                  <Link
                    href={`/kandidaten/${c.id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Bekijk <ArrowRight className="h-4 w-4" />
                  </Link>
                </TD>
              </TR>
            );
          })}
        </TBody>
      </Table>
    </div>
  );
}

function Section({
  title,
  count,
  dotClass,
  children,
}: {
  title: string;
  count: number;
  dotClass: string;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${dotClass}`} />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
          {title}
        </h2>
        <span className="rounded-full bg-ink-100 px-2 py-0.5 text-xs font-semibold tabular-nums text-ink-600">
          {count}
        </span>
      </div>
      {children}
    </section>
  );
}

export default async function BeschikbaarPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const discipline = sp.discipline || "";

  const where = {
    availability: { in: [...CANDIDATE_AVAILABLE_VALUES] },
    ...(discipline ? { discipline } : {}),
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

  const candidates = await db.candidate.findMany({ where });

  // Nu beschikbaar eerst, dan binnenkort op datum (vroegste eerst), dan op
  // beoordeling en tot slot alfabetisch.
  candidates.sort((a, b) => {
    const aa = CANDIDATE_AVAILABILITY_ORDER[a.availability] ?? 9;
    const ba = CANDIDATE_AVAILABILITY_ORDER[b.availability] ?? 9;
    if (aa !== ba) return aa - ba;
    const at = a.availableFrom?.getTime() ?? Infinity;
    const bt = b.availableFrom?.getTime() ?? Infinity;
    if (at !== bt) return at - bt;
    const ra = CANDIDATE_RATING_ORDER[a.rating] ?? 9;
    const rb = CANDIDATE_RATING_ORDER[b.rating] ?? 9;
    if (ra !== rb) return ra - rb;
    return a.lastName.localeCompare(b.lastName);
  });

  const nu = candidates.filter((c) => c.availability === "BESCHIKBAAR");
  const soon = candidates.filter((c) => c.availability === "BINNENKORT");
  const hasFilter = Boolean(q || discipline);

  return (
    <div className="space-y-6">
      <Link
        href="/kandidaten"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar talentpool
      </Link>

      {/* Hero — eigen, herkenbare pagina voor beschikbare mensen */}
      <div className="overflow-hidden rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-6">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
            <UserCheck className="h-6 w-6" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-ink-900">
              Beschikbare kandidaten
            </h1>
            <p className="mt-0.5 text-sm text-ink-600">
              De mensen die nu of binnenkort inzetbaar zijn — direct te plaatsen bij een klant.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Totaal inzetbaar" value={candidates.length} icon={<UserCheck className="h-5 w-5" />} accent="green" />
        <StatCard label="Nu beschikbaar" value={nu.length} icon={<UserCheck className="h-5 w-5" />} accent="brand" />
        <StatCard label="Binnenkort beschikbaar" value={soon.length} icon={<CalendarClock className="h-5 w-5" />} accent="amber" />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="py-4">
          <form
            method="get"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_220px_auto]"
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
            <div className="flex gap-2">
              <button type="submit" className={buttonVariants()}>
                <Search className="h-4 w-4" /> Filter
              </button>
              {hasFilter && (
                <Link href="/kandidaten/beschikbaar" className={buttonVariants({ variant: "outline" })}>
                  Wissen
                </Link>
              )}
            </div>
          </form>
        </CardContent>
      </Card>

      {candidates.length === 0 ? (
        <EmptyState
          icon={<UserCheck className="h-6 w-6" />}
          title={hasFilter ? "Geen beschikbare kandidaten gevonden" : "Nog geen beschikbare kandidaten"}
          description={
            hasFilter
              ? "Pas je zoekopdracht of filters aan."
              : "Markeer kandidaten als 'Beschikbaar' of 'Binnenkort beschikbaar' in de talentpool om ze hier te verzamelen."
          }
          action={
            <Link href="/kandidaten" className={buttonVariants({ variant: "outline" })}>
              Naar talentpool
            </Link>
          }
        />
      ) : (
        <div className="space-y-8">
          <Section title="Nu beschikbaar" count={nu.length} dotClass="bg-emerald-500">
            <CandidateTable candidates={nu} />
          </Section>
          <Section title="Binnenkort beschikbaar" count={soon.length} dotClass="bg-amber-500">
            <CandidateTable candidates={soon} />
          </Section>
        </div>
      )}
    </div>
  );
}
