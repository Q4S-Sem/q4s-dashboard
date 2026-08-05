import Link from "next/link";
import { Users2, Plus, Building2, MessageSquare, ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard } from "@/components/ui/stat-card";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { ContactsTable } from "./ContactsTable";

export const metadata = { title: "Contacten" };
export const dynamic = "force-dynamic";

export default async function ContactenPage() {
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
      <Link href="/crm" className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900">
        <ArrowLeft className="h-4 w-4" /> Terug naar CRM
      </Link>

      <PageHeader
        title="Contacten"
        description="De mensen achter de opdrachtgevers — inkopers, hiring managers, leidinggevenden. Elk contact heeft z'n eigen notitieblok."
        actions={
          <Link href="/crm/contacten/nieuw" className={buttonVariants()}>
            <Plus className="h-4 w-4" /> Nieuw contact
          </Link>
        }
      />

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
            deals: c._count.deals,
            notes: c._count.crmNotes,
          }))}
        />
      )}
    </div>
  );
}
