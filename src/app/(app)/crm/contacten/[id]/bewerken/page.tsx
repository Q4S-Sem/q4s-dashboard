import Link from "next/link";
import { BackLink } from "@/components/back-link";
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
      <BackLink href={`/crm/contacten/${contact.id}`}>
        Terug naar contact
      </BackLink>
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
