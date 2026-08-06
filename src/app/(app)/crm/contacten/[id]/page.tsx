import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, MessageSquare, ExternalLink } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { CrmNotesTimeline, type TimelineNote } from "@/components/crm-notes-timeline";
import { CrmNoteComposer } from "@/components/crm-note-composer";
import { formatCurrency } from "@/lib/utils";
import { DEAL_STATUSES, type BadgeColor } from "@/lib/domain";
import {
  deleteContact,
  addContactNote,
  togglePinContactNote,
  deleteContactNote,
  completeContactNoteFollowUp,
} from "../actions";

export const metadata = { title: "Contact" };
export const dynamic = "force-dynamic";

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</dt>
      <dd className="mt-1 text-sm text-ink-900">{value || "—"}</dd>
    </div>
  );
}

export default async function ContactDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const contact = await db.crmContact.findUnique({
    where: { id },
    include: {
      owner: true,
      targetClient: true,
      client: true,
      deals: { include: { stage: true }, orderBy: { updatedAt: "desc" } },
      crmNotes: { include: { author: { select: { name: true } } }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!contact) notFound();

  const notes: TimelineNote[] = contact.crmNotes.map((n) => ({
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

  const fullName = `${contact.firstName} ${contact.lastName ?? ""}`.trim();

  return (
    <div className="space-y-6">
      <BackLink href="/crm/contacten">
        Terug naar contacten
      </BackLink>

      <PageHeader
        title={fullName}
        description={[contact.jobTitle, contact.company].filter(Boolean).join(" · ")}
        actions={
          <>
            <Link href={`/crm/contacten/${contact.id}/bewerken`} className={buttonVariants({ variant: "outline" })}>
              <Pencil className="h-4 w-4" /> Bewerken
            </Link>
            <ConfirmSubmit action={deleteContact} id={contact.id} message={`Contact "${fullName}" verwijderen?`}>
              Verwijderen
            </ConfirmSubmit>
          </>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Gegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <Detail
              label="E-mail"
              value={contact.email ? <a href={`mailto:${contact.email}`} className="text-brand-700 hover:underline">{contact.email}</a> : null}
            />
            <Detail
              label="Telefoon"
              value={contact.phone ? <a href={`tel:${contact.phone}`} className="text-brand-700 hover:underline">{contact.phone}</a> : null}
            />
            <Detail
              label="LinkedIn"
              value={
                contact.linkedinUrl ? (
                  <a href={contact.linkedinUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-brand-700 hover:underline">
                    Profiel <ExternalLink className="h-3 w-3" />
                  </a>
                ) : null
              }
            />
            <Detail label="Eigenaar" value={contact.owner?.name} />
            <Detail
              label="Opdrachtgever"
              value={
                contact.targetClient ? (
                  <Link href={`/opdrachtgevers/${contact.targetClient.id}`} className="text-brand-700 hover:underline">
                    {contact.targetClient.name}
                  </Link>
                ) : null
              }
            />
            <Detail
              label="Klant"
              value={
                contact.client ? (
                  <Link href={`/klanten/${contact.client.id}`} className="text-brand-700 hover:underline">
                    {contact.client.companyName}
                  </Link>
                ) : null
              }
            />
          </dl>
          {contact.notes && (
            <div className="mt-5 border-t border-ink-100 pt-4">
              <p className="whitespace-pre-wrap text-sm text-ink-600">{contact.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {contact.deals.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Deals</CardTitle>
          </CardHeader>
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Deal</TH>
                <TH>Fase</TH>
                <TH className="text-right">Waarde</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {contact.deals.map((d) => (
                <TR key={d.id}>
                  <TD>
                    <Link href={`/crm/deals/${d.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                      {d.title}
                    </Link>
                  </TD>
                  <TD>
                    <Badge color={(d.stage.color as BadgeColor) ?? "slate"}>{d.stage.name}</Badge>
                  </TD>
                  <TD className="text-right tabular-nums">{formatCurrency(d.value)}</TD>
                  <TD>
                    <StatusBadge options={DEAL_STATUSES} value={d.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
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
              action={addContactNote}
              parentIdName="contactId"
              parentId={contact.id}
              placeholder={`Wat besprak je met ${contact.firstName}? Bijv. 'Gebeld — zoekt 2 lassers voor Q3, stuurt functieprofiel.'`}
            />
          </div>
          <CrmNotesTimeline
            notes={notes}
            parentIdName="contactId"
            parentId={contact.id}
            togglePinAction={togglePinContactNote}
            deleteAction={deleteContactNote}
            completeNoteAction={completeContactNoteFollowUp}
          />
        </CardContent>
      </Card>
    </div>
  );
}
