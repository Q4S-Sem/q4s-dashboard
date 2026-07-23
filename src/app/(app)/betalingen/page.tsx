import Link from "next/link";
import { Banknote, Download, AlertTriangle, Info } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/badge";
import { PURCHASE_INVOICE_STATUSES } from "@/lib/domain";
import { formatCurrency, formatDate } from "@/lib/utils";
import { payablePurchaseInvoices } from "@/lib/betalingen";
import { getCompanySettings } from "@/lib/settings";

export const metadata = { title: "Betalingen" };

export default async function BetalingenPage() {
  const [rows, settings] = await Promise.all([payablePurchaseInvoices(), getCompanySettings()]);
  const eligible = rows.filter((r) => r.hasIban && r.total > 0);
  const missing = rows.filter((r) => !r.hasIban);
  const total = eligible.reduce((s, r) => s + r.total, 0);
  const hasQ4sIban = Boolean(settings.iban?.trim());
  const canDownload = eligible.length > 0 && hasQ4sIban;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Betalingen"
        description="Openstaande inkoopfacturen (ZZP'ers) klaarzetten als SEPA-bestand voor ING — uitvoerdatum = factuurdatum + 30 dagen."
        actions={
          canDownload ? (
            <a href="/api/betalingen/sepa" className={buttonVariants()}>
              <Download className="h-4 w-4" /> SEPA-bestand voor ING
            </a>
          ) : null
        }
      />

      {!hasQ4sIban && (
        <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Er staat nog geen Q4S-IBAN in de{" "}
          <Link href="/instellingen" className="font-medium underline">
            Instellingen
          </Link>
          . Die is nodig als tegenrekening voor het SEPA-bestand.
        </p>
      )}

      {missing.length > 0 && (
        <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          {missing.length} inkoopfactu{missing.length === 1 ? "ur" : "ren"} {missing.length === 1 ? "heeft" : "hebben"} geen
          IBAN bij de werknemer — die worden overgeslagen. Vul de IBAN aan op de werknemerpagina.
        </p>
      )}

      {rows.length === 0 ? (
        <EmptyState
          icon={<Banknote className="h-6 w-6" />}
          title="Geen openstaande betalingen"
          description="Er zijn geen inkoopfacturen die nog betaald moeten worden."
        />
      ) : (
        <Card>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <th className="py-2 pr-2">Factuur</th>
                    <th className="py-2 px-2">Werknemer</th>
                    <th className="py-2 px-2">Factuurdatum</th>
                    <th className="py-2 px-2">Uitvoerdatum</th>
                    <th className="py-2 px-2">Status</th>
                    <th className="py-2 px-2">IBAN</th>
                    <th className="py-2 pl-2 text-right">Bedrag</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((r) => (
                    <tr key={r.id} className={r.hasIban ? "" : "opacity-60"}>
                      <td className="py-2.5 pr-2">
                        <Link href={`/inkoopfacturen/${r.id}`} className="font-medium text-slate-900 hover:underline">
                          {r.number}
                        </Link>
                      </td>
                      <td className="py-2.5 px-2 text-slate-700">{r.consultantName}</td>
                      <td className="py-2.5 px-2 text-slate-600">{formatDate(r.issueDate)}</td>
                      <td className="py-2.5 px-2 text-slate-600">{formatDate(r.executionDate)}</td>
                      <td className="py-2.5 px-2">
                        <StatusBadge options={PURCHASE_INVOICE_STATUSES} value={r.status} />
                      </td>
                      <td className="py-2.5 px-2">
                        {r.hasIban ? (
                          <span className="text-slate-500 tabular-nums">{r.iban}</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-amber-600">
                            <AlertTriangle className="h-3.5 w-3.5" /> ontbreekt
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pl-2 text-right tabular-nums">{formatCurrency(r.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-200 font-semibold text-slate-900">
                    <td className="py-2.5 pr-2" colSpan={6}>
                      Totaal te betalen (met IBAN)
                    </td>
                    <td className="py-2.5 pl-2 text-right tabular-nums">{formatCurrency(total)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
        <div>
          <p className="font-medium text-slate-700">Zo werkt het</p>
          <p className="mt-1">
            Klik op <strong>SEPA-bestand voor ING</strong> → je downloadt een pain.001-bestand met alle openstaande
            betalingen (gegroepeerd op uitvoerdatum). Dat upload je in <strong>ING Zakelijk Bankieren</strong>, waar
            jij het nog goedkeurt. De app zet nooit zelf geld weg — je houdt de controle.
          </p>
        </div>
      </div>
    </div>
  );
}
