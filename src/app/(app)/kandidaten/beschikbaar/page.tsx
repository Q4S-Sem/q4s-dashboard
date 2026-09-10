import Link from "next/link";
import type { Candidate } from "@prisma/client";
import {
  UserCheck,
  Search,
  CalendarClock,
  Mail,
  Eye,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { Input, Select } from "@/components/ui/field";
import { AutoFilterForm } from "@/components/ui/auto-filter-form";
import { Table, THead, TBody, TR, TH, TD, RowLink } from "@/components/ui/table";
import { cn, formatDate } from "@/lib/utils";
import { person } from "@/lib/people";
import {
  DISCIPLINES,
  CANDIDATE_RATING_ORDER,
} from "@/lib/domain";
import { RatingSelect } from "../RatingSelect";
import { AvailabilitySelect } from "../AvailabilitySelect";
import { PhoneReveal } from "../PhoneReveal";

export const metadata = { title: "Beschikbaarheid" };
export const dynamic = "force-dynamic";

type SP = { q?: string; discipline?: string; status?: string };

/** De vier beschikbaarheids-tabs (statuswaarde → tablabel + kleurstip). */
const STATUS_TABS = [
  { key: "BESCHIKBAAR", label: "Beschikbaar", dot: "bg-emerald-500" },
  { key: "BINNENKORT", label: "Binnenkort", dot: "bg-amber-500" },
  { key: "NIET_BESCHIKBAAR", label: "Niet", dot: "bg-red-500" },
  { key: "ONBEKEND", label: "Overige", dot: "bg-ink-300" },
] as const;

/** Compacte, scanbare tabel met beschikbare kandidaten (één rij per persoon). */
function CandidateTable({ candidates }: { candidates: Candidate[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-ink-200 bg-white">
      {/* Vaste kolombreedtes, zodat "Nu beschikbaar" en "Binnenkort beschikbaar"
          exact onder elkaar uitlijnen — met automatische breedtes verschoven de
          kolommen per tabel mee met de inhoud. */}
      <Table className="min-w-[58rem] table-fixed">
        <colgroup>
          <col />
          <col className="w-[13rem]" />
          <col className="w-[7.5rem]" />
          <col className="w-[11rem]" />
          <col className="w-[7.5rem]" />
        </colgroup>
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
                        <RowLink href={`/kandidaten/${c.id}`} className="truncate">
                          {c.firstName} {c.lastName}
                        </RowLink>
                        {c.discipline && <StatusBadge options={DISCIPLINES} value={c.discipline} />}
                      </div>
                      {sub && <p className="max-w-[17rem] truncate text-xs text-ink-400">{sub}</p>}
                    </div>
                  </div>
                </TD>
                <TD className="relative z-10">
                  <AvailabilitySelect id={c.id} value={c.availability} className="w-40" />
                  {soon && c.availableFrom && (
                    <p className="mt-1 inline-flex items-center gap-1 text-[11px] text-amber-600">
                      <CalendarClock className="h-3 w-3" /> vanaf {formatDate(c.availableFrom)}
                    </p>
                  )}
                </TD>
                <TD className="relative z-10">
                  {/* Alleen icoontjes: het adres zelf zit in de tooltip, zodat de
                      kolom smal en scanbaar blijft. */}
                  <div className="flex items-center gap-2">
                    {c.email ? (
                      <a
                        href={`mailto:${c.email}`}
                        title={c.email}
                        aria-label={`Mail ${c.firstName} ${c.lastName}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-ink-200 text-ink-600 transition-colors hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
                      >
                        <Mail className="h-4 w-4" />
                      </a>
                    ) : (
                      <span
                        title="Geen e-mailadres bekend"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-ink-200 text-ink-300"
                      >
                        <Mail className="h-4 w-4" />
                      </span>
                    )}
                    <PhoneReveal phone={c.phone} />
                  </div>
                </TD>
                <TD className="relative z-10">
                  <RatingSelect id={c.id} value={c.rating} className="w-36" />
                </TD>
                <TD className="relative z-10 text-right">
                  <Link
                    href={`/kandidaten/${c.id}`}
                    title={`Bekijk ${c.firstName} ${c.lastName}`}
                    aria-label={`Bekijk ${c.firstName} ${c.lastName}`}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-ink-200 text-ink-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                  >
                    <Eye className="h-4 w-4" />
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

export default async function BeschikbaarPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim() || "";
  const discipline = sp.discipline || "";
  const activeStatus = STATUS_TABS.some((t) => t.key === sp.status)
    ? (sp.status as string)
    : "BESCHIKBAAR";

  // Alle kandidaten die aan zoek/discipline voldoen — we verdelen ze daarna zelf
  // over de vier beschikbaarheids-tabs (zodat elke tab z'n aantal kan tonen).
  const where = {
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

  // Binnen een tab: binnenkort op datum (vroegste eerst), dan op beoordeling en
  // tot slot alfabetisch.
  candidates.sort((a, b) => {
    const at = a.availableFrom?.getTime() ?? Infinity;
    const bt = b.availableFrom?.getTime() ?? Infinity;
    if (at !== bt) return at - bt;
    const ra = CANDIDATE_RATING_ORDER[a.rating] ?? 9;
    const rb = CANDIDATE_RATING_ORDER[b.rating] ?? 9;
    if (ra !== rb) return ra - rb;
    return a.lastName.localeCompare(b.lastName);
  });

  // Tel per status en pak de rijen voor de actieve tab. Alles wat geen bekende
  // status heeft valt onder "Overige" (ONBEKEND).
  const known = new Set<string>(STATUS_TABS.map((t) => t.key));
  const countFor = (key: string) =>
    key === "ONBEKEND"
      ? candidates.filter((c) => !known.has(c.availability) || c.availability === "ONBEKEND").length
      : candidates.filter((c) => c.availability === key).length;
  const rows =
    activeStatus === "ONBEKEND"
      ? candidates.filter((c) => !known.has(c.availability) || c.availability === "ONBEKEND")
      : candidates.filter((c) => c.availability === activeStatus);

  const hasFilter = Boolean(q || discipline);
  const activeLabel = STATUS_TABS.find((t) => t.key === activeStatus)?.label ?? "";

  /** Bouw een tab-link die de huidige zoek/discipline behoudt. */
  const tabHref = (status: string) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (discipline) params.set("discipline", discipline);
    params.set("status", status);
    return `/kandidaten/beschikbaar?${params.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Beschikbaarheid"
        description="Schakel tussen beschikbaar, binnenkort, niet beschikbaar en overige — zo blijft het overzichtelijk."
      />

      {/* Filters — zoekt automatisch bij typen/kiezen, geen knop nodig */}
      <Card>
        <CardContent className="py-4">
          <AutoFilterForm
            basePath="/kandidaten/beschikbaar"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_220px_auto]"
          >
            {/* Behoud de actieve tab tijdens het filteren. */}
            <input type="hidden" name="status" value={activeStatus} />
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
            <Select name="discipline" defaultValue={discipline} aria-label="Discipline">
              <option value="">Alle disciplines</option>
              {DISCIPLINES.map((d) => (
                <option key={d.value} value={d.value} data-color={d.color}>
                  {d.label}
                </option>
              ))}
            </Select>
            <div className="flex gap-2">
              {hasFilter && (
                <Link href={tabHref(activeStatus)} className={buttonVariants({ variant: "outline" })}>
                  Wissen
                </Link>
              )}
            </div>
          </AutoFilterForm>
        </CardContent>
      </Card>

      {/* Tabs — schakel tussen de vier beschikbaarheids-statussen */}
      <nav
        aria-label="Beschikbaarheid"
        className="flex items-end gap-1 overflow-x-auto border-b border-ink-200"
      >
        {STATUS_TABS.map((t) => {
          const active = t.key === activeStatus;
          const count = countFor(t.key);
          return (
            <Link
              key={t.key}
              href={tabHref(t.key)}
              scroll={false}
              aria-current={active ? "page" : undefined}
              className={cn(
                "-mb-px inline-flex shrink-0 items-center gap-2 rounded-t-xl border px-4 py-2.5 text-sm font-medium transition-colors",
                active
                  ? "border-ink-200 border-b-[#fafafa] bg-white text-ink-900"
                  : "border-transparent text-ink-500 hover:bg-ink-100 hover:text-ink-900",
              )}
            >
              <span className={cn("h-2.5 w-2.5 rounded-full", t.dot)} />
              {t.label}
              <span
                className={cn(
                  "rounded-sm px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                  active ? "bg-brand-50 text-brand-700" : "bg-ink-100 text-ink-500",
                )}
              >
                {count}
              </span>
            </Link>
          );
        })}
      </nav>

      {rows.length === 0 ? (
        <EmptyState
          icon={<UserCheck className="h-6 w-6" />}
          title={
            hasFilter
              ? `Geen kandidaten in "${activeLabel}" gevonden`
              : `Geen kandidaten met status "${activeLabel}"`
          }
          description={
            hasFilter
              ? "Pas je zoekopdracht of filters aan, of kies een andere tab."
              : "Zet de beschikbaarheid van een kandidaat in de talentpool om ze hier te zien."
          }
          action={
            <Link href="/kandidaten" className={buttonVariants({ variant: "outline" })}>
              Naar talentpool
            </Link>
          }
        />
      ) : (
        <CandidateTable candidates={rows} />
      )}
    </div>
  );
}
