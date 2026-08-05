import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EventForm } from "../EventForm";
import { createEvent } from "../actions";

export const metadata = { title: "Nieuwe afspraak" };

async function loadOptions() {
  const [clients, targets, candidates, vacancies, employees] = await Promise.all([
    db.client.findMany({ orderBy: { companyName: "asc" }, select: { id: true, companyName: true } }),
    db.targetClient.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    db.candidate.findMany({
      orderBy: [{ lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    db.vacancy.findMany({ orderBy: { createdAt: "desc" }, select: { id: true, title: true }, take: 100 }),
    db.employee.findMany({
      where: { active: true },
      orderBy: [{ firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);
  return {
    clients: clients.map((c) => ({ id: c.id, label: c.companyName })),
    targets: targets.map((t) => ({ id: t.id, label: t.name })),
    candidates: candidates.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName}` })),
    vacancies: vacancies.map((v) => ({ id: v.id, label: v.title })),
    people: employees.map((e) => ({ id: e.id, label: `${e.firstName} ${e.lastName}` })),
  };
}

export default async function NieuweAfspraakPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  const { clients, targets, candidates, vacancies, people } = await loadOptions();
  const defaultStart =
    date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? `${date}T09:00` : undefined;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href="/agenda"
        className="inline-flex items-center gap-1.5 text-sm text-ink-500 hover:text-ink-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar agenda
      </Link>
      <PageHeader
        title="Nieuwe afspraak"
        description="Plan een afspraak, gesprek of herinnering — en koppel er een bedrijf of kandidaat aan."
      />
      <EventForm
        action={createEvent}
        clients={clients}
        targets={targets}
        candidates={candidates}
        vacancies={vacancies}
        people={people}
        submitLabel="Afspraak opslaan"
        cancelHref="/agenda"
        defaultStart={defaultStart}
      />
    </div>
  );
}
