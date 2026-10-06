import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { PersoonVierkant } from "@/components/ui/persoon-vierkant";
import { getWeekOverview } from "@/lib/facturatie-week";
import { watMist } from "@/lib/facturatie-volgende";
import { INVOICE_STATUSES, RECEIVED_INVOICE_STATUSES } from "@/lib/domain";
import { cn, formatCurrency, formatHours, round2 } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PER PERSOON — dezelfde vaste lijst als Week verwerken (iedereen met een
// actieve plaatsing), maar dan met de facturen: zijn inkoopfactuur, onze
// verkoopfactuur, de marge en in één woord wat er nog mist. Staat bovenaan
// zowel Verkoopfacturen als Inkoop.
// ---------------------------------------------------------------------------

const stip = (ok: boolean) => cn("h-2 w-2 shrink-0 rounded-full", ok ? "bg-emerald-500" : "bg-red-500");

export async function PersonenPerWeek({ week }: { week: string | null }) {
  const { week: slot, rows } = await getWeekOverview(week);
  const inkoopIds = rows.map((r) => r.receivedInvoiceId).filter((x): x is string => !!x);
  const verkoopIds = rows.map((r) => r.verkoopFactuurId).filter((x): x is string => !!x);
  const [inkoop, verkoop, regels] = await Promise.all([
    db.receivedInvoice.findMany({
      where: { id: { in: inkoopIds } },
      select: { id: true, number: true, amount: true, vatAmount: true, status: true },
    }),
    db.invoice.findMany({ where: { id: { in: verkoopIds } }, select: { id: true, number: true, status: true } }),
    db.invoiceLine.findMany({
      where: { invoiceId: { in: verkoopIds }, weekNumber: slot.isoWeek },
      select: { invoiceId: true, placementId: true, amount: true },
    }),
  ]);
  const ink = new Map(inkoop.map((i) => [i.id, i]));
  const ver = new Map(verkoop.map((i) => [i.id, i]));

  const lijst = rows.map((r) => {
    const i = r.receivedInvoiceId ? ink.get(r.receivedInvoiceId) : undefined;
    const v = r.verkoopFactuurId ? ver.get(r.verkoopFactuurId) : undefined;
    // Alleen de regels van DEZE persoon in deze week (één factuur kan meer mensen dekken).
    const verkoopEx = v
      ? round2(regels.filter((l) => l.invoiceId === v.id && l.placementId === r.placementId).reduce((s, l) => s + l.amount, 0))
      : null;
    const inkoopEx = i ? round2(i.amount - (i.vatAmount ?? 0)) : null;
    // ponytail: een verzamelfactuur over meerdere weken telt hier volledig mee; per-week-verdeling als dat stoort.
    const marge = verkoopEx != null && (inkoopEx != null || r.factuurNvt) ? round2(verkoopEx - (inkoopEx ?? 0)) : null;
    const mist = watMist({
      timesheetOntvangen: r.timesheetOntvangen,
      factuurOntvangen: r.factuurOntvangen,
      factuurNvt: r.factuurNvt,
      vastgelegd: r.vastgelegd,
      inkoopStatus: i?.status ?? null,
      verkoopStatus: v?.status ?? null,
    });
    return { r, i, v, verkoopEx, inkoopEx, marge, mist };
  });
  const compleet = lijst.filter((x) => x.mist.length === 0).length;

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-5 py-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink-900">Per persoon · week {slot.isoWeek}</h2>
          <p className="text-xs text-ink-500">Iedereen met een plaatsing staat hier vast. Rood = ontbreekt nog.</p>
        </div>
        <span
          className={cn(
            "rounded-sm px-2 py-1 text-xs font-semibold tabular-nums",
            compleet === lijst.length && lijst.length > 0 ? "bg-emerald-50 text-emerald-700" : "bg-ink-100 text-ink-600",
          )}
        >
          {compleet}/{lijst.length} compleet
        </span>
      </div>
      <div className="overflow-x-auto">
        <Table>
          <THead>
            <TR>
              <TH>Persoon</TH>
              <TH className="text-right">Uren</TH>
              <TH>Inkoopfactuur (freelancer)</TH>
              <TH>Verkoopfactuur (klant)</TH>
              <TH className="text-right">Marge ex btw</TH>
              <TH>Wat mist er</TH>
            </TR>
          </THead>
          <TBody>
            {lijst.map(({ r, i, v, verkoopEx, inkoopEx, marge, mist }) => (
              <TR key={r.key}>
                <TD>
                  <Link href={r.href ?? "#"} className="flex items-center gap-3 hover:underline">
                    <PersoonVierkant naam={r.naam} size="sm" />
                    <span className="min-w-0">
                      <span className="block font-medium text-ink-900">{r.naam}</span>
                      <span className="block text-xs text-ink-500">{r.klantNaam ?? "—"}</span>
                    </span>
                  </Link>
                </TD>
                <TD className="text-right tabular-nums">
                  {r.uren != null ? formatHours(r.uren) : <span className="text-ink-300">—</span>}
                </TD>
                <TD>
                  {r.factuurNvt ? (
                    <span className="text-[13px] text-ink-400">— n.v.t. (in dienst)</span>
                  ) : i ? (
                    <span className="flex items-center gap-2 text-[13px]">
                      <span className={stip(true)} />
                      <span className="tabular-nums text-ink-900">{i.number ?? "zonder nr"}</span>
                      <span className="tabular-nums text-ink-500">{formatCurrency(inkoopEx ?? 0)}</span>
                      <StatusBadge options={RECEIVED_INVOICE_STATUSES} value={i.status} />
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 text-[13px] text-ink-700">
                      <span className={stip(false)} /> ontbreekt
                    </span>
                  )}
                </TD>
                <TD>
                  {v ? (
                    <Link href={`/facturatie/verkoop/${v.id}`} className="flex items-center gap-2 text-[13px] hover:underline">
                      <span className={stip(true)} />
                      <span className="tabular-nums text-ink-900">{v.number}</span>
                      <span className="tabular-nums text-ink-500">{formatCurrency(verkoopEx ?? 0)}</span>
                      <StatusBadge options={INVOICE_STATUSES} value={v.status} />
                    </Link>
                  ) : (
                    <span className="flex items-center gap-2 text-[13px] text-ink-700">
                      <span className={stip(false)} /> nog niet gemaakt
                    </span>
                  )}
                </TD>
                <TD className={cn("text-right font-semibold tabular-nums", marge != null && marge < 0 ? "text-red-600" : "text-ink-900")}>
                  {marge != null ? formatCurrency(marge) : <span className="font-normal text-ink-300">—</span>}
                </TD>
                <TD>
                  {mist.length === 0 ? (
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" /> Compleet
                    </span>
                  ) : (
                    <span className="flex flex-wrap gap-1">
                      {mist.map((m) => (
                        <span key={m} className="rounded-sm bg-amber-50 px-1.5 py-0.5 text-xs font-medium text-amber-800">
                          {m}
                        </span>
                      ))}
                    </span>
                  )}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </div>
    </Card>
  );
}
