import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ConsultantForm } from "../ConsultantForm";
import { createConsultant } from "../actions";

export const metadata = { title: "Nieuwe werknemer" };

export default function NieuweWerknemerPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/werknemers"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar werknemers
      </Link>
      <PageHeader title="Nieuwe werknemer" description="Voeg een nieuwe specialist toe." />
      <ConsultantForm
        action={createConsultant}
        submitLabel="Werknemer opslaan"
        cancelHref="/werknemers"
      />
    </div>
  );
}
