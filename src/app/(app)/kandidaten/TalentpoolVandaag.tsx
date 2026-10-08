import Link from "next/link";
import { CalendarDays, ChevronRight, ClipboardCheck, ClipboardList, FileText, Globe, Inbox, Plus, Users } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { FilterTegels, type FilterTegel } from "@/components/ui/filter-tegels";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { person } from "@/lib/people";
import { herkomst } from "@/lib/eu-herkomst";
import { startVandaagNL } from "@/lib/vandaag";
import { CANDIDATE_SOURCES, DISCIPLINES } from "@/lib/domain";
import { RatingSelect } from "./RatingSelect";
import { SPOOR, type Spoor } from "@/lib/spoor";


/**
 * Talentpool-hoofdpagina: elke dag een schone pagina met alleen wie VANDAAG
 * binnenkwam (cv gestuurd / aangemeld) of solliciteerde. De hele pool staat op
 * /kandidaten/alle.
 */
export async function TalentpoolVandaag({ spoor }: { spoor: Spoor }) {
  const sp = SPOOR[spoor];
  const vandaag = startVandaagNL();
  const [nieuw, sollicitaties, totaal, teBeoordelen] = await Promise.all([
    db.candidate.findMany({
      where: { createdAt: { gte: vandaag }, spoor },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, firstName: true, lastName: true, photoFileName: true, headline: true, discipline: true,
        location: true, phone: true, source: true, rating: true, createdAt: true,
      },
    }),
    db.application.findMany({
      where: { createdAt: { gte: vandaag }, candidate: { spoor } },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, createdAt: true,
        candidate: { select: { id: true, firstName: true, lastName: true, createdAt: true } },
        vacancy: { select: { title: true } },
      },
    }),
    db.candidate.count({ where: { spoor } }),
    db.candidate.count({ where: { rating: "ONBEKEND", spoor } }),
  ]);

  const tijd = (d: Date) => d.toLocaleTimeString("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" });
  const datum = new Date().toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam", weekday: "long", day: "numeric", month: "long" });
  const nieuwIds = new Set(nieuw.map((c) => c.id));
  // Sollicitaties van bestaande kandidaten (nieuwe staan al in de lijst hierboven).
  const vanBestaande = sollicitaties.filter((a) => !nieuwIds.has(a.candidate.id));
  const sollicitatieVan = new Map(sollicitaties.map((a) => [a.candidate.id, a.vacancy?.title ?? "open sollicitatie"]));
  const buitenEU = nieuw.filter((c) => herkomst(c) === "BUITEN_EU").length;

  const tegels: FilterTegel[] = [
    { key: "nieuw", label: "Vandaag binnen", waarde: nieuw.length + vanBestaande.length, icon: <Inbox className="h-4 w-4" />, toon: "blue", href: sp.basis, actief: true },
    { key: "beoordelen", label: "Ter beoordeling", waarde: teBeoordelen, icon: <ClipboardCheck className="h-4 w-4" />, toon: "amber", href: `${sp.alle}?map=beoordelen`, actief: false },
    { key: "buiten", label: "Vandaag buiten de EU", waarde: buitenEU, icon: <Globe className="h-4 w-4" />, toon: "red", href: `${sp.alle}?map=buiten`, actief: false },
    { key: "alle", label: "Alle kandidaten", waarde: totaal, icon: <Users className="h-4 w-4" />, toon: "slate", href: sp.alle, actief: false },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${sp.label} — vandaag binnen`}
        description={`Vandaag binnengekomen — ${datum}. Elke dag begint deze pagina leeg; de hele pool staat bij Alle kandidaten.`}
        actions={
          <>
            <Link href={sp.alle} className={buttonVariants({ variant: "outline" })}>
              <Users className="h-4 w-4" /> Alle kandidaten
            </Link>
            <Link href={`/kandidaten/nieuw?spoor=${spoor}`} className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe kandidaat
            </Link>
          </>
        }
      />

      <FilterTegels items={tegels} label="Talentpool vandaag" />

      {nieuw.length + vanBestaande.length === 0 ? (
        <EmptyState
          icon={<CalendarDays className="h-6 w-6" />}
          title="Vandaag nog niemand binnen"
          description="Zodra iemand via de website een cv stuurt, solliciteert of per mail binnenkomt, staat hij hier."
          action={
            <Link href={sp.alle} className={buttonVariants({ variant: "outline" })}>
              <Users className="h-4 w-4" /> Naar alle kandidaten
            </Link>
          }
        />
      ) : (
        <div className="divide-y divide-ink-100 overflow-hidden rounded-md border border-ink-200 bg-white">
          {nieuw.map((c) => {
            const buiten = herkomst(c) === "BUITEN_EU";
            const sol = sollicitatieVan.get(c.id);
            return (
              <div key={c.id} className="relative flex items-center gap-3 px-4 py-3 text-sm">
                <span className="w-12 shrink-0 text-xs tabular-nums text-ink-400">{tijd(c.createdAt)}</span>
                <Avatar {...person(c)} size="sm" />
                <div className="min-w-0 flex-1">
                  <Link href={`/kandidaten/${c.id}`} className="font-semibold text-ink-900 after:absolute after:inset-0 hover:text-brand-700">
                    {c.firstName} {c.lastName}
                  </Link>
                  <p className="flex items-center gap-1.5 truncate text-xs text-ink-500">
                    {sol ? <ClipboardList className="h-3.5 w-3.5 text-violet-600" /> : <FileText className="h-3.5 w-3.5 text-blue-600" />}
                    {sol ? `Sollicitatie: ${sol}` : "Cv ingestuurd"}
                    {c.headline ? ` · ${c.headline}` : ""}
                    {c.location ? ` · ${c.location}` : ""}
                  </p>
                </div>
                {buiten && <span className="rounded-sm bg-red-50 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">Buiten EU</span>}
                <div className="hidden w-32 justify-end sm:flex">
                  {c.discipline && <StatusBadge options={DISCIPLINES} value={c.discipline} />}
                </div>
                <div className="hidden w-28 justify-end md:flex">
                  <StatusBadge options={CANDIDATE_SOURCES} value={c.source} />
                </div>
                <div className="relative z-10">
                  <RatingSelect id={c.id} value={c.rating} className="w-36" />
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
              </div>
            );
          })}
          {vanBestaande.map((a) => (
            <div key={a.id} className="relative flex items-center gap-3 px-4 py-3 text-sm">
              <span className="w-12 shrink-0 text-xs tabular-nums text-ink-400">{tijd(a.createdAt)}</span>
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-50 text-violet-600">
                <ClipboardList className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <Link href={`/kandidaten/${a.candidate.id}`} className="font-semibold text-ink-900 after:absolute after:inset-0 hover:text-brand-700">
                  {a.candidate.firstName} {a.candidate.lastName}
                </Link>
                <p className="truncate text-xs text-ink-500">
                  Bekende kandidaat solliciteerde opnieuw{a.vacancy ? `: ${a.vacancy.title}` : ""}
                </p>
              </div>
              <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
