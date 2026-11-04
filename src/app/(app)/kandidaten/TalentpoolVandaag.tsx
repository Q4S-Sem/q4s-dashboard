import { afgelopen24Uur } from "@/lib/vandaag";
import Link from "next/link";
import { CalendarDays, ChevronRight, ClipboardList, FileText, Kanban, Plus, Users } from "lucide-react";
import { SubmitButton } from "@/components/ui/submit-button";
import { sollicitatieNaarPipeline } from "@/app/(app)/crm/deals/actions";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { WervingFlow } from "./WervingFlow";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { person } from "@/lib/people";
import { herkomst } from "@/lib/eu-herkomst";
import { CANDIDATE_SOURCES, DISCIPLINES } from "@/lib/domain";
import { RatingSelect } from "./RatingSelect";
import { SPOOR, type Spoor } from "@/lib/spoor";


/**
 * Talentpool-hoofdpagina: alleen wie de AFGELOPEN 24 UUR binnenkwam (cv
 * gestuurd / aangemeld) of solliciteerde — ook wat gisteravond laat kwam. De hele pool staat op
 * /kandidaten/alle.
 */
export async function TalentpoolVandaag({ spoor }: { spoor: Spoor }) {
  const sp = SPOOR[spoor];
  const vandaag = afgelopen24Uur();
  const [nieuw, sollicitaties] = await Promise.all([
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
        status: true, vacancyId: true,
        vacancy: { select: { title: true } },
      },
    }),
  ]);

  // Binnen 24 uur: alleen de tijd, of "gist. 21:40" als het van gisteren is.
  const vandaagNL = new Date().toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam" });
  const tijd = (d: Date) =>
    (d.toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam" }) === vandaagNL ? "" : "gist. ") +
    d.toLocaleTimeString("nl-NL", { timeZone: "Europe/Amsterdam", hour: "2-digit", minute: "2-digit" });
  const nieuwIds = new Set(nieuw.map((c) => c.id));
  // Sollicitaties van bestaande kandidaten (nieuwe staan al in de lijst hierboven).
  const vanBestaande = sollicitaties.filter((a) => !nieuwIds.has(a.candidate.id));
  const sollicitatieVan = new Map(sollicitaties.map((a) => [a.candidate.id, a.vacancy?.title ?? "open sollicitatie"]));
  // Sneller verwerken: per sollicitatie op een vacature één klik naar de pipeline (Lead).
  const leadIds = new Set(
    (
      await db.deal.findMany({
        where: { status: "OPEN", candidateId: { in: sollicitaties.map((a) => a.candidate.id) } },
        select: { candidateId: true, vacancyId: true },
      })
    ).map((d) => `${d.candidateId}:${d.vacancyId}`),
  );
  const leadKnop = (a: (typeof sollicitaties)[number] | undefined) => {
    if (!a?.vacancyId) return null;
    if (leadIds.has(`${a.candidate.id}:${a.vacancyId}`))
      return <span className="relative z-10 rounded-sm bg-violet-50 px-2 py-1 text-xs font-medium text-violet-700">In pipeline</span>;
    return (
      <form action={sollicitatieNaarPipeline} className="relative z-10">
        <input type="hidden" name="applicationId" value={a.id} />
        <input type="hidden" name="returnTo" value={sp.basis} />
        <SubmitButton size="sm" variant="outline" pendingLabel="…" title={`Als lead in de pipeline op "${a.vacancy?.title}"`}>
          <Kanban className="h-4 w-4" /> Lead
        </SubmitButton>
      </form>
    );
  };
  const sollicitatieVanKandidaat = new Map(sollicitaties.map((a) => [a.candidate.id, a]));
  return (
    <div className="space-y-6">
      <PageHeader
        title={sp.label}
        description="Binnen → beoordelen → talentpool → pipeline. Wie binnenkwam beoordeel je hier; sollicitanten op een vacature zet je met Lead direct in de pipeline."
        actions={
          <Link href={`/kandidaten/nieuw?spoor=${spoor}`} className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuwe kandidaat
          </Link>
        }
      />

      <WervingFlow spoor={spoor} actief="binnen" />

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
        <div className="divide-y divide-ink-100 overflow-hidden rounded-lg border border-ink-200 bg-white text-[13px]">
          {nieuw.map((c) => {
            const buiten = herkomst(c) === "BUITEN_EU";
            const sol = sollicitatieVan.get(c.id);
            return (
              <div key={c.id} className="relative flex items-center gap-3 px-4 py-3 text-sm">
                <span className="w-16 shrink-0 text-xs tabular-nums text-ink-400">{tijd(c.createdAt)}</span>
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
                {leadKnop(sollicitatieVanKandidaat.get(c.id))}
                <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
              </div>
            );
          })}
          {vanBestaande.map((a) => (
            <div key={a.id} className="relative flex items-center gap-3 px-4 py-3 text-sm">
              <span className="w-16 shrink-0 text-xs tabular-nums text-ink-400">{tijd(a.createdAt)}</span>
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
              {leadKnop(a)}
              <ChevronRight className="h-5 w-5 shrink-0 text-ink-300" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
