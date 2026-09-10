import Link from "next/link";
import { Users2, Plus, Building2, MessageSquare, HardHat } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ContactsTable } from "./ContactsTable";

export const metadata = { title: "Contacten" };
export const dynamic = "force-dynamic";

export default async function ContactenPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const sp = await searchParams;
  const view = sp.type === "freelancers" ? "freelancers" : "klanten";

  // Segmented toggle bovenaan: schakel tussen klantcontacten en freelancers.
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
        href="/crm/contacten?type=freelancers"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          view === "freelancers" ? "bg-brand-600 text-white shadow-sm" : "text-ink-600 hover:bg-ink-50",
        )}
      >
        <HardHat className="h-4 w-4" /> Freelancers
      </Link>
    </div>
  );

  if (view === "freelancers") {
    const freelancers = await db.consultant.findMany({
      where: { active: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        discipline: true,
        companyName: true,
        city: true,
      },
    });

    return (
      <div className="space-y-6">
        <PageHeader
          title="Contacten"
          description="Schakel tussen je klantcontacten en de freelancers (ZZP'ers) die je plaatst."
          actions={
            <Link href="/werknemers/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe freelancer
            </Link>
          }
        />
        {toggle}
        {freelancers.length === 0 ? (
          <EmptyState
            icon={<HardHat className="h-6 w-6" />}
            title="Nog geen freelancers"
            description="Voeg de ZZP'ers toe die je plaatst, zodat je hun contactgegevens bij de hand hebt."
            action={
              <Link href="/werknemers/nieuw" className={buttonVariants()}>
                <Plus className="h-4 w-4" /> Nieuwe freelancer
              </Link>
            }
          />
        ) : (
          <ContactsTable
            variant="freelancers"
            contacts={freelancers.map((f) => ({
              id: f.id,
              name: `${f.firstName} ${f.lastName ?? ""}`.trim(),
              jobTitle: f.discipline,
              company: f.companyName ?? f.city,
              ownerName: null,
              phone: f.phone,
              email: f.email,
              deals: 0,
              notes: 0,
            }))}
          />
        )}
      </div>
    );
  }

  const contacts = await db.crmContact.findMany({
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    include: {
      owner: { select: { name: true } },
      _count: { select: { crmNotes: true, deals: true } },
    },
  });

  const companies = new Set(contacts.map((c) => (c.company ?? "").trim().toLowerCase()).filter(Boolean));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Contacten"
        description="De mensen achter de opdrachtgevers — inkopers, hiring managers, leidinggevenden. Elk contact heeft z'n eigen notitieblok."
        actions={
          <Link href="/crm/contacten/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuw contact
          </Link>
        }
      />

      {toggle}

      {contacts.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard label="Contacten" value={contacts.length} icon={<Users2 className="h-5 w-5" />} accent="brand" />
          <StatCard label="Bedrijven" value={companies.size} icon={<Building2 className="h-5 w-5" />} accent="violet" />
          <StatCard
            label="Vastgelegde momenten"
            value={contacts.reduce((s, c) => s + c._count.crmNotes, 0)}
            icon={<MessageSquare className="h-5 w-5" />}
            accent="green"
          />
        </div>
      )}

      {contacts.length === 0 ? (
        <EmptyState
          icon={<Users2 className="h-6 w-6" />}
          title="Nog geen contacten"
          description="Voeg de contactpersonen toe bij je opdrachtgevers, zodat je elk gesprek kunt vastleggen."
          action={
            <Link href="/crm/contacten/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuw contact
            </Link>
          }
        />
      ) : (
        <ContactsTable
          contacts={contacts.map((c) => ({
            id: c.id,
            name: `${c.firstName} ${c.lastName ?? ""}`.trim(),
            jobTitle: c.jobTitle,
            company: c.company,
            ownerName: c.owner?.name ?? null,
            phone: c.phone,
            email: c.email,
            deals: c._count.deals,
            notes: c._count.crmNotes,
          }))}
        />
      )}
    </div>
  );
}
