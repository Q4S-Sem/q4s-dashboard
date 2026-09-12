import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/back-link";
import { Sparkles, Building2, MapPin, Mail, GitBranchPlus, Briefcase } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge, Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { PhoneButton } from "@/components/ui/phone-button";
import { person } from "@/lib/people";
import { cn } from "@/lib/utils";
import { DISCIPLINES, CANDIDATE_RATINGS } from "@/lib/domain";
import { matchDealCandidates } from "@/lib/ai-match";
import { assignCandidateToDeal } from "../../../deals/actions";

export const metadata = { title: "AI-match" };
export const dynamic = "force-dynamic";

const RATING_RING: Record<string, string> = {
  GOED: "ring-emerald-400",
  REDELIJK: "ring-amber-400",
  NIET_MEER: "ring-red-400",
};

export default async function VacatureMatchPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const deal = await db.deal.findUnique({
    where: { id },
    select: {
      id: true, title: true, company: true, discipline: true, location: true,
      candidateId: true, clientId: true,
      client: { select: { id: true, companyName: true } },
    },
  });
  if (!deal) notFound();

  // Draai de AI-match (valt terug op de gratis matcher zonder AVG-sleutel).
  const { matches, usedAI } = await matchDealCandidates(id);
  const top = matches.filter((m) => m.score > 0).slice(0, 20);

  // Kandidaatgegevens ophalen voor de getoonde matches.
  const ids = top.map((m) => m.candidateId);
  const candidates = ids.length
    ? await db.candidate.findMany({
        where: { id: { in: ids } },
        select: {
          id: true, firstName: true, lastName: true, discipline: true,
          headline: true, location: true, rating: true, phone: true,
          email: true, photoFileName: true,
        },
      })
    : [];
  const byId = new Map(candidates.map((c) => [c.id, c]));

  const backToVac = "/crm/vacatures";

  return (
    <div className="space-y-6">
      <BackLink href={`/crm/deals/${deal.id}`}>Terug naar de vacature</BackLink>

      <PageHeader
        title={`AI-match: ${deal.title}`}
        description={`De best passende kandidaten uit de talentpool voor deze vacature bij ${deal.client?.companyName ?? deal.company}. ${usedAI ? "Gerangschikt met AI." : "Gerangschikt met de ingebouwde matcher."}`}
        leading={
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white">
            <Sparkles className="h-6 w-6" />
          </span>
        }
      />

      <div className="flex flex-wrap items-center gap-3 text-sm text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <Building2 className="h-4 w-4 text-ink-400" /> {deal.client?.companyName ?? deal.company}
        </span>
        {deal.discipline && <StatusBadge options={DISCIPLINES} value={deal.discipline} />}
        {deal.location && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-ink-400" /> {deal.location}
          </span>
        )}
      </div>

      {deal.candidateId && (
        <Card>
          <CardContent className="flex items-center gap-2 text-sm text-ink-600">
            <GitBranchPlus className="h-4 w-4 text-violet-600" />
            Er staat al een kandidaat op deze vacature — die vind je op het{" "}
            <Link href="/crm" className="font-medium text-brand-700 hover:underline">pipeline-bord</Link>.
            Je kunt hieronder eventueel een andere kandidaat koppelen.
          </CardContent>
        </Card>
      )}

      {top.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="h-6 w-6" />}
          title="Geen passende kandidaten gevonden"
          description="Voeg meer kandidaten toe aan de talentpool, of vul de functie-eisen van de vacature aan zodat de AI beter kan matchen."
          action={
            <Link href="/kandidaten" className={buttonVariants({ variant: "outline" })}>
              Naar de talentpool
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {top.map((m) => {
            const c = byId.get(m.candidateId);
            if (!c) return null;
            const pct = Math.round(m.score * 100);
            return (
              <Card key={m.candidateId}>
                <CardContent className="flex flex-wrap items-center gap-x-4 gap-y-3 py-3">
                  {/* Kandidaat */}
                  <Link href={`/kandidaten/${c.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar {...person(c)} size="sm" className={cn("ring-2", RATING_RING[c.rating] ?? "ring-ink-200")} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-900">
                        {c.firstName} {c.lastName}
                      </p>
                      <p className="truncate text-xs text-ink-500">
                        {c.headline || (c.discipline ? DISCIPLINES.find((d) => d.value === c.discipline)?.label : "")}
                        {c.location ? ` · ${c.location}` : ""}
                      </p>
                    </div>
                  </Link>

                  {/* Score + reden */}
                  <div className="w-48 shrink-0">
                    <div className="flex items-center justify-between text-[11px] text-ink-500">
                      <span className="font-semibold text-ink-700">{pct}% match</span>
                      <StatusBadge options={CANDIDATE_RATINGS} value={c.rating} />
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-100">
                      <div
                        className={cn("h-full rounded-full", pct >= 70 ? "bg-emerald-500" : pct >= 45 ? "bg-amber-500" : "bg-ink-300")}
                        style={{ width: `${Math.max(6, pct)}%` }}
                      />
                    </div>
                    {m.reason && (
                      <p className="mt-1 truncate text-[11px] text-ink-400" title={m.reason}>{m.reason}</p>
                    )}
                  </div>

                  {/* Acties */}
                  <div className="flex shrink-0 items-center gap-1.5">
                    <PhoneButton phone={c.phone} name={`${c.firstName} ${c.lastName ?? ""}`.trim()} />
                    {c.email ? (
                      <a href={`mailto:${c.email}`} title={`Mail ${c.firstName}`} className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-700 transition-colors hover:bg-blue-200">
                        <Mail className="h-4 w-4" />
                      </a>
                    ) : (
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-ink-100 text-ink-300" title="Geen e-mailadres">
                        <Mail className="h-4 w-4" />
                      </span>
                    )}
                    <form action={assignCandidateToDeal}>
                      <input type="hidden" name="dealId" value={deal.id} />
                      <input type="hidden" name="candidateId" value={c.id} />
                      <input type="hidden" name="reason" value={m.reason} />
                      <input type="hidden" name="returnTo" value={backToVac} />
                      <button type="submit" className={buttonVariants({ variant: "primary", size: "sm" })} title={`${c.firstName} in de pipeline zetten`}>
                        <GitBranchPlus className="h-4 w-4" /> In pipeline
                      </button>
                    </form>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="text-xs text-ink-400">
        Tip: matchen is intern en verstuurt niets. Een kandidaat koppelen zet de vacature op het{" "}
        <Link href="/crm" className="text-brand-700 hover:underline">pipeline-bord</Link>.
      </p>
    </div>
  );
}
