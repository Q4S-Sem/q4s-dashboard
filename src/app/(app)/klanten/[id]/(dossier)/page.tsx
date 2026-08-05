import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Briefcase,
  Coins,
  TrendingUp,
  Users,
  Building2,
  ReceiptText,
  StickyNote,
  ExternalLink,
} from "lucide-react";
import { db } from "@/lib/db";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { buttonVariants } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { getClient } from "./data";
import { ContactsCard } from "./ContactsCard";

/** Eén label-waarde-regel in de gegevenskaarten. */
function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</dt>
      <dd className="mt-1 break-words text-sm text-slate-900">{value || "—"}</dd>
    </div>
  );
}

export default async function KlantOverzichtPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;

  const client = await getClient(id);
  if (!client) notFound();

  const [activePlacements, invoiced, outstanding] = await Promise.all([
    db.placement.count({ where: { clientId: id, status: "ACTIVE" } }),
    db.invoice.aggregate({
      _sum: { total: true },
      where: { clientId: id, status: { in: ["SENT", "PAID", "OVERDUE"] } },
    }),
    db.invoice.aggregate({
      _sum: { total: true },
      _count: true,
      where: { clientId: id, status: { in: ["SENT", "OVERDUE"] } },
    }),
  ]);

  const website = client.website
    ? client.website.startsWith("http")
      ? client.website
      : `https://${client.website}`
    : null;

  return (
    <div className="space-y-6">
      {error === "in-use" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Deze klant kan niet verwijderd worden zolang er plaatsingen of facturen aan gekoppeld zijn.
        </p>
      )}
      {error === "contact" && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          Vul minimaal een naam in voor de contactpersoon.
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Actieve plaatsingen"
          value={activePlacements}
          sub="lopend werk"
          icon={<Briefcase className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          label="Openstaand"
          value={formatCurrency(outstanding._sum.total ?? 0)}
          sub={`${outstanding._count} onbetaalde factu${outstanding._count === 1 ? "ur" : "ren"}`}
          icon={<Coins className="h-5 w-5" />}
          accent={(outstanding._sum.total ?? 0) > 0 ? "amber" : "slate"}
        />
        <StatCard
          label="Gefactureerd"
          value={formatCurrency(invoiced._sum.total ?? 0)}
          sub="totaal, incl. BTW"
          icon={<TrendingUp className="h-5 w-5" />}
          accent="brand"
        />
        <StatCard
          label="Contactpersonen"
          value={client.contacts.length}
          sub="HR, manager, planner…"
          icon={<Users className="h-5 w-5" />}
          accent="violet"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-slate-500" /> Bedrijfsgegevens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-5">
              <Detail label="Bedrijfsnaam" value={client.companyName} />
              <Detail
                label="Website"
                value={
                  website ? (
                    <a
                      href={website}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-brand-700 hover:underline"
                    >
                      {client.website} <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null
                }
              />
              <Detail label="KvK-nummer" value={client.kvkNumber} />
              <Detail label="BTW-nummer" value={client.vatNumber} />
              <Detail
                label="Adres"
                value={
                  [client.address, [client.postalCode, client.city].filter(Boolean).join(" ")]
                    .filter(Boolean)
                    .join(", ") || null
                }
              />
              <Detail label="Land" value={client.country} />
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5 text-slate-500" /> Hoofdcontact &amp; facturatie
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-5">
              <Detail label="Contactpersoon" value={client.contactName} />
              <Detail
                label="E-mail"
                value={
                  client.email ? (
                    <a href={`mailto:${client.email}`} className="text-brand-700 hover:underline">
                      {client.email}
                    </a>
                  ) : null
                }
              />
              <Detail
                label="Telefoon"
                value={
                  client.phone ? (
                    <a href={`tel:${client.phone}`} className="text-slate-900 hover:underline">
                      {client.phone}
                    </a>
                  ) : null
                }
              />
              <Detail
                label="Factuur-e-mail"
                value={
                  client.invoiceEmail ? (
                    <a href={`mailto:${client.invoiceEmail}`} className="text-brand-700 hover:underline">
                      {client.invoiceEmail}
                    </a>
                  ) : null
                }
              />
              <Detail label="Betaaltermijn" value={`${client.paymentTermDays} dagen`} />
              <Detail label="Openstaand" value={formatCurrency(outstanding._sum.total ?? 0)} />
            </dl>
          </CardContent>
        </Card>
      </div>

      <ContactsCard
        clientId={client.id}
        contacts={client.contacts.map((c) => ({
          id: c.id,
          name: c.name,
          role: c.role,
          email: c.email,
          phone: c.phone,
          notes: c.notes,
        }))}
      />

      {client.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-slate-500" /> Notitie
            </CardTitle>
            <Link
              href={`/klanten/${client.id}/notities`}
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              Naar notities
            </Link>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-slate-600">{client.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
