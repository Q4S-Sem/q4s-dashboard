import Link from "next/link";
import { ArrowLeft, Archive, CalendarDays, Receipt, Coins } from "lucide-react";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/badge";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { formatHours } from "@/lib/utils";
import { INVOICE_STATUSES, PURCHASE_INVOICE_STATUSES } from "@/lib/domain";
import { archivedBillingByWeek } from "@/lib/facturatie";

export const metadata = { title: "Facturatie-archief" };
export const dynamic = "force-dynamic";

export default async function FacturatieArchiefPage() {
  const weeks = await archivedBillingByWeek();

  return (
    <div className="space-y-6">
      <Link href="/verwerken" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Terug naar verwerken
      </Link>

      <PageHeader
        title="Facturatie-archief"
        description="Volledig verwerkte medewerker-weken (inkoop- én verkoopfactuur klaar), per week gesorteerd. Zo blijven de vorige flows schoon. Klopt er iets niet? Open de factuur en pas hem aan — het factuurnummer blijft behouden."
      />

      {weeks.length === 0 ? (
        <EmptyState
          icon={<Archive className="h-6 w-6" />}
          title="Nog niets gearchiveerd"
          description="Zodra een medewerker-week volledig is verwerkt (inkoop- én verkoopfactuur), verschijnt hij hier — per week."
        />
      ) : (
        weeks.map((w) => (
          <Card key={w.key}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <CalendarDays className="h-4 w-4 text-brand-600" /> {w.weekLabel}
              </CardTitle>
              <span className="text-sm text-slate-500">
                {w.rows.length} medewerker-week{w.rows.length === 1 ? "" : "en"} · {formatHours(w.hours)} u
              </span>
            </CardHeader>
            <Table>
              <THead>
                <TR className="hover:bg-transparent">
                  <TH>Medewerker</TH>
                  <TH>Plaatsing / klant</TH>
                  <TH className="text-right">Uren</TH>
                  <TH>Verkoopfactuur</TH>
                  <TH>Inkoopfactuur</TH>
                </TR>
              </THead>
              <TBody>
                {w.rows.map((r) => (
                  <TR key={r.timesheetId}>
                    <TD>
                      <Link
                        href={`/werknemers/${r.consultantId}`}
                        className="font-medium text-slate-900 hover:text-brand-700"
                      >
                        {r.consultantName}
                      </Link>
                    </TD>
                    <TD className="text-slate-500">
                      <span className="text-slate-900">{r.placementTitle}</span>
                      <span className="block text-xs text-slate-400">{r.clientName}</span>
                    </TD>
                    <TD className="text-right tabular-nums">{formatHours(r.hours)}</TD>
                    <TD>
                      {r.sales ? (
                        <span className="flex items-center gap-2">
                          <Link href={`/facturen/${r.sales.id}`} className="inline-flex items-center gap-1 font-medium text-slate-900 hover:text-brand-700">
                            <Receipt className="h-3.5 w-3.5 text-slate-400" /> {r.sales.number}
                          </Link>
                          <StatusBadge options={INVOICE_STATUSES} value={r.sales.status} />
                        </span>
                      ) : (
                        "—"
                      )}
                    </TD>
                    <TD>
                      {r.purchase ? (
                        <span className="flex items-center gap-2">
                          <Link href={`/inkoopfacturen/${r.purchase.id}`} className="inline-flex items-center gap-1 font-medium text-slate-900 hover:text-brand-700">
                            <Coins className="h-3.5 w-3.5 text-slate-400" /> {r.purchase.number}
                          </Link>
                          <StatusBadge options={PURCHASE_INVOICE_STATUSES} value={r.purchase.status} />
                        </span>
                      ) : (
                        "—"
                      )}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        ))
      )}
    </div>
  );
}
