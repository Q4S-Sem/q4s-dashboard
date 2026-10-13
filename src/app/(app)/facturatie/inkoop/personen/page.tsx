import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { PersoonVierkant } from "@/components/ui/persoon-vierkant";
import { TabelZoek, matchtZoek } from "@/components/ui/tabel-zoek";
import { listReceivedInvoices } from "@/lib/received-invoices";
import { inkoopVervaldatum } from "@/lib/facturatie-lijsten";
import { ZZP_PAYMENT_TERM_DAYS } from "@/lib/betalingen";
import { cn, formatCurrency, formatDate, round2 } from "@/lib/utils";
import { VerkoopTabs } from "../../verkoop/VerkoopTabs";

export const metadata = { title: "Inkoop · per persoon" };

// Buiten de component: de render-purity-lint staat Date.now() in de render niet toe.
function nuMs() {
  return Date.now();
}

/** Per persoon: wat staat er open, wat moet het eerst betaald. Klik = zijn facturen. */
export default async function InkoopPersonenPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const facturen = await listReceivedInvoices();
  const perPersoon = [
    ...facturen
      .reduce((m, r) => {
        const p = m.get(r.consultantId) ?? { id: r.consultantId, naam: r.consultantName, open: 0, openBedrag: 0, betaald: 0, eersteVervalt: null as Date | null };
        if (r.status === "PAID") p.betaald++;
        else {
          p.open++;
          p.openBedrag = round2(p.openBedrag + (r.amount ?? 0));
          const v = inkoopVervaldatum(r.issueDate, ZZP_PAYMENT_TERM_DAYS);
          if (v && (!p.eersteVervalt || v < p.eersteVervalt)) p.eersteVervalt = v;
        }
        return m.set(r.consultantId, p);
      }, new Map<string, { id: string; naam: string; open: number; openBedrag: number; betaald: number; eersteVervalt: Date | null }>())
      .values(),
  ]
    // Wie het eerst betaald moet worden bovenaan.
    .sort((x, y) => (x.eersteVervalt?.getTime() ?? Infinity) - (y.eersteVervalt?.getTime() ?? Infinity) || x.naam.localeCompare(y.naam));
  const zichtbaar = perPersoon.filter(
    (p) =>
      matchtZoek(sp.q, p.naam) &&
      (sp.status === "open" ? p.open > 0 : sp.status === "betaald" ? p.open === 0 && p.betaald > 0 : true),
  );
  const nu = nuMs();

  return (
    <div className="space-y-6">
      <PageHeader title="Inkoopfacturen" description="Per persoon, wie het eerst betaald moet worden staat bovenaan." />
      <VerkoopTabs actief="personen" base="/facturatie/inkoop" personenLabel="Per persoon betalen" />
      {perPersoon.length === 0 ? (
        <EmptyState title="Nog geen ontvangen facturen" description="Facturen van freelancers uit Week verwerken verschijnen hier per persoon." />
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-ink-100 p-4">
            <TabelZoek basePath="/facturatie/inkoop/personen" q={sp.q} placeholder="Zoek op persoon…">
              <Select name="status" defaultValue={sp.status ?? ""} aria-label="Filter op status" className="sm:w-48">
                <option value="">Alle personen</option>
                <option value="open">Nog te betalen</option>
                <option value="betaald">Alles betaald</option>
              </Select>
            </TabelZoek>
          </div>
          {zichtbaar.length === 0 && <p className="px-4 py-6 text-center text-sm text-ink-500">Niemand gevonden met deze filters.</p>}
          <ul className="divide-y divide-ink-100">
            {zichtbaar.map((p, i) => {
              const dagen = p.eersteVervalt ? Math.ceil((p.eersteVervalt.getTime() - nu) / 86_400_000) : null;
              return (
                <li key={p.id}>
                  <Link
                    href={`/facturatie/inkoop?tab=alles&persoon=${p.id}`}
                    className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-2.5 text-[13px] hover:bg-ink-50"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <PersoonVierkant naam={p.naam} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-2 font-medium text-ink-900">
                          {p.naam}
                          {i === 0 && p.open > 0 && !sp.q && <Badge color="orange">Eerst betalen</Badge>}
                        </span>
                        <span className={cn("block text-xs", dagen != null && dagen < 0 ? "font-medium text-red-700" : dagen != null && dagen <= 2 ? "font-medium text-amber-700" : "text-ink-500")}>
                          {p.eersteVervalt
                            ? `betalen vóór ${formatDate(p.eersteVervalt)} · ${dagen! < 0 ? `${-dagen!} ${dagen === -1 ? "dag" : "dagen"} te laat` : dagen === 0 ? "vandaag" : `over ${dagen} ${dagen === 1 ? "dag" : "dagen"}`}`
                            : "alles betaald"}
                        </span>
                      </span>
                    </span>
                    <span className="flex items-center gap-2">
                      {p.open > 0 && (
                        <Badge color={dagen != null && dagen < 0 ? "red" : dagen != null && dagen <= 2 ? "amber" : "slate"}>
                          {p.open} open · {formatCurrency(p.openBedrag)}
                        </Badge>
                      )}
                      {p.betaald > 0 && <Badge color="green">{p.betaald} betaald</Badge>}
                    </span>
                    <ChevronRight className="h-4 w-4 text-ink-400" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
