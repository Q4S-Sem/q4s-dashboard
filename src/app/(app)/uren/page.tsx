import Link from "next/link";
import {
  CalendarClock,
  Plus,
  AlertTriangle,
  Pencil,
  ClipboardCheck,
  ArrowRight,
} from "lucide-react";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn, round2, formatHours, formatWeekLabel } from "@/lib/utils";
import { TIMESHEET_STATUSES } from "@/lib/domain";
import { initialen } from "@/lib/weekverwerking";
import { parseWeekParam, weekParam, currentWeekMonday } from "@/lib/timesheets";
import { WeekBalk } from "@/components/week-balk";

export const metadata = { title: "Urenregistratie" };
export const dynamic = "force-dynamic";

const DAY_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

/** Eén dagcel in de mini-weekstrook op een persoonskaart. */
function DagCel({
  label,
  hours,
  weekend = false,
  overtime = false,
}: {
  label: string;
  hours: number;
  weekend?: boolean;
  overtime?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-sm py-1.5 text-center",
        weekend && "bg-ink-50",
        overtime && "bg-violet-50",
      )}
    >
      <div
        className={cn(
          "text-[10px] font-bold uppercase tracking-wide",
          overtime ? "text-violet-500" : "text-ink-400",
        )}
      >
        {label}
      </div>
      <div
        className={cn(
          "text-[13px] tabular-nums",
          overtime
            ? hours > 0
              ? "font-semibold text-violet-600"
              : "text-violet-300"
            : hours > 0
              ? "text-ink-800"
              : "text-ink-300",
        )}
      >
        {hours > 0 ? formatHours(hours) : "·"}
      </div>
    </div>
  );
}

