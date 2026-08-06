import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Star, CalendarClock, CheckCircle2, MessageSquare } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { CrmNotesTimeline, type TimelineNote } from "@/components/crm-notes-timeline";
import { CrmNoteComposer } from "@/components/crm-note-composer";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { DEAL_STATUSES, DEAL_SOURCES, DISCIPLINES, labelFor, colorFor, type BadgeColor } from "@/lib/domain";
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
      targetClient: true,
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
              label="Opdrachtgever"
              value={
                deal.targetClient ? (
                  <Link href={`/opdrachtgevers/${deal.targetClient.id}`} className="text-brand-700 hover:underline">
                    {deal.targetClient.name}
                  </Link>
                ) : null
              }
            />
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
