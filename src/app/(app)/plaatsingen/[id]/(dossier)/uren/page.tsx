import Link from "next/link";
import { notFound } from "next/navigation";
import { Clock, CalendarDays, Receipt, Hourglass } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/ui/stat-card";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { StatusBadge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { TIMESHEET_STATUSES } from "@/lib/domain";
import { formatDate, formatHours, round2 } from "@/lib/utils";
import { getPlacement, getTimesheets, totalHours } from "../data";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const placement = await getPlacement(id);
  return { title: `Uren · ${placement?.title ?? "Plaatsing"}` };
}

export default async function PlaatsingUrenPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [placement, timesheets] = await Promise.all([getPlacement(id), getTimesheets(id)]);
  if (!placement) notFound();

  const hoursOf = (ts: (typeof timesheets)[number]) =>
    ts.entries.reduce((sum, e) => sum + e.hours, 0);
  const hours = totalHours(timesheets);
  const invoiced = round2(
    timesheets.filter((ts) => ts.status === "INVOICED").reduce((s, ts) => s + hoursOf(ts), 0),
  );
  const open = round2(hours - invoiced);

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Totaal uren"
          value={formatHours(hours)}
          sub="alle urenstaten"
          icon={<Clock className="h-5 w-5" />}
          accent="brand"
        />
        <StatCard
          label="Urenstaten"
          value={timesheets.length}
          sub={timesheets[0] ? `laatste week ${formatDate(timesheets[0].weekStart)}` : "nog geen weken"}
          icon={<CalendarDays className="h-5 w-5" />}
          accent="slate"
        />
        <StatCard
          label="Gefactureerd"
          value={formatHours(invoiced)}
          sub="uren die op een factuur staan"
          icon={<Receipt className="h-5 w-5" />}
          accent="green"
        />
        <StatCard
          label="Nog te factureren"
          value={formatHours(open)}
          sub="concept, ingediend of goedgekeurd"
          icon={<Hourglass className="h-5 w-5" />}
          accent={open > 0 ? "amber" : "slate"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Urenstaten</CardTitle>
          <Link
            href={`/uren/nieuw?placement=${placement.id}`}
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <Clock className="h-4 w-4" /> Uren registreren
          </Link>
        </CardHeader>
        {timesheets.length === 0 ? (
          <CardContent className="text-sm text-slate-500">
            Nog geen urenstaten voor deze plaatsing.
          </CardContent>
        ) : (
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH>Week</TH>
                <TH className="text-right">Uren</TH>
                <TH>Status</TH>
              </TR>
            </THead>
            <TBody>
              {timesheets.map((ts) => (
                <TR key={ts.id}>
                  <TD>
                    <Link href={`/uren/${ts.id}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {formatDate(ts.weekStart)}
                    </Link>
                  </TD>
                  <TD className="text-right tabular-nums">{formatHours(hoursOf(ts))}</TD>
                  <TD>
                    <StatusBadge options={TIMESHEET_STATUSES} value={ts.status} />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
