import Link from "next/link";
import { Users2, Plus, Building2, MessageSquare, HardHat } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ContactsTable } from "./ContactsTable";
import { CompaniesBrowser, type CompanyRow } from "./CompaniesBrowser";

export const metadata = { title: "Contacten" };
export const dynamic = "force-dynamic";

export default async function ContactenPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const sp = await searchParams;
  const view = sp.type === "werknemers" ? "werknemers" : "klanten";

  // Segmented toggle bovenaan: schakel tussen bedrijfscontacten en werknemers.
  const toggle = (
    <div className="inline-flex rounded-lg border border-ink-200 bg-white p-1 shadow-sm">
      <Link
        href="/crm/contacten"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          view === "klanten" ? "bg-brand-600 text-white shadow-sm" : "text-ink-600 hover:bg-ink-50",
        )}
      >
        <Building2 className="h-4 w-4" /> Klanten
      </Link>
      <Link
        href="/crm/contacten?type=werknemers"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          view === "werknemers" ? "bg-brand-600 text-white shadow-sm" : "text-ink-600 hover:bg-ink-50",
        )}
      >
        <HardHat className="h-4 w-4" /> Werknemers
      </Link>
    </div>
  );

  // ---- WERKNEMERS: gekoppeld aan de talentpool (Candidate) ----
  if (view === "werknemers") {
    const candidates = await db.candidate.findMany({
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        discipline: true,
        location: true,
        headline: true,
      },
    });

    return (
      <div className="space-y-6">
        <PageHeader
          title="Contacten"
          description="Schakel tussen je bedrijfscontacten en de werknemers uit de talentenpool. E-mail en telefoon komen rechtstreeks uit het kandidaatdossier."
          actions={
            <Link href="/kandidaten/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe werknemer
            </Link>
          }
        />
        {toggle}
        {candidates.length === 0 ? (
          <EmptyState
            icon={<HardHat className="h-6 w-6" />}
            title="Nog geen werknemers"
            description="Zodra er kandidaten in de talentenpool staan, verschijnen hun contactgegevens hier."
            action={
              <Link href="/kandidaten/nieuw" className={buttonVariants()}>
                <Plus className="h-4 w-4" /> Nieuwe werknemer
              </Link>
            }
          />
        ) : (
          <ContactsTable
            variant="werknemers"
            contacts={candidates.map((c) => ({
              id: c.id,
              name: `${c.firstName} ${c.lastName ?? ""}`.trim(),
              jobTitle: c.discipline,
              company: c.headline ?? c.location,
              ownerName: null,
              phone: c.phone,
              email: c.email,
              deals: 0,
              notes: 0,
            }))}
          />
        )}
      </div>
    );
  }

  // ---- KLANTEN: al onze bedrijven, met contactpersonen eronder ----
  const [clients, contacts] = await Promise.all([
    db.client.findMany({
      orderBy: { companyName: "asc" },
      select: { id: true, companyName: true, city: true },
    }),
    db.crmContact.findMany({
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        jobTitle: true,
        phone: true,
        email: true,
        clientId: true,
      },
    }),
  ]);

  const byClient = new Map<string, CompanyRow["contacts"]>();
  for (const c of contacts) {
    if (!c.clientId) continue;
    const row = {
      id: c.id,
      name: `${c.firstName} ${c.lastName ?? ""}`.trim(),
      jobTitle: c.jobTitle,
      phone: c.phone,
      email: c.email,
    };
    const arr = byClient.get(c.clientId);
    if (arr) arr.push(row);
    else byClient.set(c.clientId, [row]);
  }

  const companies: CompanyRow[] = clients.map((cl) => ({
    id: cl.id,
    name: cl.companyName,
    city: cl.city,
    contacts: byClient.get(cl.id) ?? [],
  }));

  const linkedContacts = contacts.filter((c) => c.clientId).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacten"
        description="Al onze bedrijven met hun contactpersonen — inkopers, hiring managers, leidinggevenden. Klik een bedrijf open en zet er de contactgegevens bij."
        actions={
          <Link href="/crm/contacten/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuw contact
          </Link>
        }
      />

      {toggle}

      {companies.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Bedrijven" value={companies.length} icon={<Building2 className="h-5 w-5" />} accent="violet" />
          <StatCard label="Contactpersonen" value={linkedContacts} icon={<Users2 className="h-5 w-5" />} accent="brand" />
          <StatCard
            label="Bedrijven met contact"
            value={companies.filter((c) => c.contacts.length > 0).length}
            icon={<MessageSquare className="h-5 w-5" />}
            accent="green"
          />
        </div>
      )}

      {companies.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-6 w-6" />}
          title="Nog geen bedrijven"
          description="Zodra er bedrijven in 'Onze bedrijven' staan, verschijnen ze hier om contactpersonen aan te koppelen."
        />
      ) : (
        <CompaniesBrowser companies={companies} />
      )}
    </div>
  );
}
