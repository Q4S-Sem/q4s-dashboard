import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { startOfISOWeek } from "@/lib/utils";
import { TimesheetForm } from "../TimesheetForm";
import { createTimesheet } from "../actions";

export const metadata = { title: "Nieuwe urenstaat" };

function toInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function NieuweUrenstaatPage({
  searchParams,
}: {
  searchParams: Promise<{ placement?: string }>;
}) {
  const { placement } = await searchParams;

  const placements = await db.placement.findMany({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
    include: { consultant: true, client: true },
  });

  const options = placements.map((p) => ({
    id: p.id,
    label: `${p.consultant.firstName} ${p.consultant.lastName} — ${p.client.companyName} · ${p.title}`,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/uren"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar urenregistratie
      </Link>
      <PageHeader
        title="Nieuwe urenstaat"
        description="Registreer de uren per dag voor een week."
      />

      {options.length === 0 ? (
        <EmptyState
          title="Geen actieve plaatsingen"
          description="Maak eerst een actieve plaatsing aan voordat je uren registreert."
          action={
            <Link href="/plaatsingen/nieuw" className={buttonVariants()}>
              Nieuwe plaatsing
            </Link>
          }
        />
      ) : (
        <TimesheetForm
          action={createTimesheet}
          placements={options}
          defaultPlacementId={placement}
          defaultWeek={toInput(startOfISOWeek(new Date()))}
          submitLabel="Urenstaat opslaan"
          cancelHref="/uren"
        />
      )}
    </div>
  );
}
