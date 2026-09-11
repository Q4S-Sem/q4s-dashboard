import Link from "next/link";
import { notFound } from "next/navigation";
import { Building2, Plus, Phone, Mail, MapPin, ExternalLink, Users2 } from "lucide-react";
import { db } from "@/lib/db";
import { BackLink } from "@/components/back-link";
import { PageHeader } from "@/components/ui/page-header";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";

export const metadata = { title: "Bedrijf · contacten" };
export const dynamic = "force-dynamic";

export default async function CompanyContactsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const client = await db.client.findUnique({
    where: { id },
    select: { id: true, companyName: true, city: true },
  });
  if (!client) notFound();

  const contacts = await db.crmContact.findMany({
    where: { clientId: id },
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      phone: true,
      email: true,
    },
  });

  const addHref = `/crm/contacten/nieuw?clientId=${client.id}&company=${encodeURIComponent(client.companyName)}`;

  return (
    <div className="space-y-6">
      <BackLink href="/crm/contacten">Terug naar contacten</BackLink>

      <PageHeader
        title={client.companyName}
        description={
          client.city ? `Contactpersonen bij ${client.companyName} in ${client.city}.` : `Contactpersonen bij ${client.companyName}.`
        }
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/opdrachtgevers/${client.id}`} className={buttonVariants({ variant: "outline" })}>
              <ExternalLink className="h-4 w-4" /> Bedrijfspagina
            </Link>
            <Link href={addHref} className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Contactpersoon toevoegen
            </Link>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-4 text-sm text-ink-500">
        <span className="inline-flex items-center gap-1.5">
          <Building2 className="h-4 w-4 text-ink-400" /> {client.companyName}
        </span>
        {client.city && (
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-ink-400" /> {client.city}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <Users2 className="h-4 w-4 text-ink-400" /> {contacts.length}{" "}
          {contacts.length === 1 ? "contactpersoon" : "contactpersonen"}
        </span>
      </div>

      {contacts.length === 0 ? (
        <EmptyState
          icon={<Users2 className="h-6 w-6" />}
          title="Nog geen contactpersonen"
          description={`Voeg de mensen toe met wie je bij ${client.companyName} contact hebt — inkopers, hiring managers, leidinggevenden.`}
          action={
            <Link href={addHref} className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Contactpersoon toevoegen
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {contacts.map((c) => {
            const name = `${c.firstName} ${c.lastName ?? ""}`.trim();
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand-50 text-base font-semibold text-brand-700">
                    {name.slice(0, 1).toUpperCase()}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/crm/contacten/${c.id}`}
                      className="block text-base font-semibold text-ink-900 hover:text-brand-700"
                    >
                      {name}
                    </Link>
                    {c.jobTitle && <p className="text-sm text-ink-500">{c.jobTitle}</p>}

                    <div className="mt-3 space-y-1.5">
                      {c.phone ? (
                        <a
                          href={`tel:${c.phone.replace(/[^\d+]/g, "")}`}
                          className="inline-flex items-center gap-2 text-sm text-ink-700 hover:text-emerald-700"
                        >
                          <Phone className="h-4 w-4 text-emerald-600" />
                          <span className="tabular-nums">{c.phone}</span>
                        </a>
                      ) : (
                        <p className="inline-flex items-center gap-2 text-sm text-ink-300">
                          <Phone className="h-4 w-4" /> Geen telefoonnummer
                        </p>
                      )}
                      {c.email ? (
                        <a
                          href={`mailto:${c.email}`}
                          className="flex items-center gap-2 text-sm text-ink-700 hover:text-blue-700"
                        >
                          <Mail className="h-4 w-4 shrink-0 text-blue-600" />
                          <span className="truncate">{c.email}</span>
                        </a>
                      ) : (
                        <p className="inline-flex items-center gap-2 text-sm text-ink-300">
                          <Mail className="h-4 w-4" /> Geen e-mailadres
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}

          <Link
            href={addHref}
            className="flex min-h-[7rem] items-center justify-center gap-2 rounded-xl border border-dashed border-ink-300 bg-white p-4 text-sm font-medium text-ink-600 transition-colors hover:border-brand-400 hover:text-brand-700"
          >
            <Plus className="h-5 w-5" /> Contactpersoon toevoegen
          </Link>
        </div>
      )}
    </div>
  );
}
