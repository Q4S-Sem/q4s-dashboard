import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ContactForm } from "../ContactForm";
import { createContact } from "../actions";
import { loadContactFormOptions } from "../options";

export const metadata = { title: "Nieuw contact" };
export const dynamic = "force-dynamic";

export default async function NewContactPage() {
  const opts = await loadContactFormOptions();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/crm/contacten" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Terug naar contacten
      </Link>
      <PageHeader title="Nieuw contact" description="Een contactpersoon bij een opdrachtgever of klant." />
      <ContactForm
        action={createContact}
        submitLabel="Contact aanmaken"
        cancelHref="/crm/contacten"
        currentRecruiterId={opts.currentId}
        recruiters={opts.recruiters}
        targets={opts.targets}
        clients={opts.clients}
      />
    </div>
  );
}
