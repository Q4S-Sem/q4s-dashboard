import Link from "next/link";
import { ArrowDownCircle, ArrowUpCircle, BellRing, AlarmClock, Info } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { INVOICE_STATUSES, PURCHASE_INVOICE_STATUSES } from "@/lib/domain";
import { formatCurrency, formatDate } from "@/lib/utils";
import { paymentMonitor, type MonitorRow } from "@/lib/betaalmonitor";
import { sendInvoiceReminder, sendAllReminders } from "./actions";

export const metadata = { title: "Betaalmonitor" };

function Tile({
  label,
  value,
  sub,
  tone = "slate",
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: "slate" | "green" | "red" | "amber";
}) {
  const toneCls =
    tone === "red"
      ? "text-red-700"
      : tone === "green"
        ? "text-emerald-700"
        : tone === "amber"
          ? "text-amber-700"
          : "text-ink-900";
  return (
    <div className="rounded-xl border border-ink-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-ink-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${toneCls}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-ink-500">{sub}</p>}
    </div>
  );
}

function OverdueTable({
  rows,
  kind,
}: {
  rows: MonitorRow[];
  kind: "incoming" | "outgoing";
}) {
  const options = kind === "incoming" ? INVOICE_STATUSES : PURCHASE_INVOICE_STATUSES;
  const detailBase = kind === "incoming" ? "/facturen" : "/inkoopfacturen";
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-ink-200 text-left text-xs font-semibold uppercase tracking-wide text-ink-500">
            <th className="py-2 pr-2">Factuur</th>
            <th className="py-2 px-2">{kind === "incoming" ? "Klant" : "Werknemer"}</th>
            <th className="py-2 px-2">Vervaldatum</th>
            <th className="py-2 px-2 text-right">Te laat</th>
            <th className="py-2 px-2 text-right">Bedrag</th>
            {kind === "incoming" && <th className="py-2 pl-2 text-right">Herinnering</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-100">
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="py-2.5 pr-2">
                <Link href={`${detailBase}/${r.id}`} className="font-medium text-ink-900 hover:underline">
                  {r.number}
                </Link>
              </td>
              <td className="py-2.5 px-2 text-ink-700">{r.partyName}</td>
              <td className="py-2.5 px-2 text-ink-600">{formatDate(r.dueDate)}</td>
              <td className="py-2.5 px-2 text-right">
                <span className="font-semibold text-red-600 tabular-nums">{r.daysOverdue} d</span>
              </td>
              <td className="py-2.5 px-2 text-right tabular-nums">{formatCurrency(r.total)}</td>
              {kind === "incoming" && (
                <td className="py-2.5 pl-2 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {r.reminderCount > 0 && (
                      <span className="text-xs text-ink-400">
                        {r.reminderCount}× · {r.reminderSentAt ? formatDate(r.reminderSentAt) : "—"}
                      </span>
                    )}
                    <form action={sendInvoiceReminder}>
                      <input type="hidden" name="id" value={r.id} />
                      <Button type="submit" variant="outline" size="sm">
                        <BellRing className="h-3.5 w-3.5" /> Herinner
                      </Button>
                    </form>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function BetaalmonitorPage({
  searchParams,
}: {
  searchParams: Promise<{ herinnerd?: string; fout?: string }>;
}) {
  const { herinnerd, fout } = await searchParams;
  const mon = await paymentMonitor();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Betaalmonitor"
        description="Openstaande betalingen in- én uitgaand, met te-laat-signalering en automatische herinneringen."
        actions={
          mon.remindable.length > 0 ? (
            <form action={sendAllReminders}>
              <Button type="submit">
                <AlarmClock className="h-4 w-4" /> Stuur alle herinneringen ({mon.remindable.length})
              </Button>
            </form>
          ) : null
        }
      />

      {herinnerd && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {herinnerd === "0"
            ? "Geen herinneringen verstuurd (niets voldeed aan de drempel of geen e-mailadres)."
            : `${herinnerd} herinnering(en) verstuurd.`}
        </p>
      )}
      {fout && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Herinnering niet verstuurd: {fout}</p>
      )}

      {/* Kerncijfers */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          label="Te ontvangen (open)"
          value={formatCurrency(mon.incoming.openTotal)}
          sub={`${mon.incoming.openCount} facturen`}
          tone="green"
        />
        <Tile
          label="Waarvan te laat"
          value={formatCurrency(mon.incoming.overdueTotal)}
          sub={`${mon.incoming.overdueCount} facturen`}
          tone={mon.incoming.overdueCount > 0 ? "red" : "slate"}
        />
        <Tile
          label="Te betalen (open)"
          value={formatCurrency(mon.outgoing.openTotal)}
          sub={`${mon.outgoing.openCount} inkoopfacturen`}
          tone="amber"
        />
        <Tile
          label="Waarvan te laat"
          value={formatCurrency(mon.outgoing.overdueTotal)}
          sub={`${mon.outgoing.overdueCount} inkoopfacturen`}
          tone={mon.outgoing.overdueCount > 0 ? "red" : "slate"}
        />
      </div>

      {/* Inkomend — te laat */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <ArrowDownCircle className="h-5 w-5 text-emerald-600" />
            <h2 className="text-base font-semibold text-ink-900">Te ontvangen — te laat</h2>
            <span className="text-sm text-ink-400">
              (herinnering vanaf {mon.reminderThresholdDays} dagen te laat)
            </span>
          </div>
          {mon.incoming.overdue.length === 0 ? (
            <p className="py-4 text-sm text-ink-500">Geen te late klantbetalingen. 🎉</p>
          ) : (
            <OverdueTable rows={mon.incoming.overdue} kind="incoming" />
          )}
        </CardContent>
      </Card>

      {/* Uitgaand — te laat */}
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2">
            <ArrowUpCircle className="h-5 w-5 text-amber-600" />
            <h2 className="text-base font-semibold text-ink-900">Te betalen — te laat</h2>
            <Link href="/betalingen" className={buttonVariants({ variant: "outline", size: "sm" })}>
              Naar betalingen (SEPA)
            </Link>
          </div>
          {mon.outgoing.overdue.length === 0 ? (
            <p className="py-4 text-sm text-ink-500">Geen achterstallige ZZP-betalingen.</p>
          ) : (
            <OverdueTable rows={mon.outgoing.overdue} kind="outgoing" />
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 rounded-lg border border-ink-200 bg-ink-50 px-4 py-3 text-sm text-ink-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
        <p>
          Herinneringen lopen op in toon: 1e = herinnering, 2e = tweede herinnering, 3e+ = aanmaning. Een factuur wordt
          niet vaker dan eens per week opnieuw aangeschreven. De drempel ({mon.reminderThresholdDays} dagen) is instelbaar
          via <code className="rounded bg-ink-100 px-1">REMINDER_THRESHOLD_DAYS</code>.
        </p>
      </div>
    </div>
  );
}
