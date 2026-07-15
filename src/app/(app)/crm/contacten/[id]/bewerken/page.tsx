import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { ContactForm } from "../../ContactForm";
import { updateContact } from "../../actions";
import { loadContactFormOptions } from "../../options";

export const metadata = { title: "Contact bewerken" };
export const dynamic = "force-dynamic";

export default async function EditContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [contact, opts] = await Promise.all([db.crmContact.findUnique({ where: { id } }), loadContactFormOptions()]);
  if (!contact) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/crm/contacten/${contact.id}`} className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Terug naar contact
      </Link>
      <PageHeader title="Contact bewerken" description={`${contact.firstName} ${contact.lastName ?? ""}`} />
      <ContactForm
        action={updateContact}
        contact={contact}
        submitLabel="Wijzigingen opslaan"
        cancelHref={`/crm/contacten/${contact.id}`}
        currentRecruiterId={opts.currentId}
        recruiters={opts.recruiters}
        targets={opts.targets}
        clients={opts.clients}
      />
    </div>
  );
}
