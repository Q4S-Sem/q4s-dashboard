import Link from "next/link";
import { BackLink } from "@/components/back-link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ConsultantForm } from "../ConsultantForm";
import { createConsultant } from "../actions";

export const metadata = { title: "Nieuwe werknemer" };

export default function NieuweWerknemerPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <BackLink href="/werknemers">
        Terug naar werknemers
      </BackLink>
      <PageHeader title="Nieuwe werknemer" description="Voeg een nieuwe specialist toe." />
      <ConsultantForm
        action={createConsultant}
        submitLabel="Werknemer opslaan"
        cancelHref="/werknemers"
      />
    </div>
  );
}
