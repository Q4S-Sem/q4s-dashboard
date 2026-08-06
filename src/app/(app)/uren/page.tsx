import Link from "next/link";
import {
  CalendarClock,
  Plus,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  Pencil,
  ClipboardCheck,
} from "lucide-react";
import { db } from "@/lib/db";
import { Avatar } from "@/components/ui/avatar";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { cn, round2, formatHours, formatWeekLabel, formatDate } from "@/lib/utils";
import { TIMESHEET_STATUSES } from "@/lib/domain";
import { parseWeekParam, weekParam, currentWeekMonday } from "@/lib/timesheets";
import { WeekPicker } from "@/components/week-picker";

export const metadata = { title: "Urenregistratie" };
export const dynamic = "force-dynamic";

const DAY_LABELS = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];
const dayFmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short" });
const dayYearFmt = new Intl.DateTimeFormat("nl-NL", { day: "numeric", month: "short", year: "numeric" });

function shiftWeek(monday: Date, deltaWeeks: number): string {
  const d = new Date(monday);
  d.setDate(d.getDate() + deltaWeeks * 7);
  return weekParam(d);
}
/** YYYY-MM-DD in de lokale tijdzone, voor de ?week= parameter. */
function toDateParam(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export default async function UrenPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week } = await searchParams;
  const monday = parseWeekParam(week);
  const wp = weekParam(monday);
  const nextMonday = new Date(monday.getTime() + 7 * 86_400_000);
  const sunday = new Date(monday.getTime() + 6 * 86_400_000);
  sunday.setHours(23, 59, 59, 999);
  const isCurrentWeek = weekParam(currentWeekMonday()) === wp;

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
    }));
  const received = expected.length - missing.length;

  const totalHours = rows.reduce((s, r) => s + r.hours, 0);
  const overtimeTotal = round2(rows.reduce((s, r) => s + r.overtime, 0));
  const dayTotals = [0, 0, 0, 0, 0, 0, 0];
  for (const r of rows) r.days.forEach((h, di) => (dayTotals[di] += h));

  const weekRange = `${dayFmt.format(monday)} – ${dayYearFmt.format(new Date(monday.getTime() + 6 * 86_400_000))}`;

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

      {/* Week-navigator — het week-label is een klikbare kalender */}
      <div className="flex items-center justify-between gap-2">
        <Link href={`/uren?week=${shiftWeek(monday, -1)}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          <ChevronLeft className="h-4 w-4" /> Vorige week
        </Link>
        <div className="flex flex-col items-center">
          <WeekPicker value={wp} basePath="/uren" className="w-72" />
          <p className="mt-1 text-xs text-ink-400">
            maandag t/m zondag · {weekRange}
            {isCurrentWeek ? " · huidige week" : ""}
          </p>
        </div>
        <Link href={`/uren?week=${shiftWeek(monday, 1)}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
          Volgende week <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="overflow-hidden rounded-xl border border-ink-200 bg-white shadow-sm">
        {/* Kop met week-status */}
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 px-4 py-3">
          <div className="flex-1">
            <div className="text-sm font-semibold text-ink-900">{formatWeekLabel(monday)}</div>
            <div className="text-xs text-ink-500">
              {rows.length} {rows.length === 1 ? "persoon" : "personen"}
              {totalHours > 0 ? ` · ${formatHours(totalHours)} u totaal` : ""}
            </div>
          </div>
          {expected.length > 0 && (
            <span
              className={cn(
                "shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                missing.length === 0 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700",
              )}
            >
              {missing.length === 0
                ? `Compleet · ${received}/${expected.length}`
                : `${received}/${expected.length} ingediend · ${missing.length} ontbreekt`}
            </span>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-ink-400">
            Geen urenstaten in deze week.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-400">
                  <th className="px-4 py-2 font-medium">Werknemer</th>
                  <th className="px-4 py-2 font-medium">Klant</th>
                  {DAY_LABELS.map((d, di) => (
                    <th key={d} className={cn("px-2 py-2 text-center font-medium", di >= 5 && "bg-ink-50 text-ink-400")}>
                      {d}
                    </th>
                  ))}
                  <th className="px-2 py-2 text-center font-medium text-violet-500" title="Overuren">OU</th>
                  <th className="px-3 py-2 text-right font-medium">Totaal</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-2 py-2">
                    <span className="sr-only">Acties</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-ink-50 hover:bg-ink-50">
                    <td className="whitespace-nowrap px-4 py-2.5">
                      <Link href={`/uren/${r.id}`} className="font-medium text-ink-900 hover:text-brand-700">
                        {r.consultant}
                      </Link>
                    </td>
                    <td className="whitespace-nowrap px-4 py-2.5 text-ink-600">{r.client}</td>
                    {r.days.map((h, di) => (
                      <td
                        key={di}
                        className={cn(
                          "px-2 py-2.5 text-center tabular-nums",
                          di >= 5 && "bg-ink-50/70",
                          h > 0 ? "text-ink-700" : "text-ink-300",
                        )}
                      >
                        {h > 0 ? formatHours(h) : "·"}
                      </td>
                    ))}
                    <td className={cn("px-2 py-2.5 text-center tabular-nums", r.overtime > 0 ? "font-medium text-violet-600" : "text-ink-300")}>
                      {r.overtime > 0 ? formatHours(r.overtime) : "·"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-ink-900">
                      {formatHours(r.hours)}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge options={TIMESHEET_STATUSES} value={r.status} />
                    </td>
                    <td className="px-2 py-2.5 text-right">
                      <Link
                        href={`/uren/${r.id}/bewerken`}
                        className="inline-flex rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-brand-700"
                        title="Bewerken"
                        aria-label={`Urenstaat van ${r.consultant} bewerken`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-ink-200 bg-ink-50/70 text-xs font-semibold text-ink-600">
                  <td className="px-4 py-2" colSpan={2}>
                    Totaal week
                  </td>
                  {dayTotals.map((h, di) => (
                    <td key={di} className={cn("px-2 py-2 text-center tabular-nums", di >= 5 && "bg-ink-100/60")}>
                      {h > 0 ? formatHours(h) : "·"}
                    </td>
                  ))}
                  <td className={cn("px-2 py-2 text-center tabular-nums", overtimeTotal > 0 ? "text-violet-600" : "text-ink-300")}>
                    {overtimeTotal > 0 ? formatHours(overtimeTotal) : "·"}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-ink-900">{formatHours(totalHours)}</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Nog niet ontvangen */}
        {missing.length > 0 && (
          <div className="border-t border-amber-100 bg-amber-50/50 px-4 py-4">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span className="text-sm font-semibold text-amber-900">Nog niet ontvangen</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700">
                {missing.length} van {expected.length}
              </span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {missing.map((m, mi) => (
                <Link
                  key={m.id}
                  href={`/uren/nieuw?placement=${m.id}&week=${toDateParam(monday)}`}
                  title={`Urenstaat invoeren voor ${m.name} — plaatsing en week staan al ingevuld`}
                  className="group flex items-center gap-3 rounded-xl border border-amber-200 bg-white px-3 py-2.5 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
                >
                  <Avatar name={m.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-ink-900">{m.name}</span>
                    <span className="block truncate text-xs text-ink-500">{m.client}</span>
                  </span>
                  <Plus className="h-4 w-4 shrink-0 text-ink-300 transition-colors group-hover:text-brand-600" />
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

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
