import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EventForm } from "../../EventForm";
import { updateEvent } from "../../actions";

export const metadata = { title: "Afspraak bewerken" };

export default async function AfspraakBewerkenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const event = await db.calendarEvent.findUnique({ where: { id } });
  if (!event) notFound();

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

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link
        href={`/agenda/${event.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar afspraak
      </Link>
      <PageHeader title="Afspraak bewerken" />
      <EventForm
        action={updateEvent}
        event={event}
        clients={clients.map((c) => ({ id: c.id, label: c.companyName }))}
        targets={targets.map((t) => ({ id: t.id, label: t.name }))}
        candidates={candidates.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName}` }))}
        vacancies={vacancies.map((v) => ({ id: v.id, label: v.title }))}
        people={employees.map((e) => ({ id: e.id, label: `${e.firstName} ${e.lastName}` }))}
        submitLabel="Wijzigingen opslaan"
        cancelHref={`/agenda/${event.id}`}
      />
    </div>
  );
}
