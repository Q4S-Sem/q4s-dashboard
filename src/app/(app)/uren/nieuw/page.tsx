import Link from "next/link";
import { BackLink } from "@/components/back-link";
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
  searchParams: Promise<{ placement?: string; week?: string }>;
}) {
  const { placement, week } = await searchParams;

  // Vanuit "Nog niet ontvangen" komen plaatsing én week mee, zodat het
  // formulier meteen op de juiste persoon en week staat.
  const weekParam = week && !Number.isNaN(new Date(`${week}T00:00:00`).getTime())
    ? toInput(startOfISOWeek(new Date(`${week}T00:00:00`)))
    : null;

  const placements = await db.placement.findMany({
    where: { status: "ACTIVE" },
    orderBy: { startDate: "desc" },
    include: { consultant: true, client: true },
  });

  const options = placements.map((p) => ({
    id: p.id,
    label: `${p.consultant.firstName} ${p.consultant.lastName} — ${p.client?.companyName ?? "— geen bedrijf"} · ${p.title}`,
  }));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <BackLink href="/uren">
        Terug naar urenregistratie
      </BackLink>
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
          defaultWeek={weekParam ?? toInput(startOfISOWeek(new Date()))}
          submitLabel="Urenstaat opslaan"
          cancelHref="/uren"
        />
      )}
    </div>
  );
}
