import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { Pencil, Star, CalendarClock, CheckCircle2, MessageSquare, ArrowRight, Mail, Phone } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Avatar } from "@/components/ui/avatar";
import { buttonVariants } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { CrmNotesTimeline, type TimelineNote } from "@/components/crm-notes-timeline";
import { CrmNoteComposer } from "@/components/crm-note-composer";
import { person } from "@/lib/people";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { DEAL_STATUSES, DEAL_SOURCES, DISCIPLINES, EMPLOYMENT_TYPES, CANDIDATE_RATINGS, labelFor, colorFor, type BadgeColor } from "@/lib/domain";
import { deleteDeal, togglePinNote, deleteNote, completeDealFollowUp, addDealNote } from "../actions";
import { CloseDealButtons } from "../CloseDealButtons";

export const metadata = { title: "Deal" };
export const dynamic = "force-dynamic";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="mt-1 text-sm text-ink-900">{value || "—"}</dd>
    </div>
  );
}

/** Meerregelig veld (werkzaamheden/eisen) — regels als opsomming. */
function TextBlock({ label, text }: { label: string; text: string }) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
      {lines.length > 1 ? (
        <ul className="space-y-1">
          {lines.map((l, i) => (
            <li key={i} className="flex gap-2 text-sm text-ink-800">
              <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-ink-300" />
              {l}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-ink-800">{text}</p>
      )}
    </div>
  );
}

function Stars({ n }: { n: number }) {
  if (!n) return <span className="text-ink-400">Onbeoordeeld</span>;
  return (
    <span className="inline-flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn("h-3.5 w-3.5", i < n ? "fill-amber-400 text-amber-400" : "text-ink-200")}
        />
      ))}
    </span>
  );
}

