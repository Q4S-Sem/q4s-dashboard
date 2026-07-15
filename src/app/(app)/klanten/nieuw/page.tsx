import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { ClientForm } from "../ClientForm";
import { createClient } from "../actions";

export const metadata = { title: "Nieuwe klant" };

export default function NieuweKlantPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/klanten"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar klanten
      </Link>
      <PageHeader title="Nieuwe klant" description="Voeg een nieuwe klant toe." />
      <ClientForm action={createClient} submitLabel="Klant opslaan" cancelHref="/klanten" />
    </div>
  );
}
