import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { formatWeekLabel } from "@/lib/utils";
import { TimesheetForm } from "../../TimesheetForm";
import { updateTimesheet } from "../../actions";

export const metadata = { title: "Weekstaat bewerken" };
export const dynamic = "force-dynamic"; // always show the current entries (incl. per-day km)

function toInput(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default async function UrenstaatBewerkenPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ts = await db.timesheet.findUnique({
    where: { id },
    include: {
      entries: { orderBy: { date: "asc" } },
      placement: { include: { consultant: true, client: true } },
    },
  });

  if (!ts) notFound();

  // Uren mogen ALTIJD handmatig aangepast worden — ook na goedkeuren/factureren.
  const locked = ts.status === "APPROVED" || ts.status === "INVOICED";
  const { placement } = ts;
  const placementLabel = `${placement.consultant.firstName} ${placement.consultant.lastName} — ${placement.client.companyName} · ${placement.title}`;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href={`/uren/${ts.id}`}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" /> Terug naar urenstaat
      </Link>
      <PageHeader title="Weekstaat bewerken" description={formatWeekLabel(ts.weekStart)} />
      {locked && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Deze urenstaat is al {ts.status === "INVOICED" ? "gefactureerd" : "goedgekeurd"}. Je kunt de uren en
          kilometers nog aanpassen, maar een reeds aangemaakte factuur verandert daar niet automatisch door — pas
          die zo nodig zelf aan.
        </p>
      )}
      <TimesheetForm
        action={updateTimesheet}
        timesheetId={ts.id}
        placementLabel={placementLabel}
        defaultWeek={toInput(ts.weekStart)}
        defaultOvertime={ts.overtimeHours != null ? String(ts.overtimeHours) : ""}
        entries={ts.entries.map((e) => ({
          date: toInput(e.date),
          hours: e.hours,
          note: e.description ?? "",
          km: e.kilometers ?? undefined,
        }))}
        submitLabel="Wijzigingen opslaan"
        cancelHref={`/uren/${ts.id}`}
      />
    </div>
  );
}