export default async function UrenPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const monday = parseWeekParam(week);
  const wp = weekParam(monday);
  const currentWeek = weekParam(currentWeekMonday());
  const nextMonday = new Date(monday.getTime() + 7 * 86_400_000);
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  sunday.setHours(23, 59, 59, 999);

  const [timesheets, activePlacements, pending] = await Promise.all([
    db.timesheet.findMany({
      where: { weekStart: { gte: monday, lt: nextMonday } },
      orderBy: { createdAt: "desc" },
      include: {
        entries: true,
        placement: { include: { consultant: true, client: true } },
      },
    }),
    db.placement.findMany({
      where: { status: "ACTIVE" },
      include: {
        consultant: { select: { firstName: true, lastName: true } },
        client: { select: { companyName: true } },
      },
    }),
    db.timesheet.count({ where: { status: "SUBMITTED" } }),
  ]);

  // Uren per persoon, per dag (ma→zo).
  const rows = timesheets
    .map((t) => {
      const days = [0, 0, 0, 0, 0, 0, 0];
      for (const e of t.entries) {
        const idx = (new Date(e.date).getDay() + 6) % 7;
        days[idx] = round2(days[idx] + e.hours);
      }
      const regular = round2(t.entries.reduce((s, e) => s + e.hours, 0));
      const overtime = round2(t.overtimeHours ?? 0);
      return {
        id: t.id,
        consultant: `${t.placement.consultant.firstName} ${t.placement.consultant.lastName}`,
        client: t.placement.client?.companyName ?? "— geen bedrijf",
        days,
        overtime,
        // Totaal gewerkt = reguliere dag-uren + overuren.
        hours: round2(regular + overtime),
        status: t.status,
      };
    })
    .sort((a, b) => a.consultant.localeCompare(b.consultant, "nl"));

  // Wie wordt deze week verwacht (lopende plaatsing) vs wie leverde in.
  const submitted = new Set(timesheets.map((t) => t.placementId));
  const expected = activePlacements.filter(
    (p) => p.startDate <= sunday && (p.endDate == null || p.endDate >= monday),
  );
  const missing = expected
    .filter((p) => !submitted.has(p.id))
    .map((p) => ({
      id: p.id,
      name: `${p.consultant.firstName} ${p.consultant.lastName}`,
      client: p.client?.companyName ?? "— geen bedrijf",
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "nl"));
  const received = expected.length - missing.length;

  const totalHours = rows.reduce((s, r) => s + r.hours, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Urenregistratie"
        description="Urenstaten per week — blader met vorige/volgende week en zie per persoon de uren per dag (ma–zo) en wie nog moet inleveren."
        actions={
          <>
            <Link href="/inbox/status" className={buttonVariants({ variant: "outline" })}>
              <ClipboardCheck className="h-4 w-4" /> Timesheet-status
            </Link>
            <Link href="/uren/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe urenstaat
            </Link>
          </>
        }
      />

      {pending > 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {pending} urenstaat{pending === 1 ? "" : "en"} wacht{pending === 1 ? "" : "en"} op goedkeuring.
        </p>
      )}

      <WeekBalk basePath="/uren" week={wp} currentWeek={currentWeek} />

      {/* Weekkop met status — dezelfde balk als in Week verwerken. */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-ink-100 bg-ink-50/60 px-3 py-2">
        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
          <CalendarClock className="h-4 w-4 shrink-0 text-brand-600" />
          <span className="font-semibold text-ink-900">{formatWeekLabel(monday)}</span>
          <span className="text-ink-400">
            {rows.length} {rows.length === 1 ? "persoon" : "personen"}
            {totalHours > 0 ? ` · ${formatHours(totalHours)} u totaal` : ""}
          </span>
        </span>
        {expected.length > 0 && (
          <Badge color={missing.length === 0 ? "green" : "amber"}>
            {missing.length === 0
              ? `Compleet · ${received}/${expected.length}`
              : `${received}/${expected.length} ingediend · ${missing.length} ontbreekt`}
          </Badge>
        )}
      </div>

      {/* Ingeleverde urenstaten — één kaart per persoon (Week verwerken-stijl). */}
      {rows.length === 0 ? (
        <Card className="px-4 py-10 text-center text-sm text-ink-400">
          Geen urenstaten in deze week.
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {rows.map((r) => (
            <Card key={r.id} className="flex h-full flex-col overflow-hidden">
              <Link
                href={`/uren/${r.id}`}
                className="group flex items-center gap-3 border-b border-ink-100 p-3.5 transition-colors hover:bg-brand-50/60"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-brand-600 text-[13px] font-bold text-white">
                  {initialen(r.consultant)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold text-ink-900">{r.consultant}</span>
                  <span className="block truncate text-xs text-ink-400">{r.client}</span>
                </span>
                <StatusBadge options={TIMESHEET_STATUSES} value={r.status} />
              </Link>

              <div className="p-3.5">
                <div className="grid grid-cols-8 gap-1">
                  {DAY_LABELS.map((d, di) => (
                    <DagCel key={d} label={d} hours={r.days[di]} weekend={di >= 5} />
                  ))}
                  <DagCel label="OU" hours={r.overtime} overtime />
                </div>
              </div>

              <div className="mt-auto flex items-center justify-between gap-2 border-t border-ink-100 bg-ink-50/60 px-3.5 py-2">
                <span className="text-[11px] text-ink-400">Totaal deze week</span>
                <span className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold tabular-nums text-ink-900">
                    {formatHours(r.hours)} u
                  </span>
                  <Link
                    href={`/uren/${r.id}/bewerken`}
                    className="inline-flex rounded-sm p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-700"
                    title="Bewerken"
                    aria-label={`Urenstaat van ${r.consultant} bewerken`}
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                </span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Nog niet ontvangen — zelfde kaart-grid, met de plus-actie om in te voeren. */}
      {missing.length > 0 && (
        <div className="space-y-3 border-t border-ink-100 pt-5">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <h3 className="text-[11px] font-bold uppercase tracking-wide text-ink-400">
              Nog niet ontvangen
            </h3>
            <Badge color="amber">
              {missing.length} van {expected.length}
            </Badge>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {missing.map((m) => (
              <Link
                key={m.id}
                href={`/uren/nieuw?placement=${m.id}&week=${wp}`}
                title={`Urenstaat invoeren voor ${m.name} — plaatsing en week staan al ingevuld`}
                className="group"
              >
                <Card className="flex items-center gap-3 border-dashed p-3.5 transition-colors hover:border-brand-300 hover:bg-brand-50/40">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-ink-100 text-[13px] font-bold text-ink-500">
                    {initialen(m.name)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink-900">{m.name}</span>
                    <span className="block truncate text-xs text-ink-400">{m.client}</span>
                  </span>
                  <span className="flex items-center gap-1 text-xs font-semibold text-ink-400 group-hover:text-brand-600">
                    Invoeren <ArrowRight className="h-4 w-4" />
                  </span>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {rows.length === 0 && expected.length === 0 && (
        <EmptyState
          icon={<CalendarClock className="h-6 w-6" />}
          title="Niets in deze week"
          description="Er zijn deze week geen urenstaten of lopende plaatsingen. Blader naar een andere week of registreer uren."
          action={
            <Link href="/uren/nieuw" className={buttonVariants()}>
              <Plus className="h-4 w-4" /> Nieuwe urenstaat
            </Link>
          }
        />
      )}
    </div>
  );
}