export default async function DealDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const deal = await db.deal.findUnique({
    where: { id },
    include: {
      stage: true,
      owner: true,
      client: true,
      vacancy: true,
      primaryContact: true,
      crmNotes: {
        include: { author: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!deal) notFound();

  // Gekoppelde kandidaat (Deal.candidateId heeft geen relatie in het schema).
  const candidate = deal.candidateId
    ? await db.candidate.findUnique({
        where: { id: deal.candidateId },
        select: {
          id: true, firstName: true, lastName: true, headline: true, discipline: true,
          location: true, email: true, phone: true, rating: true, photoFileName: true,
        },
      })
    : null;

  const notes: TimelineNote[] = deal.crmNotes.map((n) => ({
    id: n.id,
    type: n.type,
    body: n.body,
    sentiment: n.sentiment,
    pinned: n.pinned,
    followUpAt: n.followUpAt,
    followUpDone: n.followUpDone,
    createdAt: n.createdAt,
    authorName: n.author?.name ?? null,
  }));

  const followUpOverdue =
    deal.nextFollowUpAt && new Date(deal.nextFollowUpAt).getTime() <= Date.now();

  return (
    <div className="space-y-6">
      <BackLink href="/crm">
        Terug naar CRM
      </BackLink>

      <PageHeader
        title={deal.title}
        description={[deal.company, deal.discipline ? labelFor(DISCIPLINES, deal.discipline) : null].filter(Boolean).join(" · ")}
        leading={
          candidate ? (
            <Avatar {...person(candidate)} size="lg" className="ring-2 ring-ink-200" />
          ) : undefined
        }
        actions={
          <>
            <StatusBadge options={DEAL_STATUSES} value={deal.status} />
            <Badge color={(deal.stage.color as BadgeColor) ?? "slate"}>{deal.stage.name}</Badge>
            <Link href={`/crm/deals/${deal.id}/bewerken`} className={buttonVariants({ variant: "outline" })}>
              <Pencil className="h-4 w-4" /> Bewerken
            </Link>
            <ConfirmSubmit action={deleteDeal} id={deal.id} message={`Deal "${deal.title}" verwijderen?`}>
              Verwijderen
            </ConfirmSubmit>
          </>
        }
      />

      <CloseDealButtons dealId={deal.id} status={deal.status} />

      {/* Kandidaat-kaart — dezelfde stijl als de talentpool, met snelkoppeling naar het dossier */}
      {candidate && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-4 py-4">
            <Avatar {...person(candidate)} size="md" className="ring-2 ring-ink-200" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/kandidaten/${candidate.id}`}
                  className="text-base font-semibold text-ink-900 hover:text-brand-700"
                >
                  {candidate.firstName} {candidate.lastName}
                </Link>
                {candidate.discipline && (
                  <StatusBadge options={DISCIPLINES} value={candidate.discipline} />
                )}
                <StatusBadge options={CANDIDATE_RATINGS} value={candidate.rating} />
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
                {candidate.headline && <span className="truncate">{candidate.headline}</span>}
                {candidate.location && <span>{candidate.location}</span>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {candidate.phone && (
                <a
                  href={`tel:${candidate.phone}`}
                  title={`Bel ${candidate.firstName}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 transition-colors hover:bg-emerald-200"
                >
                  <Phone className="h-4 w-4" />
                </a>
              )}
              {candidate.email && (
                <a
                  href={`mailto:${candidate.email}`}
                  title={`Mail ${candidate.firstName}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-blue-100 text-blue-700 transition-colors hover:bg-blue-200"
                >
                  <Mail className="h-4 w-4" />
                </a>
              )}
              <Link
                href={`/kandidaten/${candidate.id}`}
                className={buttonVariants({ variant: "outline", size: "sm" })}
              >
                Profiel <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </CardContent>
        </Card>
      )}

      {deal.status === "LOST" && deal.lostReason && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Verloren — reden: {deal.lostReason}
        </p>
      )}

      {deal.status === "OPEN" && deal.nextFollowUpAt && (
        <div
          className={cn(
            "flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-3",
            followUpOverdue ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50",
          )}
        >
          <span className={cn("inline-flex items-center gap-2 text-sm font-medium", followUpOverdue ? "text-red-700" : "text-amber-800")}>
            <CalendarClock className="h-4 w-4" />
            Opvolgen op {formatDate(deal.nextFollowUpAt)}
            {followUpOverdue && " — over tijd"}
          </span>
          <form action={completeDealFollowUp}>
            <input type="hidden" name="id" value={deal.id} />
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-ink-700 shadow-sm ring-1 ring-inset ring-ink-200 hover:bg-ink-50"
            >
              <CheckCircle2 className="h-4 w-4 text-emerald-600" /> Opvolging afronden
            </button>
          </form>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Gegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <Detail label="Eigenaar" value={deal.owner?.name} />
            <Detail label="Fase" value={<Badge color={(deal.stage.color as BadgeColor) ?? "slate"}>{deal.stage.name}</Badge>} />
            <Detail label="Winkans" value={`${deal.probability}%`} />
            <Detail label="Waarde" value={formatCurrency(deal.value)} />
            <Detail label="Posities" value={deal.positions} />
            <Detail label="Fit / warmte" value={<Stars n={deal.fitScore} />} />
            <Detail label="Bron" value={labelFor(DEAL_SOURCES, deal.source)} />
            <Detail label="Verwachte sluitdatum" value={deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : null} />
            <Detail label="Aangemaakt" value={formatDate(deal.createdAt)} />
            <Detail
              label="Klant"
              value={
                deal.client ? (
                  <Link href={`/klanten/${deal.client.id}`} className="text-brand-700 hover:underline">
                    {deal.client.companyName}
                  </Link>
                ) : null
              }
            />
            <Detail
              label="Vacature"
              value={
                deal.vacancy ? (
                  <Link href={`/vacatures/${deal.vacancy.id}`} className="text-brand-700 hover:underline">
                    {deal.vacancy.title}
                  </Link>
                ) : null
              }
            />
            <Detail
              label="Contactpersoon"
              value={
                deal.primaryContact ? (
                  <Link href={`/crm/contacten/${deal.primaryContact.id}`} className="text-brand-700 hover:underline">
                    {deal.primaryContact.firstName} {deal.primaryContact.lastName ?? ""}
                  </Link>
                ) : null
              }
            />
          </dl>
        </CardContent>
      </Card>

      {/* Vacaturedetails — alleen als er iets is ingevuld */}
      {!deal.candidateId &&
        (deal.hoursPerWeek || deal.durationText || deal.rateText || deal.experienceText ||
          deal.educationLevel || deal.responsibilities || deal.requirements ||
          deal.niceToHave || deal.certificates || deal.location || deal.employmentType) && (
        <Card>
          <CardHeader>
            <CardTitle>Vacaturedetails</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
              <Detail label="Locatie" value={deal.location} />
              <Detail label="Dienstverband" value={deal.employmentType ? labelFor(EMPLOYMENT_TYPES, deal.employmentType) : null} />
              <Detail label="Uren per week" value={deal.hoursPerWeek ? `${deal.hoursPerWeek} u` : null} />
              <Detail label="Duur" value={deal.durationText} />
              <Detail label="Tarief / salaris" value={deal.rateText} />
              <Detail label="Gevraagde ervaring" value={deal.experienceText} />
              <Detail label="Opleidingsniveau" value={deal.educationLevel} />
            </dl>
            {deal.responsibilities && (
              <TextBlock label="Werkzaamheden" text={deal.responsibilities} />
            )}
            {deal.requirements && <TextBlock label="Functie-eisen" text={deal.requirements} />}
            {deal.niceToHave && <TextBlock label="Pré" text={deal.niceToHave} />}
            {deal.certificates && <TextBlock label="Vereiste certificaten" text={deal.certificates} />}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-ink-400" /> Notitieblok
            <span className="text-xs font-normal text-ink-400">({notes.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="rounded-lg border border-ink-200 bg-ink-50/60 p-4">
            <CrmNoteComposer
              key={notes.length}
              action={addDealNote}
              parentIdName="dealId"
              parentId={deal.id}
              placeholder="Wat is er gebeurd of besproken? Bijv. 'Gebeld met inkoop — budget rond, wachten op vacaturetekst.'"
            />
          </div>
          <CrmNotesTimeline
            notes={notes}
            parentIdName="dealId"
            parentId={deal.id}
            togglePinAction={togglePinNote}
            deleteAction={deleteNote}
          />
        </CardContent>
      </Card>
    </div>
  );
}
