import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Users, Mail, Phone, Plus, Trash2 } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { Field, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/submit-button";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { deleteClient, addClientContact, deleteClientContact } from "../actions";
import { PlacementsPanel, InvoicesPanel } from "./ClientRelations";
import { getActivities } from "@/lib/activities";
import { ActivityFeed } from "@/components/activity/ActivityFeed";

export const metadata = { title: "Klant" };

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}

export default async function KlantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const client = await db.client.findUnique({
    where: { id },
    include: {
      placements: { include: { consultant: true }, orderBy: { startDate: "desc" } },
      invoices: { orderBy: { issueDate: "desc" } },
      contacts: { orderBy: { createdAt: "asc" } },
    },
  });

  if (!client) notFound();

  const activities = await getActivities("client", client.id);

  return (
    <div className="space-y-6">
      <Link
        href="/klanten"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar klanten
      </Link>

      <PageHeader
        title={client.companyName}
        description={[client.city, client.country].filter(Boolean).join(", ")}
        actions={
          <>
            <Link
              href={`/klanten/${client.id}/bewerken`}
              className={buttonVariants({ variant: "outline" })}
            >
              <Pencil className="h-4 w-4" /> Bewerken
            </Link>
            <ConfirmSubmit
              action={deleteClient}
              id={client.id}
              message={`Klant "${client.companyName}" verwijderen?`}
            >
              Verwijderen
            </ConfirmSubmit>
          </>
        }
      />

      {error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze klant kan niet verwijderd worden zolang er plaatsingen of facturen
          aan gekoppeld zijn.
        </p>
      )}
      {error === "contact" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Vul minimaal een naam in voor de contactpersoon.
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Gegevens</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-5 sm:grid-cols-3">
            <Detail label="Contactpersoon" value={client.contactName} />
            <Detail label="E-mail" value={client.email} />
            <Detail label="Telefoon" value={client.phone} />
            <Detail label="Factuur-e-mail" value={client.invoiceEmail} />
            <Detail
              label="Adres"
              value={[client.address, [client.postalCode, client.city].filter(Boolean).join(" ")]
                .filter(Boolean)
                .join(", ")}
            />
            <Detail label="BTW-nummer" value={client.vatNumber} />
            <Detail label="KvK-nummer" value={client.kvkNumber} />
            <Detail label="Betaaltermijn" value={`${client.paymentTermDays} dagen`} />
          </dl>
          {client.notes && (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="whitespace-pre-wrap text-sm text-slate-600">{client.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contactpersonen — meerdere, zodat je altijd iemand kunt bereiken */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-500" /> Contactpersonen
          </CardTitle>
          <span className="text-sm text-slate-500">
            Extra contacten — voor als de hoofdcontactpersoon niet opneemt.
          </span>
        </CardHeader>
        <CardContent className="space-y-5">
          {client.contacts.length > 0 && (
            <ul className="divide-y divide-slate-100">
              {client.contacts.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-slate-900">{c.name}</span>
                      {c.role && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {c.role}
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-slate-500">
                      {c.email && (
                        <a
                          href={`mailto:${c.email}`}
                          className="inline-flex items-center gap-1 hover:text-emerald-700 hover:underline"
                        >
                          <Mail className="h-3 w-3" /> {c.email}
                        </a>
                      )}
                      {c.phone && (
                        <a
                          href={`tel:${c.phone}`}
                          className="inline-flex items-center gap-1 hover:text-slate-800 hover:underline"
                        >
                          <Phone className="h-3 w-3" /> {c.phone}
                        </a>
                      )}
                      {!c.email && !c.phone && <span className="text-slate-300">geen contactgegevens</span>}
                    </div>
                    {c.notes && <p className="mt-0.5 text-xs text-slate-400">{c.notes}</p>}
                  </div>
                  <ConfirmSubmit
                    action={deleteClientContact}
                    id={c.id}
                    hidden={{ clientId: client.id }}
                    message={`Contact "${c.name}" verwijderen?`}
                    variant="ghost"
                    size="icon"
                  >
                    <Trash2 className="h-4 w-4" />
                  </ConfirmSubmit>
                </li>
              ))}
            </ul>
          )}

          <form action={addClientContact} className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <input type="hidden" name="clientId" value={client.id} />
            <Field label="Naam" htmlFor="c-name">
              <Input id="c-name" name="name" required placeholder="Bijv. Jan de Vries" />
            </Field>
            <Field label="Functie" htmlFor="c-role">
              <Input id="c-role" name="role" placeholder="Bijv. Inkoper" />
            </Field>
            <Field label="E-mail" htmlFor="c-email">
              <Input id="c-email" name="email" type="email" />
            </Field>
            <Field label="Telefoon" htmlFor="c-phone">
              <Input id="c-phone" name="phone" />
            </Field>
            <SubmitButton className="w-full" pendingLabel="Opslaan…">
              <Plus className="h-4 w-4" /> Toevoegen
            </SubmitButton>
          </form>
        </CardContent>
      </Card>

      <PlacementsPanel
        placements={client.placements.map((p) => ({
          id: p.id,
          title: p.title,
          person: `${p.consultant.firstName} ${p.consultant.lastName}`,
          chargeRate: p.chargeRate,
          status: p.status,
        }))}
      />

      <InvoicesPanel
        invoices={client.invoices.map((inv) => ({
          id: inv.id,
          number: inv.number,
          issueDate: inv.issueDate.toISOString(),
          total: inv.total,
          status: inv.status,
        }))}
      />

      <ActivityFeed
        entityType="client"
        entityId={client.id}
        path={`/klanten/${client.id}`}
        activities={activities}
      />
    </div>
  );
}
