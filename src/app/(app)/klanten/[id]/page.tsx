import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { buttonVariants } from "@/components/ui/button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { deleteClient } from "../actions";
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
