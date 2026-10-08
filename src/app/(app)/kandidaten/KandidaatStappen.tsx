import Link from "next/link";
import { Check, FileDown, MessageSquare, Pencil, Kanban } from "lucide-react";
import { db } from "@/lib/db";
import { cn } from "@/lib/utils";
import { buttonVariants, segmentVariants } from "@/components/ui/button";
import { SubmitButton } from "@/components/ui/submit-button";
import { KANDIDAAT_STAPPEN, kandidaatStap } from "@/lib/kandidaat-flow";
import { RatingSelect } from "./RatingSelect";
import { AvailabilitySelect } from "./AvailabilitySelect";
import { PipelineButton } from "./PipelineButton";
import { laadCvIn, setCandidateSpoor } from "./actions";
import { SPOOR, spoorVan } from "@/lib/spoor";
import { createDealFromCandidate } from "../crm/deals/actions";

/**
 * De 4 stappen van een kandidaat bovenaan het dossier, met per stap precies de
 * knoppen die je dan nodig hebt: Binnengekomen → Beoordelen (CV inladen +
 * beoordeling) → Profiel (discipline, beschikbaarheid, notities) → Pipeline.
 */
export async function KandidaatStappen({
  c,
}: {
  c: {
    id: string;
    firstName: string;
    lastName: string;
    rating: string;
    availability: string;
    discipline: string | null;
    cvFileName: string | null;
    source: string;
    createdAt: Date;
    spoor: string;
  };
}) {
  const [openDeals, clients, vacancies] = await Promise.all([
    db.deal.count({ where: { candidateId: c.id, status: "OPEN" } }),
    db.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
    db.vacancy.findMany({
      where: { status: { not: "CONCEPT" } },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: { id: true, title: true, companyName: true },
    }),
  ]);
  const stap = kandidaatStap({ rating: c.rating, discipline: c.discipline, inPipeline: openDeals > 0 });
  const naam = `${c.firstName} ${c.lastName}`;

  return (
    <div className="overflow-hidden rounded-md border border-ink-200 bg-white">
      <ol className="grid grid-cols-2 border-b border-ink-100 sm:grid-cols-4">
        {KANDIDAAT_STAPPEN.map((label, i) => {
          const nr = i + 1;
          const klaar = nr < stap;
          const nu = nr === stap;
          return (
            <li
              key={label}
              className={cn(
                "flex items-center gap-2 px-4 py-2.5 text-sm",
                nu ? "bg-ink-900 font-semibold text-white" : klaar ? "text-ink-700" : "text-ink-400",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                  klaar ? "bg-emerald-600 text-white" : nu ? "bg-white text-ink-900" : "bg-ink-100",
                )}
              >
                {klaar ? <Check className="h-3 w-3" /> : nr}
              </span>
              {label}
            </li>
          );
        })}
      </ol>

      {/* Wervingsspoor: Projecten of WNS+Deta vast (bepaalt in welke lijst en pipeline hij staat). */}
      <form action={setCandidateSpoor} className="flex flex-wrap items-center gap-2 border-b border-ink-100 px-4 py-2 text-xs">
        <input type="hidden" name="id" value={c.id} />
        <span className="text-ink-500">Spoor:</span>
        {(["PROJECT", "VAST"] as const).map((s) => (
          <button
            key={s}
            type="submit"
            name="spoor"
            value={s}
            aria-pressed={spoorVan(c.spoor) === s}
            className={segmentVariants(spoorVan(c.spoor) === s, "h-7 text-xs")}
          >
            {SPOOR[s].label}
          </button>
        ))}
      </form>

      <div className="flex flex-wrap items-center gap-2.5 px-4 py-3 text-sm">
        {stap <= 2 && (
          <>
            <span className="mr-1 text-ink-500">Lees het CV in en geef een beoordeling:</span>
            {c.cvFileName ? (
              <form action={laadCvIn}>
                <input type="hidden" name="id" value={c.id} />
                <SubmitButton size="sm" variant="outline" pendingLabel="CV lezen…">
                  <FileDown className="h-4 w-4" /> CV inladen
                </SubmitButton>
              </form>
            ) : (
              <Link href={`/kandidaten/${c.id}/cv`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <FileDown className="h-4 w-4" /> CV toevoegen
              </Link>
            )}
            <RatingSelect id={c.id} value={c.rating} className="w-40" />
          </>
        )}
        {stap === 3 && (
          <>
            <span className="mr-1 text-ink-500">Vul het profiel aan:</span>
            <Link href={`/kandidaten/${c.id}/bewerken`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <Pencil className="h-4 w-4" /> Discipline & gegevens
            </Link>
            <AvailabilitySelect id={c.id} value={c.availability} className="w-40" />
            <Link href={`/kandidaten/${c.id}/notities`} className={buttonVariants({ variant: "outline", size: "sm" })}>
              <MessageSquare className="h-4 w-4" /> Notities
            </Link>
          </>
        )}
        {stap >= 4 && (
          <>
            <span className="mr-1 text-ink-500">
              {stap === 4 ? "Profiel staat. Zet hem in de pipeline:" : "Staat in de pipeline."}
            </span>
            {stap === 4 ? (
              <PipelineButton
                action={createDealFromCandidate}
                candidateId={c.id}
                candidateName={naam}
                clients={clients.map((k) => ({ id: k.id, name: k.companyName }))}
                vacancies={vacancies.map((v) => ({ id: v.id, title: v.title, company: v.companyName }))}
              />
            ) : (
              <Link href={SPOOR[spoorVan(c.spoor)].pipeline} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <Kanban className="h-4 w-4" /> Naar de pipeline
              </Link>
            )}
            <AvailabilitySelect id={c.id} value={c.availability} className="w-40" />
          </>
        )}
      </div>
    </div>
  );
}
